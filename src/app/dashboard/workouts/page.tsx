'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/src/lib/supabase/client'
import Link from 'next/link'
import { Plus, Dumbbell, Calendar, Trash2 } from 'lucide-react'

interface Workout {
  id: string
  name: string
  description: string
  created_at: string
  workout_exercises: {
    id: string
    name: string
    sets: number
    reps: number
    rest_seconds: number
    exercise_id: string
    exercises: {
      muscle_group: string
    }[]
  }[]
}

export default function WorkoutsPage() {
  const supabase = createClient()
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [loading, setLoading] = useState(true)

  const fetchWorkouts = async () => {
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData?.user?.id

    if (!userId) return

    const { data, error } = await supabase
      .from('workouts')
      .select(`
        id,
        name,
        description,
        created_at,
        workout_exercises (
          id,
          name,
          sets,
          reps,
          rest_seconds,
          exercise_id,
          exercises (
            muscle_group
          )
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching workouts:', error)
    } else {
      setWorkouts(data || [])
    }
    setLoading(false)
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchWorkouts()
    }, 0)

    return () => clearTimeout(timer)
  }, [])

  const deleteWorkout = async (id: string) => {
    if (!confirm('Are you sure you want to delete this workout?')) return

    const { error } = await supabase
      .from('workouts')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting workout:', error)
      alert('Failed to delete workout')
    } else {
      setWorkouts(workouts.filter(w => w.id !== id))
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <Link href="/dashboard" className="text-3xl">
                💪
              </Link>
              <h1 className="text-2xl font-bold text-gray-900">My Workouts</h1>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/dashboard"
                className="text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors"
              >
                ← Back to Dashboard
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Create workout action placed above the list */}
        <div className="mb-6 flex justify-end items-center">
          <div className="w-full sm:w-auto flex justify-end">
            <Link
              href="/dashboard/workouts/new"
              className="inline-flex flex-row items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold flex-shrink-0 whitespace-nowrap"
            >
              <Plus className="w-5 h-5 inline-block" />
              <span className="leading-none">Create Workout</span>
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Loading workouts...</p>
          </div>
        ) : workouts.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="text-6xl mb-4">🏋️‍♂️</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">No Workouts Yet</h2>
            <p className="text-gray-600 mb-6">Create your first workout to get started!</p>
            <Link
              href="/dashboard/workouts/new"
              className="inline-flex flex-row items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold whitespace-nowrap"
            >
              <Plus className="w-5 h-5 inline-block" />
              <span className="leading-none">Create Your First Workout</span>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {workouts.map((workout) => (
              <div
                key={workout.id}
                className="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow overflow-hidden"
              >
                {/* Workout Header */}
                <div className="p-6 border-b border-gray-100">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-xl font-bold text-gray-900">{workout.name}</h3>
                    <button
                      onClick={() => deleteWorkout(workout.id)}
                      className="text-red-500 hover:text-red-700 transition-colors"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                  {workout.description && (
                    <p className="text-sm text-gray-600">{workout.description}</p>
                  )}
                  <div className="flex items-center gap-2 mt-3 text-xs text-gray-500">
                    <Calendar className="w-4 h-4" />
                    {new Date(workout.created_at).toLocaleDateString()}
                  </div>
                </div>

                {/* Exercises List */}
                <div className="p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Dumbbell className="w-4 h-4 text-gray-600" />
                    <span className="text-sm font-semibold text-gray-700">
                      {workout.workout_exercises.length} Exercise{workout.workout_exercises.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {workout.workout_exercises.slice(0, 3).map((exercise) => (
                      <div
                        key={exercise.id}
                        className="flex justify-between items-center text-sm"
                      >
                        <div>
                          <p className="font-medium text-gray-900">{exercise.name}</p>
                          <p className="text-xs text-gray-500">
                            {exercise.sets} sets × {exercise.reps} reps
                          </p>
                        </div>
                        {exercise.exercises && exercise.exercises.length > 0 && (
                          <span className="text-xs px-2 py-1 bg-purple-100 text-purple-800 rounded-full">
                            {exercise.exercises.map(e => e.muscle_group).join(', ')}
                          </span>
                        )}
                      </div>
                    ))}
                    {workout.workout_exercises.length > 3 && (
                      <p className="text-xs text-gray-500 text-center pt-2">
                        +{workout.workout_exercises.length - 3} more
                      </p>
                    )}
                  </div>
                </div>

                {/* Action Button */}
                <div className="p-4 bg-gray-50 border-t border-gray-100">
                  <Link
                    href={`/dashboard/workouts/${workout.id}`}
                    className="block w-full px-4 py-2 bg-blue-600 text-white text-center rounded-lg hover:bg-blue-700 transition-colors font-semibold"
                  >
                    Start Workout
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}