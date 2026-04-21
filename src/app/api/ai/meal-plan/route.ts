import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/src/lib/supabase/server'
import { anthropic, AI_MODEL } from '@/src/lib/ai/client'
import { buildUserSummary, UserAIContext } from '@/src/lib/ai/context'

export async function POST(req: NextRequest) {
  try {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { calorieAdjust } = await req.json() as { calorieAdjust?: number }

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
  const adjustNote = calorieAdjust ? `Adjust daily calories by ${calorieAdjust > 0 ? '+' : ''}${calorieAdjust} kcal from TDEE.` : ''

  const prompt = `You are an expert nutritionist and dietitian AI. Create a personalised 7-day meal plan for this client.

CLIENT PROFILE:
${userSummary}

${adjustNote}

REQUIREMENTS:
- Respect ALL dietary preferences listed (very important)
- Base calories on their TDEE and goal (deficit for weight loss, surplus for muscle gain)
- Include breakfast, lunch, dinner, and one snack each day
- Vary meals across the week (don't repeat the same meal on consecutive days)
- Include realistic, easy-to-prepare meals with common ingredients
- Show macros (protein, carbs, fat) for each meal and daily totals

Respond ONLY with valid JSON, no markdown, no explanation:
{
  "targetCalories": 2000,
  "targetProtein": 150,
  "targetCarbs": 200,
  "targetFat": 70,
  "days": [
    {
      "day": "Monday",
      "meals": [
        {
          "type": "breakfast",
          "name": "Meal name",
          "description": "Brief description",
          "calories": 400,
          "protein": 30,
          "carbs": 45,
          "fat": 10
        }
      ],
      "dailyCalories": 2000,
      "dailyProtein": 150,
      "dailyCarbs": 200,
      "dailyFat": 70
    }
  ]
}`

  const message = await anthropic.messages.create({
    model: AI_MODEL,
    max_tokens: 6000,
    system: 'You are an expert nutritionist. Always respond with valid JSON only. No markdown code blocks.',
    messages: [{ role: 'user', content: prompt }],
  })

  const rawText = (message.content[0] as { type: string; text: string }).text.trim()
  const raw = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
  let plan: object
  try {
    plan = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: 'AI returned invalid JSON', raw }, { status: 500 })
  }

    return NextResponse.json({ plan })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('AI meal-plan route error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
