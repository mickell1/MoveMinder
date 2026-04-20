'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/src/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type WeighIn = {
  id: string
  weight_kg: number
  logged_date: string
  notes: string | null
  share_weight: boolean
}

export default function WeighInPage() {
  const supabase = createClient()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [unit, setUnit] = useState<'kg' | 'lb'>('kg')
  const [weightInput, setWeightInput] = useState('')
  const [notes, setNotes] = useState('')
  const [shareWeight, setShareWeight] = useState(false)
  const [existingEntry, setExistingEntry] = useState<WeighIn | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const today = new Date().toLocaleDateString('en-CA')

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)

      const { data } = await supabase
        .from('weigh_ins')
        .select('*')
        .eq('user_id', user.id)
        .eq('logged_date', today)
        .maybeSingle()

      if (data) {
        setExistingEntry(data as WeighIn)
        const displayWeight = unit === 'kg'
          ? data.weight_kg
          : Math.round(data.weight_kg * 2.20462 * 10) / 10
        setWeightInput(String(displayWeight))
        setNotes(data.notes ?? '')
        setShareWeight(data.share_weight)
      }

      setLoading(false)
    }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleUnitToggle(newUnit: 'kg' | 'lb') {
    if (newUnit === unit) return
    const val = parseFloat(weightInput)
    if (!isNaN(val) && val > 0) {
      if (newUnit === 'lb') {
        setWeightInput(String(Math.round(val * 2.20462 * 10) / 10))
      } else {
        setWeightInput(String(Math.round((val / 2.20462) * 10) / 10))
      }
    }
    setUnit(newUnit)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!userId) return

    const parsed = parseFloat(weightInput)
    if (isNaN(parsed) || parsed <= 0) {
      setError('Please enter a valid weight')
      return
    }

    setSaving(true)
    setError(null)

    const weightKg = unit === 'kg' ? parsed : parsed / 2.20462

    let err = null
    if (existingEntry) {
      const { error: e } = await supabase
        .from('weigh_ins')
        .update({ weight_kg: weightKg, notes: notes || null, share_weight: shareWeight })
        .eq('id', existingEntry.id)
      err = e
    } else {
      const { error: e } = await supabase
        .from('weigh_ins')
        .insert({ user_id: userId, weight_kg: weightKg, logged_date: today, notes: notes || null, share_weight: shareWeight })
      err = e
    }

    if (err) {
      setError(err.message)
      setSaving(false)
      return
    }

    setSuccess(true)
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-xl text-gray-600">Loading...</div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-xl shadow-sm p-8 max-w-md w-full text-center border border-gray-200">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">✓</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {existingEntry ? 'Entry updated!' : 'Weighed in!'}
          </h2>
          <p className="text-gray-600 mb-6">
            {weightInput} {unit} logged for today.
          </p>
          <div className="flex flex-col gap-3">
            <Link
              href="/weigh-in/history"
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              View History
            </Link>
            <Link
              href="/dashboard"
              className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <Link href="/dashboard" className="text-gray-600 hover:text-gray-900 text-sm">← Dashboard</Link>
              <h1 className="text-xl font-bold text-gray-900">Daily Weigh-In</h1>
            </div>
            <Link href="/weigh-in/history" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
              History
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="text-center mb-6">
            <div className="text-5xl mb-3">⚖️</div>
            <h2 className="text-2xl font-bold text-gray-900">
              {existingEntry ? "Update today's entry" : "Log today's weight"}
            </h2>
            <p className="text-gray-500 text-sm mt-1">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Unit toggle */}
            <div className="flex bg-gray-100 rounded-lg p-1 gap-1">
              {(['kg', 'lb'] as const).map(u => (
                <button
                  key={u}
                  type="button"
                  onClick={() => handleUnitToggle(u)}
                  className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                    unit === u ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {u}
                </button>
              ))}
            </div>

            {/* Weight input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Weight ({unit})</label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={weightInput}
                onChange={e => setWeightInput(e.target.value)}
                placeholder={unit === 'kg' ? '70.0' : '154.0'}
                className="w-full text-4xl font-bold text-center py-4 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none"
                required
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="How are you feeling today?"
                rows={2}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none resize-none text-sm"
              />
            </div>

            {/* Share toggle */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
              <div className="flex-1 mr-4">
                <p className="font-medium text-gray-900 text-sm">Share the number with friends</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Friends always see that you weighed in — the number is private by default
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShareWeight(!shareWeight)}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
                  shareWeight ? 'bg-blue-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    shareWeight ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {error && <p className="text-red-600 text-sm text-center">{error}</p>}

            <button
              type="submit"
              disabled={saving || !weightInput}
              className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold text-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : existingEntry ? "Update today's entry" : 'Log Weight'}
            </button>
          </form>
        </div>
      </main>
    </div>
  )
}
