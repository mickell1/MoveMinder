'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/src/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Workout = {
  id: string
  name: string
  description: string | null
  created_at: string
}

export default function WorkoutsPage() {
  const router = useRouter()
  const supabase = createClient()
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadWorkouts() {
      const { data: authData } = await supabase.auth.getUser()
      const user = authData?.user

      if (!user) {
        router.push('/login')
        return
      }

      const { data: workoutsData, error } = await supabase
        .from('workouts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error loading workouts:', error)
      } else {
        setWorkouts(workoutsData || [])
      }

      setLoading(false)
    }

    loadWorkouts()
  }, [router, supabase])

  const deleteWorkout = async (id: string) => {
    if (!confirm('Are you sure you want to delete this workout?')) {
      return
    }

    const { error } = await supabase
      .from('workouts')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting workout:', error)
      alert('Failed to delete workout')
    } else {
      setWorkouts(workouts.filter((w) => w.id !== id))
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-xl text-gray-600">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/dashboard"
                className="text-gray-600 hover:text-gray-900"
              >
                ← Back
              </Link>
              <h1 className="text-2xl font-bold text-gray-900">My Workouts</h1>
            </div>
            <Link
              href="/dashboard/workouts/new"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              + New Workout
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {workouts.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 border border-gray-200 text-center">
            <div className="text-6xl mb-4">🏋️</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              No workouts yet
            </h2>
            <p className="text-gray-600 mb-6">
              Create your first workout to get started!
            </p>
            <Link
              href="/dashboard/workouts/new"
              className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              Create Workout
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {workouts.map((workout) => (
              <div
                key={workout.id}
                className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-gray-900 mb-1">
                      {workout.name}
                    </h3>
                    {workout.description && (
                      <p className="text-sm text-gray-600 line-clamp-2">
                        {workout.description}
                      </p>
                    )}
                  </div>
                </div>

                <div className="text-xs text-gray-500 mb-4">
                  Created {new Date(workout.created_at).toLocaleDateString()}
                </div>

                <div className="flex gap-2">
                  <Link
                    href={`/dashboard/workouts/${workout.id}`}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors text-center text-sm"
                  >
                    View
                  </Link>
                  <button
                    onClick={() => deleteWorkout(workout.id)}
                    className="px-4 py-2 bg-red-50 text-red-600 rounded-lg font-semibold hover:bg-red-100 transition-colors text-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}