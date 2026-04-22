'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AppHeader } from '@/src/components/AppHeader'
import { useCalorieUnit } from '@/src/lib/hooks/useCalorieUnit'

type Meal = { type: string; name: string; description: string; calories: number; protein: number; carbs: number; fat: number }
type Day = { day: string; meals: Meal[]; dailyCalories: number; dailyProtein: number; dailyCarbs: number; dailyFat: number }
type MealPlan = { targetCalories: number; targetProtein: number; targetCarbs: number; targetFat: number; days: Day[] }

const mealTypeIcon: Record<string, string> = { breakfast: '🌅', lunch: '☀️', dinner: '🌙', snack: '🍎' }

export default function NutritionPage() {
  const { label: calLabel } = useCalorieUnit()
  const [loading, setLoading] = useState(false)
  const [plan, setPlan] = useState<MealPlan | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeDay, setActiveDay] = useState(0)

  async function generate() {
    setLoading(true)
    setError(null)
    const res = await fetch('/api/ai/meal-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok || data.error) { setError(data.error ?? 'Something went wrong'); return }
    setPlan(data.plan)
    setActiveDay(0)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader title="MoveMinder" />

      <main className="max-w-xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI Meal Plan</h1>
          <p className="text-sm text-gray-500 mt-1">Personalised nutrition based on your goals, body stats, and dietary preferences.</p>
        </div>

        {!plan ? (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="text-4xl mb-3">🥗</div>
              <h2 className="font-bold text-gray-900 mb-1">7-Day Personalised Plan</h2>
              <p className="text-sm text-gray-500 mb-4">
                Claude calculates your TDEE, adjusts for your goal (deficit/surplus), respects your dietary preferences, and builds a full week of meals with macros.
              </p>
              <ul className="text-sm text-gray-600 space-y-1 mb-4">
                {['Breakfast, lunch, dinner + snack daily', 'Protein, carbs & fat targets', 'Varied meals — no repeats', 'Respects your dietary restrictions'].map(f => (
                  <li key={f} className="flex items-center gap-2"><span className="text-green-500">✓</span>{f}</li>
                ))}
              </ul>
              <p className="text-xs text-gray-400">
                Missing profile data?{' '}
                <Link href="/ai/profile" className="text-blue-500 font-medium">Update your AI profile →</Link>
              </p>
            </div>

            {error && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">{error}</div>}

            <button onClick={generate} disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold text-lg rounded-2xl hover:from-green-600 hover:to-emerald-700 active:scale-95 transition-all shadow-md disabled:opacity-50">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Building your meal plan…
                </span>
              ) : 'Generate My Meal Plan'}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Macro targets */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <p className="text-sm font-semibold text-gray-700 mb-3">Daily Targets</p>
              <div className="grid grid-cols-4 gap-2 text-center">
                {[
                  { label: 'Calories', value: plan.targetCalories, unit: calLabel, color: 'blue' },
                  { label: 'Protein', value: plan.targetProtein, unit: 'g', color: 'red' },
                  { label: 'Carbs', value: plan.targetCarbs, unit: 'g', color: 'yellow' },
                  { label: 'Fat', value: plan.targetFat, unit: 'g', color: 'green' },
                ].map(m => (
                  <div key={m.label} className={`bg-${m.color}-50 rounded-xl p-2`}>
                    <p className={`text-lg font-bold text-${m.color}-700`}>{m.value}</p>
                    <p className={`text-xs text-${m.color}-600`}>{m.unit}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{m.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Day selector */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-4 px-4">
              {plan.days.map((d, i) => (
                <button key={d.day} onClick={() => setActiveDay(i)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${activeDay === i ? 'bg-green-600 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>
                  {d.day.slice(0, 3)}
                </button>
              ))}
            </div>

            {/* Day detail */}
            {plan.days[activeDay] && (
              <div className="space-y-3">
                <div className="bg-gray-100 rounded-xl px-4 py-2 flex items-center justify-between text-xs text-gray-600">
                  <span className="font-semibold">{plan.days[activeDay].day}</span>
                  <span>{plan.days[activeDay].dailyCalories} {calLabel} · P {plan.days[activeDay].dailyProtein}g · C {plan.days[activeDay].dailyCarbs}g · F {plan.days[activeDay].dailyFat}g</span>
                </div>
                {plan.days[activeDay].meals.map((meal, i) => (
                  <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xl">{mealTypeIcon[meal.type] ?? '🍽️'}</span>
                      <div>
                        <p className="text-xs text-gray-400 capitalize">{meal.type}</p>
                        <p className="font-semibold text-gray-900 text-sm">{meal.name}</p>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mb-3">{meal.description}</p>
                    <div className="flex gap-2">
                      {[
                        { l: `${meal.calories} ${calLabel}`, c: 'bg-blue-50 text-blue-700' },
                        { l: `${meal.protein}g protein`, c: 'bg-red-50 text-red-700' },
                        { l: `${meal.carbs}g carbs`, c: 'bg-yellow-50 text-yellow-700' },
                        { l: `${meal.fat}g fat`, c: 'bg-green-50 text-green-700' },
                      ].map(tag => (
                        <span key={tag.l} className={`text-xs font-medium px-2 py-0.5 rounded-full ${tag.c}`}>{tag.l}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <button onClick={() => setPlan(null)}
              className="w-full py-3 border border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors">
              Generate a New Plan
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
