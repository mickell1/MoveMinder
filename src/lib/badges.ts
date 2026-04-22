export type BadgeCategory = 'workouts' | 'streaks' | 'records' | 'weight' | 'nutrition'

export type BadgeStats = {
  workoutCount: number
  streak: number
  pbCount: number
  weighInCount: number
  foodLogDays: number
}

export type Badge = {
  id: string
  name: string
  description: string
  icon: string
  category: BadgeCategory
  check: (stats: BadgeStats) => boolean
}

export const BADGES: Badge[] = [
  // Workouts
  { id: 'workout_1',   name: 'First Rep',       description: 'Complete your first workout',  icon: '🏋️', category: 'workouts', check: s => s.workoutCount >= 1   },
  { id: 'workout_10',  name: 'Getting Serious',  description: 'Complete 10 workouts',         icon: '💪', category: 'workouts', check: s => s.workoutCount >= 10  },
  { id: 'workout_25',  name: 'Committed',        description: 'Complete 25 workouts',         icon: '🔥', category: 'workouts', check: s => s.workoutCount >= 25  },
  { id: 'workout_50',  name: 'Dedicated',        description: 'Complete 50 workouts',         icon: '⚡', category: 'workouts', check: s => s.workoutCount >= 50  },
  { id: 'workout_100', name: 'Century Club',     description: 'Complete 100 workouts',        icon: '🏆', category: 'workouts', check: s => s.workoutCount >= 100 },
  // Streaks
  { id: 'streak_3',  name: 'Hat-Trick',       description: '3-day workout streak',  icon: '🔥', category: 'streaks', check: s => s.streak >= 3  },
  { id: 'streak_7',  name: 'Week Warrior',    description: '7-day workout streak',  icon: '🌟', category: 'streaks', check: s => s.streak >= 7  },
  { id: 'streak_14', name: 'Fortnight Fighter', description: '14-day workout streak', icon: '💫', category: 'streaks', check: s => s.streak >= 14 },
  { id: 'streak_30', name: 'Monthly Legend',  description: '30-day workout streak', icon: '👑', category: 'streaks', check: s => s.streak >= 30 },
  // Personal Bests
  { id: 'pb_1',  name: 'Record Setter',  description: 'Set your first personal best', icon: '💥', category: 'records', check: s => s.pbCount >= 1  },
  { id: 'pb_5',  name: 'Record Breaker', description: 'Set 5 personal bests',         icon: '🏅', category: 'records', check: s => s.pbCount >= 5  },
  { id: 'pb_10', name: 'Elite Lifter',   description: 'Set 10 personal bests',        icon: '🥇', category: 'records', check: s => s.pbCount >= 10 },
  // Weight Tracking
  { id: 'weigh_in_1', name: 'Accountability', description: 'Log your first weigh-in', icon: '⚖️', category: 'weight', check: s => s.weighInCount >= 1 },
  { id: 'weigh_in_7', name: 'Scale Regular',  description: 'Log 7 weigh-ins',         icon: '📊', category: 'weight', check: s => s.weighInCount >= 7 },
  // Nutrition
  { id: 'food_1', name: 'Food Tracker', description: 'Log your first meal',              icon: '🍽️', category: 'nutrition', check: s => s.foodLogDays >= 1 },
  { id: 'food_7', name: 'Macro Master', description: 'Track food on 7 different days',   icon: '🥗', category: 'nutrition', check: s => s.foodLogDays >= 7 },
]

export const BADGE_CATEGORIES: { id: BadgeCategory; label: string; icon: string }[] = [
  { id: 'workouts',  label: 'Workouts',  icon: '💪' },
  { id: 'streaks',   label: 'Streaks',   icon: '🔥' },
  { id: 'records',   label: 'Records',   icon: '🏆' },
  { id: 'weight',    label: 'Weight',    icon: '⚖️' },
  { id: 'nutrition', label: 'Nutrition', icon: '🥗' },
]
