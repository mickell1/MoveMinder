'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/src/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AppHeader } from '@/src/components/AppHeader'
import { useCalorieUnit } from '@/src/lib/hooks/useCalorieUnit'

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'

type FoodLog = {
  id: string
  meal_type: MealType
  name: string
  calories: number | null
  protein_g: number | null
  carbs_g: number | null
  fat_g: number | null
  serving_size: string | null
}

type ProfileData = {
  calorie_target?: number | null
  height_cm?: number | null
  age?: number | null
  sex?: string | null
  activity_level?: string | null
}

const MEALS: { type: MealType; label: string; icon: string }[] = [
  { type: 'breakfast', label: 'Breakfast', icon: '🌅' },
  { type: 'lunch',     label: 'Lunch',     icon: '☀️' },
  { type: 'dinner',   label: 'Dinner',    icon: '🌙' },
  { type: 'snack',    label: 'Snack',     icon: '🍎' },
]

const EMPTY_FORM = { name: '', calories: '', protein: '', carbs: '', fat: '', servingSize: '' }

function computeTarget(profile: ProfileData | null, weightKg: number | null): number {
  if (!profile) return 2000
  if (profile.calorie_target) return profile.calorie_target
  const { height_cm: h, age: a, sex: s, activity_level: act } = profile
  const w = weightKg
  if (!w || !h || !a || !s) return 2000
  const bmr = s === 'female' ? 10 * w + 6.25 * h - 5 * a - 161 : 10 * w + 6.25 * h - 5 * a + 5
  const mult: Record<string, number> = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9 }
  return Math.round(bmr * (mult[act ?? 'moderate'] ?? 1.55))
}

