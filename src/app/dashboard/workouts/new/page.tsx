'use client'

import { useState } from 'react'
import { createClient } from '@/src/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Exercise = {
  id: string
  name: string
  sets: number
  reps: number
  rest_seconds: number
}

export default function NewWorkoutPage() {
  const router = useRouter()
  const supabaseClient = createClient()
  
  const [workoutName, setWorkoutName] = useState('')
  const [description, setDescription] = useState('')
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [loading, setLoading] = useState(false)

  const addExercise = () => {
    setExercises([
      ...exercises,
      {
        id: crypto.randomUUID(),
        name: '',
        sets: 3,
        reps: 10,
        rest_seconds: 60,
      },
    ])
  }

  const removeExercise = (id: string) => {
    setExercises(exercises.filter((ex) => ex.id !== id))
  }

  const updateExercise = <K extends Exclude<keyof Exercise, 'id'>>(id: string, field: K, value: Exercise[K]) => {
    setExercises(
      exercises.map((ex) =>
        ex.id === id ? { ...ex, [field]: value } : ex
      )
    )
  }

  const handleSave = async () => {
    if (!workoutName.trim()) {
      alert('Please enter a workout name')
      return
    }

    if (exercises.length === 0) {
      alert('Please add at least one exercise')
      return
    }

    setLoading(true)

    const { data } = await supabaseClient.auth.getUser()
    const user = data?.user
    
    if (!user) {
      router.push('/login')
      return
    }
    // Create workout
    const { data: workout, error: workoutError } = await supabaseClient
      .from('workouts')
      .insert({
        user_id: user.id,
        name: workoutName,
        description: description,
      })
      .select()
      .single()

    if (workoutError) {
      console.error('Error creating workout:', workoutError)
      alert('Failed to create workout')
      setLoading(false)
      return
    }

    // Create exercises
    const exercisesData = exercises.map((ex, index) => ({
      workout_id: workout.id,
      name: ex.name,
      sets: ex.sets,
      reps: ex.reps,
      rest_seconds: ex.rest_seconds,
      order_index: index,
    }))
    const { error: exercisesError } = await supabaseClient
      .from('workout_exercises')
      .insert(exercisesData)
    if (exercisesError) {
      console.error('Error creating exercises:', exercisesError)
      alert('Failed to create exercises')
      setLoading(false)
      return
    }

    router.push('/dashboard/workouts')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="text-gray-600 hover:text-gray-900"
            >
              ← Back
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">Create Workout</h1>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Workout Details */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 mb-6">
          {/* Workout Name */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Workout Name *
            </label>
            <input
              type="text"
              value={workoutName}
              onChange={(e) => setWorkoutName(e.target.value)}
              placeholder="e.g., Push Day, Leg Day, Full Body"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add notes about this workout..."
              rows={3}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
            />
          </div>
        </div>

        {/* Exercises */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">Exercises</h2>
            <button
              onClick={addExercise}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors text-sm"
            >
              + Add Exercise
            </button>
          </div>

          {exercises.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg">
              <div className="text-5xl mb-4">🏋️</div>
              <p className="text-gray-500 mb-4">No exercises added yet</p>
              <button
                onClick={addExercise}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
              >
                Add Your First Exercise
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {exercises.map((exercise, index) => (
                <div
                  key={exercise.id}
                  className="p-4 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    {/* Exercise Number */}
                    <div className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-semibold text-sm">
                      {index + 1}
                    </div>

                    {/* Exercise Details */}
                    <div className="flex-1 space-y-3">
                      {/* Exercise Name */}
                      <input
                        type="text"
                        value={exercise.name}
                        onChange={(e) =>
                          updateExercise(exercise.id, 'name', e.target.value)
                        }
                        placeholder="Exercise name (e.g., Bench Press, Squats)"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      />

                      {/* Sets, Reps, Rest */}
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Sets
                          </label>
                          <input
                            type="number"
                            value={exercise.sets}
                            onChange={(e) =>
                              updateExercise(
                                exercise.id,
                                'sets',
                                parseInt(e.target.value) || 0
                              )
                            }
                            min="1"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Reps
                          </label>
                          <input
                            type="number"
                            value={exercise.reps}
                            onChange={(e) =>
                              updateExercise(
                                exercise.id,
                                'reps',
                                parseInt(e.target.value) || 0
                              )
                            }
                            min="1"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Rest (sec)
                          </label>
                          <input
                            type="number"
                            value={exercise.rest_seconds}
                            onChange={(e) =>
                              updateExercise(
                                exercise.id,
                                'rest_seconds',
                                parseInt(e.target.value) || 0
                              )
                            }
                            min="0"
                            step="15"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Remove Button */}
                    <button
                      onClick={() => removeExercise(exercise.id)}
                      className="flex-shrink-0 text-red-500 hover:text-red-700 transition-colors p-1"
                      title="Remove exercise"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Link
            href="/dashboard"
            className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition-colors text-center"
          >
            Cancel
          </Link>
          <button
            onClick={handleSave}
            disabled={loading || !workoutName.trim() || exercises.length === 0}
            className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Saving...
              </span>
            ) : (
              'Save Workout'
            )}
          </button>
        </div>
      </main>
    </div>
  )
}