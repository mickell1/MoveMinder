import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/src/lib/supabase/server'
import { anthropic, AI_MODEL } from '@/src/lib/ai/client'
import { buildUserSummary, UserAIContext } from '@/src/lib/ai/context'

const MUSCLE_GROUPS = ['chest', 'back', 'legs', 'shoulders', 'arms', 'core']

function inferMuscleGroup(exerciseName: string, focus: string): string {
  const n = exerciseName.toLowerCase()
  if (n.includes('squat') || n.includes('lunge') || n.includes('leg') || n.includes('calf') || n.includes('hamstring') || n.includes('glute') || n.includes('deadlift')) return 'legs'
  if (n.includes('bench') || n.includes('chest') || n.includes('fly') || n.includes('push')) return 'chest'
  if (n.includes('row') || n.includes('pull') || n.includes('lat') || n.includes('back') || n.includes('chin')) return 'back'
  if (n.includes('shoulder') || n.includes('press') || n.includes('delt') || n.includes('lateral raise')) return 'shoulders'
  if (n.includes('curl') || n.includes('tricep') || n.includes('bicep') || n.includes('dip')) return 'arms'
  if (n.includes('plank') || n.includes('crunch') || n.includes('ab') || n.includes('core') || n.includes('sit-up')) return 'core'
  // fallback: infer from workout focus
  const f = focus.toLowerCase()
  if (f.includes('upper')) return 'chest'
  if (f.includes('lower')) return 'legs'
  if (f.includes('push')) return 'chest'
  if (f.includes('pull')) return 'back'
  return 'core'
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { focus, type } = await req.json() as { focus: string; type: 'single' | 'program' }

    const [profileRes, weighInsRes, sessionsRes] = await Promise.all([
      supabase.from('profiles').select('full_name, age, sex, height_cm, fitness_level, goals, workout_frequency, activity_level, dietary_preferences, goal_weight').eq('id', user.id).single(),
      supabase.from('weigh_ins').select('weight_kg, logged_date').eq('user_id', user.id).order('logged_date', { ascending: false }).limit(1),
      supabase.from('workout_sessions').select('id').eq('user_id', user.id),
    ])

    const profile = profileRes.data
    const latestWeight = weighInsRes.data?.[0]?.weight_kg ?? null

    const ctx: UserAIContext = {
      name: profile?.full_name ?? null,
      age: profile?.age ?? null,
      sex: profile?.sex ?? null,
      heightCm: profile?.height_cm ?? null,
      weightKg: latestWeight,
      goalWeightKg: profile?.goal_weight ?? null,
      fitnessLevel: profile?.fitness_level ?? null,
      goals: Array.isArray(profile?.goals) ? profile.goals : (profile?.goals ? [profile.goals] : []),
      workoutFrequency: profile?.workout_frequency ?? null,
      activityLevel: profile?.activity_level ?? null,
      dietaryPreferences: profile?.dietary_preferences ?? [],
      recentWorkoutCount: sessionsRes.data?.length ?? 0,
    }

    const userSummary = buildUserSummary(ctx)
    const weeksCount = type === 'program' ? 4 : 1
    const workoutsPerWeek = ctx.workoutFrequency ?? 3
    const totalWorkouts = type === 'program' ? weeksCount * workoutsPerWeek : 1

    const exerciseSchema = `{ "name": "Exercise Name", "muscle_group": "chest|back|legs|shoulders|arms|core", "sets": 3, "reps": 10, "rest_seconds": 60, "notes": "optional form tip" }`

    const prompt = `You are an expert personal trainer AI. Generate ${type === 'program' ? `a ${weeksCount}-week progressive training program (${totalWorkouts} workouts total, ${workoutsPerWeek} per week)` : 'a single workout session'} for this client.

CLIENT PROFILE:
${userSummary}

REQUESTED FOCUS: ${focus}

REQUIREMENTS:
- Use real exercises appropriate to their fitness level
- For beginners: compound movements, lower volume, longer rest
- For intermediate/advanced: progressive overload, supersets where appropriate
- Each exercise MUST include muscle_group (one of: chest, back, legs, shoulders, arms, core)
- Each exercise must have: name, muscle_group, sets (2-5), reps (5-20), rest_seconds (30-120)
- Workout names should be specific (e.g. "Upper Body Strength", "Leg Day - Week 1")
${type === 'program' ? '- Progress week over week (increase sets/reps/reduce rest)' : ''}

Respond ONLY with valid JSON in this exact structure, no markdown, no explanation:
${type === 'single' ? `{
  "workouts": [
    {
      "name": "workout name",
      "description": "brief description",
      "exercises": [
        ${exerciseSchema}
      ]
    }
  ]
}` : `{
  "workouts": [
    {
      "name": "workout name",
      "week": 1,
      "day": 1,
      "description": "brief description",
      "exercises": [
        ${exerciseSchema}
      ]
    }
  ]
}`}`

    const message = await anthropic.messages.create({
      model: AI_MODEL,
      max_tokens: 4096,
      system: 'You are an expert personal trainer. Always respond with valid JSON only. No markdown code blocks, no explanations.',
      messages: [{ role: 'user', content: prompt }],
    })

    const rawText = (message.content[0] as { type: string; text: string }).text.trim()
    // Strip markdown code fences if Claude included them despite instructions
    const raw = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    let parsed: { workouts: Array<{ name: string; description: string; week?: number; day?: number; exercises: Array<{ name: string; muscle_group?: string; sets: number; reps: number; rest_seconds: number; notes?: string }> }> }
    try {
      parsed = JSON.parse(raw)
    } catch {
      return NextResponse.json({ error: 'AI returned invalid JSON', raw }, { status: 500 })
    }

    const savedWorkouts = []
    for (const w of parsed.workouts) {
      const { data: workout, error: wErr } = await supabase
        .from('workouts')
        .insert({ user_id: user.id, name: w.name, description: w.description ?? null })
        .select().single()

      if (wErr || !workout) {
        console.error('workout insert error:', wErr)
        continue
      }

      for (let i = 0; i < w.exercises.length; i++) {
        const ex = w.exercises[i]
        const muscleGroup = (ex.muscle_group && MUSCLE_GROUPS.includes(ex.muscle_group))
          ? ex.muscle_group
          : inferMuscleGroup(ex.name, focus)

        // Find existing exercise in catalog
        let { data: found } = await supabase
          .from('exercises').select('id').ilike('name', ex.name).limit(1).maybeSingle()

        if (!found) {
          // Try to create — include all required catalog fields
          const difficulty = ctx.fitnessLevel ?? 'beginner'
          const { data: created, error: exErr } = await supabase
            .from('exercises')
            .insert({ name: ex.name, description: ex.notes ?? null, muscle_group: muscleGroup, equipment: 'various', difficulty })
            .select('id').maybeSingle()
          if (exErr) {
            // Insert may have failed due to unique constraint race — retry exact find
            const { data: retry } = await supabase
              .from('exercises').select('id').eq('name', ex.name).maybeSingle()
            found = retry
          } else {
            found = created
          }
        }

        if (!found) {
          console.error('Could not find or create exercise:', ex.name)
          continue
        }

        const { error: weErr } = await supabase.from('workout_exercises').insert({
          workout_id: workout.id,
          exercise_id: found.id,
          name: ex.name,           // store name directly — workout page uses this as primary source
          sets: ex.sets,
          reps: ex.reps,
          rest_seconds: ex.rest_seconds,
          order_index: i,
        })
        if (weErr) console.error('workout_exercises insert error:', weErr)
      }

      savedWorkouts.push({ id: workout.id, name: workout.name, week: w.week ?? null, day: w.day ?? null, exerciseCount: w.exercises.length })
    }

    return NextResponse.json({ workouts: savedWorkouts })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('AI workout route error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