export default function FoodLogPage() {
  const router = useRouter()
  const supabase = createClient()

  const { label: calLabel, unit: calUnit, setUnit: setCalUnit } = useCalorieUnit()
  const todayStr = new Date().toLocaleDateString('en-CA')
  const [date, setDate] = useState(todayStr)
  const [logs, setLogs] = useState<FoodLog[]>([])
  const [calorieTarget, setCalorieTarget] = useState(2000)
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState('')

  // Add-food panel state
  const [addingTo, setAddingTo] = useState<MealType | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [lookupQuery, setLookupQuery] = useState('')
  const [lookupLoading, setLookupLoading] = useState(false)
  const [lookupError, setLookupError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const loadLogs = useCallback(async (uid: string, d: string) => {
    const { data } = await supabase
      .from('food_logs')
      .select('*')
      .eq('user_id', uid)
      .eq('logged_date', d)
      .order('created_at', { ascending: true })
    setLogs((data ?? []) as FoodLog[])
  }, [supabase])

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)

      const [profileRes, wiRes] = await Promise.all([
        supabase.from('profiles').select('calorie_target, height_cm, age, sex, activity_level').eq('id', user.id).single(),
        supabase.from('weigh_ins').select('weight_kg').eq('user_id', user.id).order('logged_date', { ascending: false }).limit(1),
      ])

      const weight = (wiRes.data?.[0]?.weight_kg as number | null) ?? null
      setCalorieTarget(computeTarget(profileRes.data as ProfileData | null, weight))
      await loadLogs(user.id, todayStr)
      setLoading(false)
    }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (userId) loadLogs(userId, date)
  }, [date, userId, loadLogs])

  function navDate(delta: number) {
    const d = new Date(date + 'T12:00:00')
    d.setDate(d.getDate() + delta)
    const next = d.toLocaleDateString('en-CA')
    if (next <= todayStr) setDate(next)
  }

  function openPanel(meal: MealType) {
    setAddingTo(prev => prev === meal ? null : meal)
    setForm(EMPTY_FORM)
    setLookupQuery('')
    setLookupError(null)
  }

  async function lookupFood() {
    if (!lookupQuery.trim()) return
    setLookupLoading(true)
    setLookupError(null)
    try {
      const res = await fetch('/api/ai/food-lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: lookupQuery }),
      })
      const data = await res.json()
      if (!res.ok || data.error) { setLookupError(data.error ?? 'Lookup failed'); return }
      setForm({
        name: data.name ?? lookupQuery,
        calories: data.calories != null ? String(data.calories) : '',
        protein: data.proteinG != null ? String(data.proteinG) : '',
        carbs: data.carbsG != null ? String(data.carbsG) : '',
        fat: data.fatG != null ? String(data.fatG) : '',
        servingSize: data.servingSize ?? '',
      })
    } catch {
      setLookupError('Network error — please try again')
    } finally {
      setLookupLoading(false)
    }
  }

  async function addFood() {
    if (!form.name.trim() || !userId || !addingTo) return
    setSaving(true)
    await supabase.from('food_logs').insert({
      user_id: userId,
      logged_date: date,
      meal_type: addingTo,
      name: form.name.trim(),
      calories: form.calories ? parseInt(form.calories) : null,
      protein_g: form.protein ? parseFloat(form.protein) : null,
      carbs_g: form.carbs ? parseFloat(form.carbs) : null,
      fat_g: form.fat ? parseFloat(form.fat) : null,
      serving_size: form.servingSize.trim() || null,
    })
    await loadLogs(userId, date)
    setForm(EMPTY_FORM)
    setLookupQuery('')
    setAddingTo(null)
    setSaving(false)
  }

  async function deleteFood(id: string) {
    await supabase.from('food_logs').delete().eq('id', id)
    setLogs(l => l.filter(x => x.id !== id))
  }

  const totalCalories = logs.reduce((s, l) => s + (l.calories ?? 0), 0)
  const totalProtein  = logs.reduce((s, l) => s + (l.protein_g ?? 0), 0)
  const totalCarbs    = logs.reduce((s, l) => s + (l.carbs_g ?? 0), 0)
  const totalFat      = logs.reduce((s, l) => s + (l.fat_g ?? 0), 0)
  const progress  = Math.min(100, (totalCalories / calorieTarget) * 100)
  const remaining = calorieTarget - totalCalories
  const isToday   = date === todayStr
  const yesterdayStr = new Date(new Date().getTime() - 86400000).toLocaleDateString('en-CA')
  const dateLabel = isToday ? 'Today' : date === yesterdayStr ? 'Yesterday'
    : new Date(date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-lg text-gray-600">Loading…</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader title="MoveMinder" />

      <main className="max-w-xl mx-auto px-4 py-6 space-y-4 pb-10">

        {/* Header + date nav + unit toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">Food Log</h1>
            <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-semibold">
              <button
                onClick={() => setCalUnit('kcal')}
                className={`px-2.5 py-1 transition-colors ${calUnit === 'kcal' ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
              >kcal</button>
              <button
                onClick={() => setCalUnit('cal')}
                className={`px-2.5 py-1 transition-colors ${calUnit === 'cal' ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
              >Cal</button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => navDate(-1)}
              className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50 text-lg leading-none">
              ‹
            </button>
            <span className="text-sm font-semibold text-gray-700 min-w-[80px] text-center">{dateLabel}</span>
            <button onClick={() => navDate(1)} disabled={isToday}
              className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50 disabled:opacity-30 text-lg leading-none">
              ›
            </button>
          </div>
        </div>

        {/* Calorie summary card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-end justify-between mb-3">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Calories</p>
              <div className="flex items-end gap-1.5">
                <span className="text-3xl font-bold text-gray-900">{totalCalories}</span>
                <span className="text-sm text-gray-400 pb-0.5">/ {calorieTarget} {calLabel}</span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-gray-700">
                {remaining > 0 ? `${remaining} remaining` : `${Math.abs(remaining)} over`}
              </p>
              <p className={`text-xs font-medium mt-0.5 ${remaining < 0 ? 'text-red-500' : remaining < calorieTarget * 0.1 ? 'text-amber-500' : 'text-green-600'}`}>
                {remaining < 0 ? 'Over target' : remaining < calorieTarget * 0.1 ? 'Almost there' : 'On track'}
              </p>
            </div>
          </div>

          <div className="w-full bg-gray-100 rounded-full h-2.5 mb-4 overflow-hidden">
            <div
              className={`h-2.5 rounded-full transition-all duration-500 ${remaining < 0 ? 'bg-red-400' : progress > 90 ? 'bg-amber-400' : 'bg-green-500'}`}
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              { label: 'Protein', value: Math.round(totalProtein), color: 'text-red-600', bg: 'bg-red-50' },
              { label: 'Carbs',   value: Math.round(totalCarbs),   color: 'text-yellow-600', bg: 'bg-yellow-50' },
              { label: 'Fat',     value: Math.round(totalFat),     color: 'text-green-600', bg: 'bg-green-50' },
            ].map(m => (
              <div key={m.label} className={`${m.bg} rounded-xl py-2`}>
                <p className={`text-base font-bold ${m.color}`}>{m.value}g</p>
                <p className="text-xs text-gray-400">{m.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Meal sections */}
        {MEALS.map(meal => {
          const mealLogs = logs.filter(l => l.meal_type === meal.type)
          const mealCals = mealLogs.reduce((s, l) => s + (l.calories ?? 0), 0)
          const isOpen = addingTo === meal.type

          return (
            <div key={meal.type} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              {/* Section header */}
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{meal.icon}</span>
                  <span className="font-semibold text-gray-900">{meal.label}</span>
                  {mealCals > 0 && (
                    <span className="text-xs text-gray-400 font-medium">{mealCals} {calLabel}</span>
                  )}
                </div>
                <button onClick={() => openPanel(meal.type)}
                  className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-sm transition-colors ${
                    isOpen ? 'bg-gray-200 text-gray-600' : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}>
                  {isOpen ? '×' : '+'}
                </button>
              </div>

              {/* Logged food items */}
              {mealLogs.length > 0 && (
                <div className="border-t border-gray-50 divide-y divide-gray-50">
                  {mealLogs.map(log => (
                    <div key={log.id} className="flex items-center justify-between px-4 py-2.5 group">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 truncate">{log.name}</p>
                        <p className="text-xs text-gray-400">
                          {[
                            log.serving_size,
                            log.calories != null && `${log.calories} ${calLabel}`,
                          ].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 ml-3 flex-shrink-0">
                        <div className="hidden sm:flex gap-2 text-xs text-gray-400">
                          {log.protein_g != null && <span>P {log.protein_g}g</span>}
                          {log.carbs_g != null && <span>C {log.carbs_g}g</span>}
                          {log.fat_g != null && <span>F {log.fat_g}g</span>}
                        </div>
                        <button onClick={() => deleteFood(log.id)}
                          className="text-gray-300 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 text-xl leading-none">
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Empty state */}
              {mealLogs.length === 0 && !isOpen && (
                <div className="border-t border-gray-50 px-4 py-2.5">
                  <p className="text-xs text-gray-400 text-center">Nothing logged yet</p>
                </div>
              )}

              {/* Add food panel */}
              {isOpen && (
                <div className="border-t border-gray-100 bg-gray-50 p-4 space-y-3">

                  {/* AI lookup */}
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">AI Lookup</p>
                    <div className="flex gap-2">
                      <input
                        value={lookupQuery}
                        onChange={e => setLookupQuery(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && lookupFood()}
                        placeholder="e.g. 150g chicken breast, 2 eggs..."
                        className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:border-blue-400"
                      />
                      <button onClick={lookupFood} disabled={lookupLoading || !lookupQuery.trim()}
                        className="flex-shrink-0 px-3 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-50">
                        {lookupLoading ? '…' : '🤖'}
                      </button>
                    </div>
                    {lookupError && <p className="text-xs text-red-500 mt-1.5">{lookupError}</p>}
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-px bg-gray-200" />
                    <span className="text-xs text-gray-400">or enter manually</span>
                    <div className="flex-1 h-px bg-gray-200" />
                  </div>

                  {/* Manual entry */}
                  <div className="space-y-2">
                    <input
                      value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="Food name *"
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:border-blue-400"
                    />
                    <input
                      value={form.servingSize}
                      onChange={e => setForm(f => ({ ...f, servingSize: e.target.value }))}
                      placeholder="Serving size (e.g. 150g, 1 cup)"
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:border-blue-400"
                    />
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { field: 'calories', label: 'Kcal' },
                        { field: 'protein',  label: 'Protein' },
                        { field: 'carbs',    label: 'Carbs' },
                        { field: 'fat',      label: 'Fat' },
                      ].map(({ field, label }) => (
                        <div key={field}>
                          <p className="text-xs text-gray-400 mb-1 text-center">{label}</p>
                          <input
                            type="number"
                            min="0"
                            step={field === 'calories' ? '1' : '0.1'}
                            value={(form as Record<string, string>)[field]}
                            onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                            placeholder="0"
                            className="w-full px-2 py-2 text-sm text-center border border-gray-200 rounded-xl bg-white focus:outline-none focus:border-blue-400"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <button onClick={addFood} disabled={!form.name.trim() || saving}
                    className="w-full py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 active:scale-[0.99] transition-all disabled:opacity-50">
                    {saving ? 'Adding…' : `Add to ${meal.label}`}
                  </button>
                </div>
              )}
            </div>
          )
        })}

        {/* Meal plan upsell */}
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center gap-3">
          <span className="text-2xl flex-shrink-0">🥗</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-green-800">Need meal ideas?</p>
            <p className="text-xs text-green-600">Get a 7-day AI plan with calculated macros</p>
          </div>
          <Link href="/nutrition" className="text-sm font-bold text-green-700 flex-shrink-0">Plan →</Link>
        </div>

      </main>
    </div>
  )
}
