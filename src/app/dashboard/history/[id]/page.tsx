'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/src/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { ReactionBar } from '@/src/components/social/ReactionBar'
import { AppHeader } from '@/src/components/AppHeader'

type WorkoutSession = {
  id: string
  workout_id: string
  started_at: string
  completed_at: string
  duration_minutes: number
  workout: { name: string; description: string | null }
}

type SetLog = { id: string; set_number: number; reps: number; weight: number; exercise_id: string }

type ExerciseGroup = {
  exerciseId: string
  exerciseName: string
  sets: SetLog[]
  totalVolume: number
  avgWeight: number
}

type PBRecord = { exercise_name: string; weight_kg: number | null; reps: number | null; estimated_1rm: number | null }

function epley1RM(weight: number, reps: number) {
  if (weight <= 0 || reps <= 0) return 0
  return weight * (1 + reps / 30)
}

export default function SessionDetailPage() {
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()
  const sessionId = params?.id as string | undefined

  const [session, setSession] = useState<WorkoutSession | null>(null)
  const [exerciseGroups, setExerciseGroups] = useState<ExerciseGroup[]>([])
  const [sessionPBs, setSessionPBs] = useState<Map<string, PBRecord>>(new Map())
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState('')

  useEffect(() => {
    if (!sessionId) return

    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setCurrentUserId(user.id)

      const { data: sessionData, error: sessionErr } = await supabase
        .from('workout_sessions')
        .select('*, workout:workouts(name, description)')
        .eq('id', sessionId)
        .eq('user_id', user.id)
        .single()

      if (sessionErr || !sessionData) { router.push('/dashboard/history'); return }
      setSession(sessionData as WorkoutSession)

      const { data: setsData, error: setsErr } = await supabase
        .from('workout_sets')
        .select('*')
        .eq('session_id', sessionId)
        .order('exercise_id')
        .order('set_number')

      if (setsErr || !setsData?.length) { setLoading(false); return }

      const exerciseIds = [...new Set(setsData.map((s: SetLog) => s.exercise_id))]
      const { data: exData } = await supabase
        .from('workout_exercises').select('id, name').in('id', exerciseIds)

      const exMap = new Map<string, string>((exData ?? []).map(e => [e.id, e.name]))

      const grouped = new Map<string, ExerciseGroup>()
      for (const set of setsData as SetLog[]) {
        const name = exMap.get(set.exercise_id) ?? 'Unknown Exercise'
        if (!grouped.has(set.exercise_id)) {
          grouped.set(set.exercise_id, { exerciseId: set.exercise_id, exerciseName: name, sets: [], totalVolume: 0, avgWeight: 0 })
        }
        const g = grouped.get(set.exercise_id)!
        g.sets.push(set)
        g.totalVolume += set.reps * set.weight
      }

      const groups = Array.from(grouped.values()).map(g => ({
        ...g,
        avgWeight: g.sets.reduce((s, set) => s + set.weight, 0) / (g.sets.length || 1),
      }))
      setExerciseGroups(groups)

      // Load PBs set in this session
      const { data: pbData } = await supabase
        .from('personal_bests')
        .select('exercise_name, weight_kg, reps, estimated_1rm')
        .eq('user_id', user.id)
        .eq('session_id', sessionId)

      const pbMap = new Map<string, PBRecord>((pbData ?? []).map(p => [p.exercise_name, p]))
      setSessionPBs(pbMap)

      setLoading(false)
    }

    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-lg text-gray-600">Loading session…</div>
    </div>
  )
  if (!session) return null

  const d = new Date(session.completed_at)
  const dateStr = d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const timeStr = d.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' })
  const totalSets = exerciseGroups.reduce((s, g) => s + g.sets.length, 0)
  const totalVolume = exerciseGroups.reduce((s, g) => s + g.totalVolume, 0)
  const hasPBs = sessionPBs.size > 0

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader title="MoveMinder" />

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* Back + title */}
        <div>
          <Link href="/dashboard/history" className="text-sm text-blue-600 font-medium">← Back to History</Link>
          <div className="flex items-center gap-3 mt-2">
            <h1 className="text-2xl font-bold text-gray-900">{session.workout?.name}</h1>
            {hasPBs && <span className="text-sm font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">💥 New PB!</span>}
          </div>
          <p className="text-sm text-gray-500 mt-0.5">{dateStr} · {timeStr}</p>
        </div>

        {/* PB celebration banner */}
        {hasPBs && (
          <div className="bg-gradient-to-r from-amber-400 to-orange-500 rounded-2xl p-4 text-white">
            <p className="font-bold text-lg mb-1">Personal Best{sessionPBs.size > 1 ? 's' : ''} Set! 💥</p>
            <div className="space-y-0.5">
              {[...sessionPBs.values()].map(pb => (
                <p key={pb.exercise_name} className="text-sm text-amber-100">
                  {pb.exercise_name} — {pb.weight_kg}kg × {pb.reps} reps
                  {pb.estimated_1rm ? ` (~${pb.estimated_1rm}kg 1RM)` : ''}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* Summary */}
        <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl p-5 text-white">
          <p className="text-sm font-semibold text-blue-200 mb-3">Workout Summary</p>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Minutes', value: session.duration_minutes },
              { label: 'Total Sets', value: totalSets },
              { label: 'Volume (kg)', value: Math.round(totalVolume).toLocaleString() },
            ].map(s => (
              <div key={s.label}>
                <div className="text-2xl font-bold">{s.value}</div>
                <div className="text-blue-200 text-xs mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Description */}
        {session.workout?.description && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Description</p>
            <p className="text-sm text-gray-700">{session.workout.description}</p>
          </div>
        )}

        {/* Exercises */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <h2 className="font-bold text-gray-900 mb-4">Exercises ({exerciseGroups.length})</h2>

          {exerciseGroups.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No exercise data recorded</p>
          ) : (
            <div className="space-y-5">
              {exerciseGroups.map((group, i) => {
                const pb = sessionPBs.get(group.exerciseName)
                const bestSet = pb ? group.sets.reduce((best, set) => {
                  return epley1RM(set.weight, set.reps) > epley1RM(best.weight, best.reps) ? set : best
                }, group.sets[0]) : null

                return (
                  <div key={group.exerciseId} className={`pb-5 border-b border-gray-100 last:border-0 last:pb-0 ${pb ? 'relative' : ''}`}>
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${pb ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-600'}`}>
                        {pb ? '💥' : i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-gray-900">{group.exerciseName}</h3>
                          {pb && (
                            <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">New PB!</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500">
                          {group.sets.length} sets · {Math.round(group.totalVolume)} kg total · avg {Math.round(group.avgWeight)} kg
                        </p>
                      </div>
                    </div>

                    <div className={`rounded-xl p-3 ${pb ? 'bg-amber-50' : 'bg-gray-50'}`}>
                      <div className="grid grid-cols-3 gap-2 mb-2 text-xs font-semibold text-gray-400 uppercase">
                        <div>Set</div>
                        <div className="text-center">Reps</div>
                        <div className="text-right">Weight</div>
                      </div>
                      <div className="space-y-1.5">
                        {group.sets.map(set => {
                          const isBestSet = bestSet && set.id === bestSet.id
                          return (
                            <div key={set.id}
                              className={`grid grid-cols-3 gap-2 py-1.5 border-t border-gray-200 first:border-0 ${isBestSet ? 'font-bold' : ''}`}>
                              <div className={`text-sm ${isBestSet ? 'text-amber-600' : 'text-gray-600'}`}>
                                {isBestSet ? '💥' : `Set ${set.set_number}`}
                              </div>
                              <div className={`text-center text-sm font-bold ${isBestSet ? 'text-amber-700' : 'text-gray-900'}`}>{set.reps}</div>
                              <div className={`text-right text-sm font-bold ${isBestSet ? 'text-amber-700' : 'text-gray-900'}`}>{set.weight} kg</div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Reactions */}
        {currentUserId && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Reactions</p>
            <ReactionBar sessionId={sessionId!} userId={currentUserId} />
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pb-6">
          <Link href="/dashboard/history"
            className="flex-1 py-3.5 bg-gray-100 text-gray-700 rounded-xl font-semibold text-center hover:bg-gray-200 transition-colors text-sm">
            Back to History
          </Link>
          <Link href={`/dashboard/workouts/${session.workout_id}`}
            className="flex-1 py-3.5 bg-blue-600 text-white rounded-xl font-semibold text-center hover:bg-blue-700 transition-colors text-sm">
            View Workout
          </Link>
        </div>
      </main>
    </div>
  )
}
