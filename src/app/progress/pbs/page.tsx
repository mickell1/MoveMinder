'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/src/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AppHeader } from '@/src/components/AppHeader'

type PB = {
  id: string
  exercise_id: string
  exercise_name: string
  muscle_group: string | null
  weight_kg: number | null
  reps: number | null
  estimated_1rm: number | null
  achieved_at: string
}

const muscleEmoji: Record<string, string> = {
  chest: '💪', back: '🦾', legs: '🦵', shoulders: '🏋️', arms: '💪', core: '🔥',
  quads: '🦵', hamstrings: '🦵', glutes: '🍑', calves: '🦵', biceps: '💪', triceps: '💪',
  'upper back': '🦾', 'lower back': '🦾',
}

const muscleOrder = ['chest', 'back', 'shoulders', 'arms', 'biceps', 'triceps', 'legs', 'quads', 'hamstrings', 'glutes', 'calves', 'core', 'upper back', 'lower back']

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function PersonalBestsPage() {
  const router = useRouter()
  const supabase = createClient()

  const [pbs, setPbs] = useState<PB[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data } = await supabase
        .from('personal_bests')
        .select('id, exercise_id, exercise_name, muscle_group, weight_kg, reps, estimated_1rm, achieved_at')
        .eq('user_id', user.id)
        .order('estimated_1rm', { ascending: false })

      setPbs((data ?? []) as PB[])
      setLoading(false)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Unique muscle groups in the data
  const muscleGroups = [...new Set(pbs.map(p => p.muscle_group).filter(Boolean) as string[])]
    .sort((a, b) => {
      const ai = muscleOrder.indexOf(a)
      const bi = muscleOrder.indexOf(b)
      if (ai === -1 && bi === -1) return a.localeCompare(b)
      if (ai === -1) return 1
      if (bi === -1) return -1
      return ai - bi
    })

  const filtered = filter === 'all' ? pbs : pbs.filter(p => p.muscle_group === filter)

  // Group by muscle group
  const grouped = new Map<string, PB[]>()
  for (const pb of filtered) {
    const group = pb.muscle_group ?? 'other'
    if (!grouped.has(group)) grouped.set(group, [])
    grouped.get(group)!.push(pb)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-lg text-gray-600">Loading personal bests…</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader title="MoveMinder" />

      <main className="max-w-xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/progress" className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Personal Bests</h1>
            <p className="text-sm text-gray-500 mt-0.5">Your all-time records, grouped by muscle</p>
          </div>
        </div>

        {pbs.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
            <div className="text-5xl mb-3">🏆</div>
            <h2 className="font-bold text-gray-900 mb-1">No personal bests yet</h2>
            <p className="text-sm text-gray-500 mb-5">Finish a workout with weight and reps logged to set your first PB.</p>
            <Link href="/dashboard/workouts"
              className="inline-block px-5 py-2.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors text-sm">
              Go to Workouts
            </Link>
          </div>
        ) : (
          <>
            {/* Summary banner */}
            <div className="bg-gradient-to-r from-amber-400 to-orange-500 rounded-2xl p-4 text-white flex items-center gap-4">
              <div className="text-4xl">🏆</div>
              <div>
                <p className="font-bold text-lg">{pbs.length} personal best{pbs.length !== 1 ? 's' : ''}</p>
                <p className="text-sm text-amber-100">across {muscleGroups.length} muscle group{muscleGroups.length !== 1 ? 's' : ''}</p>
              </div>
            </div>

            {/* Muscle group filter pills */}
            {muscleGroups.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
                <button
                  onClick={() => setFilter('all')}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${filter === 'all' ? 'bg-amber-500 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>
                  All
                </button>
                {muscleGroups.map(mg => (
                  <button key={mg} onClick={() => setFilter(mg)}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold capitalize transition-colors ${filter === mg ? 'bg-amber-500 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>
                    {muscleEmoji[mg] ?? '💪'} {mg}
                  </button>
                ))}
              </div>
            )}

            {/* Grouped PB cards */}
            {[...grouped.entries()].map(([group, items]) => (
              <div key={group}>
                <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 capitalize flex items-center gap-1.5">
                  <span>{muscleEmoji[group] ?? '💪'}</span>
                  <span>{group}</span>
                </h2>
                <div className="space-y-2">
                  {items.map(pb => (
                    <div key={pb.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900 truncate">{pb.exercise_name}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{formatDate(pb.achieved_at)}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          {pb.weight_kg !== null && pb.reps !== null ? (
                            <>
                              <p className="text-lg font-bold text-amber-600">{pb.weight_kg}kg × {pb.reps}</p>
                              {pb.estimated_1rm !== null && (
                                <p className="text-xs text-gray-400">~{pb.estimated_1rm}kg 1RM</p>
                              )}
                            </>
                          ) : (
                            <p className="text-sm text-gray-400">—</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}
      </main>
    </div>
  )
}
