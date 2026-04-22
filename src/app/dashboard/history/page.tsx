'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/src/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AppHeader } from '@/src/components/AppHeader'

type WorkoutSession = {
  id: string
  workout_id: string
  started_at: string
  completed_at: string
  duration_minutes: number
  workout: { name: string }
  sets_count?: number
  total_volume?: number
}

type WorkoutSet = { reps: number; weight: number }

export default function HistoryPage() {
  const router = useRouter()
  const supabase = createClient()

  const [sessions, setSessions] = useState<WorkoutSession[]>([])
  const [pbSessionIds, setPbSessionIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'week' | 'month'>('all')

  useEffect(() => {
    async function loadHistory() {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      let query = supabase
        .from('workout_sessions')
        .select('*, workout:workouts(name)')
        .eq('user_id', user.id)
        .order('completed_at', { ascending: false })

      if (filter === 'week') {
        const d = new Date(); d.setDate(d.getDate() - 7)
        query = query.gte('completed_at', d.toISOString())
      } else if (filter === 'month') {
        const d = new Date(); d.setMonth(d.getMonth() - 1)
        query = query.gte('completed_at', d.toISOString())
      }

      const { data, error } = await query
      if (error || !data) { setLoading(false); return }

      // Load set stats per session
      const sessionsWithStats = await Promise.all(
        data.map(async (session: WorkoutSession) => {
          const { data: setsData } = await supabase
            .from('workout_sets').select('reps, weight').eq('session_id', session.id)
          const setsCount = setsData?.length ?? 0
          const totalVolume = setsData?.reduce((sum: number, s: WorkoutSet) => sum + s.reps * s.weight, 0) ?? 0
          return { ...session, sets_count: setsCount, total_volume: Math.round(totalVolume) }
        })
      )

      setSessions(sessionsWithStats as WorkoutSession[])

      // Find which sessions set a personal best
      if (data.length > 0) {
        const sessionIds = data.map((s: WorkoutSession) => s.id)
        const { data: pbData } = await supabase
          .from('personal_bests')
          .select('session_id')
          .eq('user_id', user.id)
          .in('session_id', sessionIds)
        setPbSessionIds(new Set(pbData?.map(p => p.session_id).filter(Boolean) ?? []))
      }

      setLoading(false)
    }
    loadHistory()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter])

  const totalWorkouts = sessions.length
  const totalMinutes = sessions.reduce((sum, s) => sum + (s.duration_minutes ?? 0), 0)
  const totalVolume = sessions.reduce((sum, s) => sum + (s.total_volume ?? 0), 0)

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-lg text-gray-600">Loading history…</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader title="MoveMinder" />

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Workout History</h1>
            <p className="text-sm text-gray-500 mt-0.5">Your training log</p>
          </div>
          <Link href="/dashboard" className="text-sm text-blue-600 font-medium">← Dashboard</Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Workouts', value: totalWorkouts, icon: '💪', color: 'from-blue-500 to-blue-600' },
            { label: 'Minutes', value: totalMinutes, icon: '⏱️', color: 'from-green-500 to-green-600' },
            { label: 'Volume', value: totalVolume.toLocaleString(), icon: '🏋️', color: 'from-purple-500 to-purple-600' },
          ].map(s => (
            <div key={s.label} className={`bg-gradient-to-br ${s.color} rounded-2xl p-4 text-white`}>
              <div className="text-2xl mb-1">{s.icon}</div>
              <div className="text-xl font-bold">{s.value}</div>
              <div className="text-xs opacity-80 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Filter tabs */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex overflow-hidden">
          {(['all', 'week', 'month'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`flex-1 py-3 text-sm font-semibold transition-colors ${filter === f ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' : 'text-gray-500 hover:text-gray-800'}`}>
              {f === 'all' ? 'All Time' : f === 'week' ? 'This Week' : 'This Month'}
            </button>
          ))}
        </div>

        {/* Sessions list */}
        {sessions.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
            <div className="text-5xl mb-3">🏃</div>
            <h3 className="font-bold text-gray-900 mb-1">No workouts yet</h3>
            <p className="text-sm text-gray-500 mb-5">
              {filter === 'all' ? 'Start your first workout to build your history.' : 'No workouts in this period.'}
            </p>
            <Link href="/dashboard/workouts"
              className="inline-block px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold">
              Browse Workouts
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map(session => {
              const d = new Date(session.completed_at)
              const dateStr = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
              const timeStr = d.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' })
              const hasPB = pbSessionIds.has(session.id)

              return (
                <Link key={session.id} href={`/dashboard/history/${session.id}`}
                  className="block bg-white rounded-2xl border border-gray-100 shadow-sm p-4 hover:border-blue-200 hover:shadow-md transition-all active:scale-[0.99]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-11 h-11 rounded-full flex items-center justify-center text-xl flex-shrink-0 ${hasPB ? 'bg-amber-100' : 'bg-blue-100'}`}>
                        {hasPB ? '💥' : '💪'}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-gray-900 truncate">{session.workout?.name ?? 'Workout'}</h3>
                          {hasPB && (
                            <span className="flex-shrink-0 text-xs font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">New PB!</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500">{dateStr} · {timeStr}</p>
                      </div>
                    </div>
                    <svg className="w-5 h-5 text-gray-300 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>

                  <div className="flex gap-4 mt-3 text-xs text-gray-600 pl-14">
                    <span>⏱️ <span className="font-semibold">{session.duration_minutes}min</span></span>
                    <span>✓ <span className="font-semibold">{session.sets_count} sets</span></span>
                    <span>🏋️ <span className="font-semibold">{session.total_volume?.toLocaleString()} kg</span></span>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
