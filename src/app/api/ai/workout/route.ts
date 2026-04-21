import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/src/lib/supabase/server'
import { anthropic, AI_MODEL } from '@/src/lib/ai/client'
import { buildUserSummary, UserAIContext } from '@/src/lib/ai/context'

export async function POST(req: NextRequest) {
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

  const prompt = `You are an expert personal trainer AI. Generate ${type === 'program' ? `a ${weeksCount}-week progressive training program (${totalWorkouts} workouts total, ${workoutsPerWeek} per week)` : 'a single workout session'} for this client.

CLIENT PROFILE:
${userSummary}

REQUESTED FOCUS: ${focus}

REQUIREMENTS:
- Use real exercises appropriate to their fitness level
- For beginners: compound movements, lower volume, longer rest
- For intermediate/advanced: progressive overload, supersets where appropriate
- Each exercise must have: name, sets (2-5), reps (5-20), rest_seconds (30-120)
- Workout names should be specific (e.g. "Upper Body Strength", "Leg Day - Week 1")
${type === 'program' ? '- Progress week over week (increase sets/reps/reduce rest)' : ''}

Respond ONLY with valid JSON in this exact structure, no markdown, no explanation:
${type === 'single' ? `{
  "workouts": [
    {
      "name": "workout name",
      "description": "brief description",
      "exercises": [
        { "name": "Exercise Name", "sets": 3, "reps": 10, "rest_seconds": 60, "notes": "optional form tip" }
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
        { "name": "Exercise Name", "sets": 3, "reps": 10, "rest_seconds": 60, "notes": "optional form tip" }
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

  const raw = (message.content[0] as { type: string; text: string }).text.trim()
  let parsed: { workouts: Array<{ name: string; description: string; week?: number; day?: number; exercises: Array<{ name: string; sets: number; reps: number; rest_seconds: number; notes?: string }> }> }
  try {
    parsed = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: 'AI returned invalid JSON', raw }, { status: 500 })
  }

  // Look up or create exercises in the exercises table, then save workouts
  const savedWorkouts = []
  for (const w of parsed.workouts) {
    const { data: workout, error: wErr } = await supabase
      .from('workouts')
      .insert({ user_id: user.id, name: w.name, description: w.description ?? null })
      .select().single()

    if (wErr || !workout) continue

    for (let i = 0; i < w.exercises.length; i++) {
      const ex = w.exercises[i]
      // Find or create exercise in catalog
      let { data: found } = await supabase.from('exercises').select('id').ilike('name', ex.name).limit(1).single()
      if (!found) {
        const { data: created } = await supabase.from('exercises').insert({ name: ex.name, description: ex.notes ?? null }).select('id').single()
        found = created
      }
      if (!found) continue

      await supabase.from('workout_exercises').insert({
        workout_id: workout.id,
        exercise_id: found.id,
        sets: ex.sets,
        reps: ex.reps,
        rest_seconds: ex.rest_seconds,
        order_index: i,
      })
    }

    savedWorkouts.push({ id: workout.id, name: workout.name, week: w.week ?? null, day: w.day ?? null, exerciseCount: w.exercises.length })
  }

  return NextResponse.json({ workouts: savedWorkouts })
}
