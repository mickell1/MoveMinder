export type UserAIContext = {
  name: string | null
  age: number | null
  sex: string | null
  heightCm: number | null
  weightKg: number | null
  goalWeightKg: number | null
  fitnessLevel: string | null
  goals: string[]
  workoutFrequency: number | null
  activityLevel: string | null
  dietaryPreferences: string[]
  recentWorkoutCount: number
}

const goalLabels: Record<string, string> = {
  lose_weight: 'lose weight',
  build_muscle: 'build muscle',
  get_fit: 'get fit',
  maintain: 'maintain weight',
}

const activityLabels: Record<string, string> = {
  sedentary: 'sedentary (desk job, little exercise)',
  light: 'lightly active (light exercise 1-3 days/week)',
  moderate: 'moderately active (moderate exercise 3-5 days/week)',
  active: 'very active (hard exercise 6-7 days/week)',
  very_active: 'extra active (physical job + daily training)',
}

export function buildUserSummary(ctx: UserAIContext): string {
  const bmi = ctx.heightCm && ctx.weightKg
    ? (ctx.weightKg / Math.pow(ctx.heightCm / 100, 2)).toFixed(1)
    : null

  const tdee = estimateTDEE(ctx)

  const lines = [
    `Name: ${ctx.name ?? 'User'}`,
    ctx.age ? `Age: ${ctx.age}` : null,
    ctx.sex ? `Sex: ${ctx.sex}` : null,
    ctx.heightCm ? `Height: ${ctx.heightCm} cm` : null,
    ctx.weightKg ? `Current weight: ${ctx.weightKg} kg` : null,
    ctx.goalWeightKg ? `Goal weight: ${ctx.goalWeightKg} kg` : null,
    bmi ? `BMI: ${bmi}` : null,
    tdee ? `Estimated TDEE: ${tdee} kcal/day` : null,
    ctx.fitnessLevel ? `Fitness level: ${ctx.fitnessLevel}` : null,
    ctx.goals.length ? `Goals: ${ctx.goals.map(g => goalLabels[g] ?? g).join(', ')}` : null,
    ctx.workoutFrequency ? `Target workout frequency: ${ctx.workoutFrequency}x/week` : null,
    ctx.activityLevel ? `Activity level: ${activityLabels[ctx.activityLevel] ?? ctx.activityLevel}` : null,
    ctx.dietaryPreferences.length ? `Dietary preferences: ${ctx.dietaryPreferences.join(', ')}` : null,
    `Recent workouts logged: ${ctx.recentWorkoutCount}`,
  ].filter(Boolean)

  return lines.join('\n')
}

function estimateTDEE(ctx: UserAIContext): number | null {
  if (!ctx.weightKg || !ctx.heightCm || !ctx.age || !ctx.sex) return null

  // Mifflin-St Jeor BMR
  const bmr = ctx.sex === 'female'
    ? 10 * ctx.weightKg + 6.25 * ctx.heightCm - 5 * ctx.age - 161
    : 10 * ctx.weightKg + 6.25 * ctx.heightCm - 5 * ctx.age + 5

  const multipliers: Record<string, number> = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
    very_active: 1.9,
  }
  const multiplier = multipliers[ctx.activityLevel ?? 'moderate'] ?? 1.55
  return Math.round(bmr * multiplier)
}
