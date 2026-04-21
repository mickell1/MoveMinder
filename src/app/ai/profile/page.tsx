'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/src/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AppHeader } from '@/src/components/AppHeader'

export default function AIProfilePage() {
  const supabase = createClient()
  const router = useRouter()

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  const [heightCm, setHeightCm] = useState('')
  const [age, setAge] = useState('')
  const [sex, setSex] = useState('')
  const [activityLevel, setActivityLevel] = useState('')
  const [dietary, setDietary] = useState<string[]>([])

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data } = await supabase.from('profiles').select('height_cm, age, sex, activity_level, dietary_preferences').eq('id', user.id).single()
      if (data) {
        if (data.height_cm) setHeightCm(String(data.height_cm))
        if (data.age) setAge(String(data.age))
        if (data.sex) setSex(data.sex)
        if (data.activity_level) setActivityLevel(data.activity_level)
        if (data.dietary_preferences?.length) setDietary(data.dietary_preferences)
      }
      setLoading(false)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function toggleDietary(val: string) {
    setDietary(d => d.includes(val) ? d.filter(x => x !== val) : [...d, val])
  }

  async function save() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('profiles').upsert({
      id: user.id,
      height_cm: heightCm ? parseFloat(heightCm) : null,
      age: age ? parseInt(age) : null,
      sex: sex || null,
      activity_level: activityLevel || null,
      dietary_preferences: dietary,
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-gray-600">Loading...</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader title="MoveMinder" />

      <main className="max-w-xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI Coach Profile</h1>
          <p className="text-sm text-gray-500 mt-1">These details let the AI personalise your workouts and meal plans accurately.</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-5">

          {/* Height */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Height (cm)</label>
            <input type="number" value={heightCm} onChange={e => setHeightCm(e.target.value)} placeholder="e.g. 178"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-400" />
          </div>

          {/* Age */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Age</label>
            <input type="number" value={age} onChange={e => setAge(e.target.value)} placeholder="e.g. 28"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-400" />
          </div>

          {/* Sex */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Sex</label>
            <div className="flex gap-2">
              {[{ v: 'male', l: 'Male' }, { v: 'female', l: 'Female' }, { v: 'other', l: 'Other' }].map(o => (
                <button key={o.v} onClick={() => setSex(o.v)}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium border-2 transition-colors ${sex === o.v ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600'}`}>
                  {o.l}
                </button>
              ))}
            </div>
          </div>

          {/* Activity level */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Daily activity level</label>
            <div className="space-y-2">
              {[
                { v: 'sedentary', l: 'Sedentary', d: 'Desk job, little movement' },
                { v: 'light', l: 'Lightly active', d: 'Light exercise 1-3 days/week' },
                { v: 'moderate', l: 'Moderately active', d: 'Exercise 3-5 days/week' },
                { v: 'active', l: 'Very active', d: 'Hard exercise 6-7 days/week' },
                { v: 'very_active', l: 'Extra active', d: 'Physical job + daily training' },
              ].map(o => (
                <button key={o.v} onClick={() => setActivityLevel(o.v)}
                  className={`w-full px-4 py-3 rounded-xl text-left border-2 transition-colors ${activityLevel === o.v ? 'border-blue-600 bg-blue-50' : 'border-gray-200'}`}>
                  <p className={`text-sm font-semibold ${activityLevel === o.v ? 'text-blue-700' : 'text-gray-800'}`}>{o.l}</p>
                  <p className="text-xs text-gray-500">{o.d}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Dietary preferences */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Dietary preferences <span className="font-normal text-gray-400">(select all that apply)</span></label>
            <div className="flex flex-wrap gap-2">
              {['Vegetarian', 'Vegan', 'Gluten-free', 'Dairy-free', 'No pork', 'Halal', 'Kosher', 'Nut-free'].map(d => (
                <button key={d} onClick={() => toggleDietary(d)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border-2 transition-colors ${dietary.includes(d) ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600'}`}>
                  {d}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button onClick={save} disabled={saving}
          className="w-full py-4 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50">
          {saved ? '✓ Saved!' : saving ? 'Saving…' : 'Save Profile'}
        </button>

        <Link href="/ai" className="block text-center text-sm text-blue-600 font-medium">
          ← Back to AI Coach
        </Link>
      </main>
    </div>
  )
}
