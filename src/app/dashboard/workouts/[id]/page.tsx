'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/src/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

type Workout = {
  id: string
  name: string
  description: string | null
  created_at: string
}

type Exercise = {
  id: string
  name: string
  sets: number
  reps: number
  rest_seconds: number
  order_index: number
}

export default function WorkoutDetailPage() {
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()
  const workoutId = params?.id as string | undefined

  const [workout, setWorkout] = useState<Workout | null>(null)
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!workoutId) return

    async function loadWorkout() {
      const { data: authData } = await supabase.auth.getUser()
      const user = authData?.user

      if (!user) {
        router.push('/login')
        return
      }

      // Load workout
      const { data: workoutData, error: workoutError } = await supabase
        .from('workouts')
        .select('*')
        .eq('id', workoutId)
        .eq('user_id', user.id)
        .single()

      if (workoutError) {
        console.error('Error loading workout:', workoutError)
        router.push('/dashboard/workouts')
        return
      }

      setWorkout(workoutData as Workout)

      // Load exercises
      const { data: exercisesData, error: exercisesError } = await supabase
        .from('workout_exercises')
        .select('*')
        .eq('workout_id', workoutId)
        .order('order_index', { ascending: true })

      if (exercisesError) {
        console.error('Error loading exercises:', exercisesError)
      } else {
        setExercises((exercisesData as Exercise[]) || [])
      }

      setLoading(false)
    }

    loadWorkout()
  }, [workoutId, router, supabase])

  const startWorkout = () => {
    if (!workoutId) return
    router.push(`/dashboard/workouts/${workoutId}/log`)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-xl text-gray-600">Loading...</div>
      </div>
    )
  }

  if (!workout) {
    return null
  }

  const totalSets = exercises.reduce((sum, ex) => sum + (ex.sets || 0), 0)
  const estimatedTime = exercises.reduce(
    (sum, ex) => sum + (ex.sets * 45) + (ex.rest_seconds * Math.max(0, ex.sets - 1)),
    0
  )
  const estimatedMinutes = Math.round(estimatedTime / 60)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard/workouts"
              className="text-gray-600 hover:text-gray-900"
            >
              ← Back
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">{workout.name}</h1>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Workout Summary */}
        <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl shadow-lg p-6 text-white mb-6">
          <h2 className="text-2xl font-bold mb-4">Workout Overview</h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="text-3xl font-bold">{exercises.length}</div>
              <div className="text-blue-100 text-sm">Exercises</div>
            </div>
            <div>
              <div className="text-3xl font-bold">{totalSets}</div>
              <div className="text-blue-100 text-sm">Total Sets</div>
            </div>
            <div>
              <div className="text-3xl font-bold">~{estimatedMinutes}</div>
              <div className="text-blue-100 text-sm">Minutes</div>
            </div>
          </div>
        </div>

        {/* Description */}
        {workout.description && (
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 mb-6">
            <h3 className="text-sm font-medium text-gray-600 mb-2">Description</h3>
            <p className="text-gray-900">{workout.description}</p>
          </div>
        )}

        {/* Exercises List */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Exercises ({exercises.length})
          </h2>

          {exercises.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-5xl mb-4">🤷</div>
              <p className="text-gray-500">No exercises in this workout</p>
            </div>
          ) : (
            <div className="space-y-3">
              {exercises.map((exercise, index) => (
                <div
                  key={exercise.id}
                  className="p-4 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    {/* Exercise Number */}
                    <div className="flex-shrink-0 w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold">
                      {index + 1}
                    </div>

                    {/* Exercise Info */}
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg text-gray-900 mb-2">
                        {exercise.name}
                      </h3>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <span className="font-medium text-gray-900">{exercise.sets}</span>
                          <span>sets</span>
                        </div>
                        <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                        <div className="flex items-center gap-1">
                          <span className="font-medium text-gray-900">{exercise.reps}</span>
                          <span>reps</span>
                        </div>
                        <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                        <div className="flex items-center gap-1">
                          <span className="font-medium text-gray-900">{exercise.rest_seconds}s</span>
                          <span>rest</span>
                        </div>
                      </div>
                    </div>

                    {/* Exercise Icon */}
                    <div className="flex-shrink-0 text-2xl">
                      💪
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Link
            href="/dashboard/workouts"
            className="flex-1 px-6 py-4 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors text-center"
          >
            Back to Workouts
          </Link>
          <button
            onClick={startWorkout}
            disabled={exercises.length === 0}
            className="flex-1 px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
          >
            <span className="flex items-center justify-center gap-2">
              <span>🔥</span>
              Start Workout
            </span>
          </button>
        </div>

        {/* Workout Stats */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-center gap-2 text-blue-800">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <p className="text-sm font-medium">
              Estimated workout time is based on 45 seconds per set plus rest periods
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
