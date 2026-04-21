'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AppHeader } from '@/src/components/AppHeader'

type SavedWorkout = { id: string; name: string; week: number | null; day: number | null; exerciseCount: number }

const focusOptions = [
  { v: 'Full Body', icon: '💪', d: 'All muscle groups' },
  { v: 'Upper Body', icon: '🏋️', d: 'Chest, back, shoulders, arms' },
  { v: 'Lower Body', icon: '🦵', d: 'Quads, hamstrings, glutes, calves' },
  { v: 'Push', icon: '↗️', d: 'Chest, shoulders, triceps' },
  { v: 'Pull', icon: '↙️', d: 'Back, biceps, rear delts' },
  { v: 'Core & Cardio', icon: '🔥', d: 'Abs, HIIT, conditioning' },
]

export default function AIWorkoutPage() {
  const router = useRouter()
  const [type, setType] = useState<'single' | 'program'>('single')
  const [focus, setFocus] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<SavedWorkout[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function generate() {
    if (!focus) return
    setLoading(true)
    setError(null)
    setResult(null)

    const res = await fetch('/api/ai/workout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ focus, type }),
    })
    const data = await res.json()
    setLoading(false)

    if (!res.ok || data.error) {
      setError(data.error ?? 'Something went wrong')
      return
    }
    setResult(data.workouts)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader title="MoveMinder" links={[{ href: '/ai', label: 'AI Coach' }, { href: '/dashboard', label: 'Dashboard' }]} />

      <main className="max-w-xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI Workout Generator</h1>
          <p className="text-sm text-gray-500 mt-1">Claude builds a personalised workout based on your profile and goals.</p>
        </div>

        {result ? (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-center">
              <div className="text-3xl mb-2">🎉</div>
              <p className="font-bold text-green-800">{result.length === 1 ? 'Workout created!' : `${result.length}-workout program created!`}</p>
              <p className="text-sm text-green-700 mt-1">Saved to your workout library</p>
            </div>

            <div className="space-y-2">
              {result.map(w => (
                <div key={w.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between">
                  <div>
                    {w.week && <p className="text-xs text-gray-400 font-medium">Week {w.week} · Day {w.day}</p>}
                    <p className="font-semibold text-gray-900">{w.name}</p>
                    <p className="text-xs text-gray-500">{w.exerciseCount} exercises</p>
                  </div>
                  <button onClick={() => router.push(`/dashboard/workouts/${w.id}`)}
                    className="text-sm text-blue-600 font-semibold px-3 py-1.5 bg-blue-50 rounded-lg">
                    Start →
                  </button>
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <button onClick={() => { setResult(null); setFocus('') }}
                className="flex-1 py-3 border border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors">
                Generate Another
              </button>
              <Link href="/dashboard/workouts"
                className="flex-1 py-3 bg-blue-600 text-white font-semibold rounded-xl text-center hover:bg-blue-700 transition-colors">
                View Library
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* Type toggle */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <p className="text-sm font-semibold text-gray-700 mb-3">What do you want?</p>
              <div className="grid grid-cols-2 gap-2">
                {([['single', '🏋️', 'Single Workout', 'One session, ready now'], ['program', '📅', '4-Week Program', 'Progressive multi-week plan']] as const).map(([v, icon, label, desc]) => (
                  <button key={v} onClick={() => setType(v)}
                    className={`p-3 rounded-xl border-2 text-left transition-colors ${type === v ? 'border-blue-600 bg-blue-50' : 'border-gray-200'}`}>
                    <div className="text-2xl mb-1">{icon}</div>
                    <p className={`text-sm font-semibold ${type === v ? 'text-blue-700' : 'text-gray-800'}`}>{label}</p>
                    <p className="text-xs text-gray-500">{desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Focus */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <p className="text-sm font-semibold text-gray-700 mb-3">Training focus</p>
              <div className="grid grid-cols-2 gap-2">
                {focusOptions.map(o => (
                  <button key={o.v} onClick={() => setFocus(o.v)}
                    className={`p-3 rounded-xl border-2 text-left transition-colors ${focus === o.v ? 'border-blue-600 bg-blue-50' : 'border-gray-200'}`}>
                    <span className="text-xl">{o.icon}</span>
                    <p className={`text-sm font-semibold mt-1 ${focus === o.v ? 'text-blue-700' : 'text-gray-800'}`}>{o.v}</p>
                    <p className="text-xs text-gray-500">{o.d}</p>
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">{error}</div>
            )}

            <button onClick={generate} disabled={!focus || loading}
              className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-lg rounded-2xl hover:from-blue-700 hover:to-indigo-700 active:scale-95 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  {type === 'program' ? 'Building your program…' : 'Building your workout…'}
                </span>
              ) : `Generate ${type === 'program' ? '4-Week Program' : 'Workout'}`}
            </button>

            <p className="text-center text-xs text-gray-400">
              Don&apos;t see your profile yet?{' '}
              <Link href="/ai/profile" className="text-blue-500 font-medium">Complete your AI profile →</Link>
            </p>
          </>
        )}
      </main>
    </div>
  )
}
