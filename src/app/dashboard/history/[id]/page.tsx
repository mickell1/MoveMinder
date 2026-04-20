'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/src/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { ReactionBar } from '@/src/components/social/ReactionBar'

type WorkoutSession = {
  id: string
  workout_id: string
  started_at: string
  completed_at: string
  duration_minutes: number
  workout: {
    name: string
    description: string | null
  }
}

type SetLog = {
  id: string
  set_number: number
  reps: number
  weight: number
  exercise_id: string
}

type WorkoutExercise = {
  id: string
  name: string
}

type ExerciseGroup = {
  exerciseId: string
  exerciseName: string
  sets: SetLog[]
  totalVolume: number
  avgWeight: number
}

export default function SessionDetailPage() {
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()
  const sessionId = params?.id as string | undefined

  const [session, setSession] = useState<WorkoutSession | null>(null)
  const [exerciseGroups, setExerciseGroups] = useState<ExerciseGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string>('')

  useEffect(() => {
    if (!sessionId) return

    async function loadSessionDetail() {
      const userResponse = await supabase.auth.getUser()
      const user = userResponse.data?.user

      if (!user) {
        router.push('/login')
        return
      }
    setCurrentUserId(user.id)
      // Load session
      const sessionResponse = await supabase
        .from('workout_sessions')
        .select(`
          *,
          workout:workouts(name, description)
        `)
        .eq('id', sessionId)
        .eq('user_id', user.id)
        .single()

      if (sessionResponse.error || !sessionResponse.data) {
        console.error('Error loading session:', sessionResponse.error)
        router.push('/dashboard/history')
        return
      }

      setSession(sessionResponse.data as WorkoutSession)

      // Load all sets
      const setsResponse = await supabase
        .from('workout_sets')
        .select('*')
        .eq('session_id', sessionId)
        .order('exercise_id')
        .order('set_number')

      if (setsResponse.error) {
        console.error('Error loading sets:', setsResponse.error)
        setLoading(false)
        return
      }

      if (!setsResponse.data || setsResponse.data.length === 0) {
        setLoading(false)
        return
      }

      // Get unique exercise IDs
      const exerciseIds = [...new Set(setsResponse.data.map((set: SetLog) => set.exercise_id))]

      // Load exercise names
      const exercisesResponse = await supabase
        .from('workout_exercises')
        .select('id, name')
        .in('id', exerciseIds)

      // Create a map of exercise IDs to names
      const exerciseMap = new Map<string, string>()
      exercisesResponse.data?.forEach((ex: WorkoutExercise) => {
        exerciseMap.set(ex.id, ex.name)
      })

      // Group sets by exercise
      const grouped: Map<string, ExerciseGroup> = new Map()

      setsResponse.data.forEach((set: SetLog) => {
        const exerciseName = exerciseMap.get(set.exercise_id) || 'Unknown Exercise'
        
        if (!grouped.has(set.exercise_id)) {
          grouped.set(set.exercise_id, {
            exerciseId: set.exercise_id,
            exerciseName,
            sets: [],
            totalVolume: 0,
            avgWeight: 0,
          })
        }

        const group = grouped.get(set.exercise_id)!
        group.sets.push(set as SetLog)
        group.totalVolume += set.reps * set.weight
      })

      // Calculate average weight for each exercise
      const groupsArray = Array.from(grouped.values()).map((group: ExerciseGroup) => ({
        ...group,
        avgWeight: group.sets.length > 0 
          ? group.sets.reduce((sum: number, set: SetLog) => sum + set.weight, 0) / group.sets.length 
          : 0,
      }))

      setExerciseGroups(groupsArray)
      setLoading(false)
    }

    loadSessionDetail()
  }, [sessionId, router, supabase])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-xl text-gray-600">Loading session...</div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  const completedDate = new Date(session.completed_at)
  const dateStr = completedDate.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
  const timeStr = completedDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })

  const totalSets = exerciseGroups.reduce((sum: number, group: ExerciseGroup) => sum + group.sets.length, 0)
  const totalVolume = exerciseGroups.reduce((sum: number, group: ExerciseGroup) => sum + group.totalVolume, 0)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <Link
                href="/dashboard/history"
                className="text-sm text-gray-600 hover:text-gray-900 mb-2 inline-block"
              >
                ← Back to History
              </Link>
              <h1 className="text-3xl font-bold text-gray-900">{session.workout?.name}</h1>
              <p className="text-gray-600 mt-1">
                {dateStr} at {timeStr}
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Session Summary */}
        <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl shadow-lg p-6 text-white mb-6">
          <h2 className="text-xl font-bold mb-4">Workout Summary</h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="text-3xl font-bold">{session.duration_minutes}</div>
              <div className="text-blue-100 text-sm">Minutes</div>
            </div>
            <div>
              <div className="text-3xl font-bold">{totalSets}</div>
              <div className="text-blue-100 text-sm">Total Sets</div>
            </div>
            <div>
              <div className="text-3xl font-bold">{Math.round(totalVolume).toLocaleString()}</div>
              <div className="text-blue-100 text-sm">lbs Lifted</div>
            </div>
          </div>
        </div>

        {/* Description */}
        {session.workout?.description && (
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 mb-6">
            <h3 className="text-sm font-medium text-gray-600 mb-2">Description</h3>
            <p className="text-gray-900">{session.workout.description}</p>
          </div>
        )}

        {/* Exercises Performed */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Exercises ({exerciseGroups.length})
          </h2>

          {exerciseGroups.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No exercise data recorded</p>
            </div>
          ) : (
            <div className="space-y-6">
              {exerciseGroups.map((group, index) => (
                <div key={group.exerciseId} className="border-b border-gray-200 pb-6 last:border-b-0 last:pb-0">
                  {/* Exercise Header */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-gray-900">{group.exerciseName}</h3>
                      <p className="text-sm text-gray-600">
                        {group.sets.length} sets • {Math.round(group.totalVolume).toLocaleString()} lbs total • Avg {Math.round(group.avgWeight)} lbs
                      </p>
                    </div>
                  </div>

                  {/* Sets Table */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="grid grid-cols-3 gap-4 mb-2 text-xs font-medium text-gray-600 uppercase">
                      <div>Set</div>
                      <div className="text-center">Reps</div>
                      <div className="text-right">Weight</div>
                    </div>
                    <div className="space-y-2">
                      {group.sets.map((set) => (
                        <div key={set.id} className="grid grid-cols-3 gap-4 py-2 border-t border-gray-200">
                          <div className="font-semibold text-gray-900">Set {set.set_number}</div>
                          <div className="text-center font-bold text-gray-900">{set.reps}</div>
                          <div className="text-right font-bold text-gray-900">{set.weight} lbs</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Reactions */}
        {currentUserId && (
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 mb-6">
            <h3 className="text-sm font-medium text-gray-600 mb-3">Reactions</h3>
            <ReactionBar sessionId={sessionId!} userId={currentUserId} />
          </div>
        )}
 

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Link
            href="/dashboard/history"
            className="flex-1 px-6 py-4 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors text-center"
          >
            Back to History
          </Link>
          <Link
            href={`/dashboard/workouts/${session.workout_id}`}
            className="flex-1 px-6 py-4 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors text-center"
          >
            View Workout Plan
          </Link>
        </div>
      </main>
    </div>
  )
}