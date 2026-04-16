'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/src/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Search, Plus, X, Save } from 'lucide-react'

interface Exercise {
  id: string
  name: string
  description: string
  muscle_group: string
  equipment: string
  difficulty: string
}

interface WorkoutExercise {
  exercise: Exercise
  sets: number
  reps: number
  weight: number
  rest_seconds: number
}

export default function NewWorkoutPage() {
  const supabase = createClient()
  const router = useRouter()
  
  const [workoutName, setWorkoutName] = useState('')
  const [workoutDescription, setWorkoutDescription] = useState('')
  const [selectedExercises, setSelectedExercises] = useState<WorkoutExercise[]>([])
  const [availableExercises, setAvailableExercises] = useState<Exercise[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [showExercisePicker, setShowExercisePicker] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const fetchExercises = async () => {
      const { data, error } = await supabase
        .from('exercises')
        .select('*')
        .order('name')

      if (error) {
        console.error('Error fetching exercises:', error)
      } else {
        setAvailableExercises(data || [])
      }
      setLoading(false)
    }

    fetchExercises()
  }, [supabase])

  const filteredExercises = availableExercises.filter(ex =>
    ex.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const addExercise = (exercise: Exercise) => {
    setSelectedExercises([
      ...selectedExercises,
      { exercise, sets: 3, reps: 10, weight: 0, rest_seconds: 60 }
    ])
    setShowExercisePicker(false)
    setSearchTerm('')
  }

  const removeExercise = (index: number) => {
    setSelectedExercises(selectedExercises.filter((_, i) => i !== index))
  }

  const updateExercise = (index: number, field: 'sets' | 'reps' | 'weight' | 'rest_seconds', value: number) => {
    const updated = [...selectedExercises]
    updated[index][field] = value
    setSelectedExercises(updated)
  }

 const saveWorkout = async () => {
  if (!workoutName.trim()) {
    alert('Please enter a workout name')
    return
  }

  if (selectedExercises.length === 0) {
    alert('Please add at least one exercise')
    return
  }

  setSaving(true)

  try {
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData?.user?.id

    if (!userId) {
      router.push('/login')
      return
    }

    // Create workout
        const { data: workout, error: workoutError } = await supabase
          .from('workouts')
          .insert({
            user_id: userId,
            name: workoutName,
            description: workoutDescription
          })
          .select()
          .single()
    
        if (workoutError) throw workoutError

    // Add exercises to workout
    const workoutExercises = selectedExercises.map((we, index) => ({
      workout_id: workout.id,
      exercise_id: we.exercise.id,
      name: we.exercise.name,  // Add this line
      sets: we.sets,
      reps: we.reps,
      rest_seconds: we.rest_seconds,
      order_index: index
    }))

    const { error: exercisesError } = await supabase
      .from('workout_exercises')
      .insert(workoutExercises)

    if (exercisesError) throw exercisesError

    router.push('/dashboard/workouts')
    router.refresh()
  } catch (error) {
    console.error('Error saving workout:', error)
    alert('Failed to save workout')
  } finally {
    setSaving(false)
  }
}

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <Link href="/dashboard" className="text-3xl">💪</Link>
              <h1 className="text-2xl font-bold text-gray-900">Create Workout</h1>
            </div>
            <Link
              href="/dashboard/workouts"
              className="text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors"
            >
              ← Cancel
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Workout Details */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Workout Details</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Workout Name *
              </label>
              <input
                type="text"
                value={workoutName}
                onChange={(e) => setWorkoutName(e.target.value)}
                placeholder="e.g., Upper Body Strength, Push Day"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description (optional)
              </label>
              <textarea
                value={workoutDescription}
                onChange={(e) => setWorkoutDescription(e.target.value)}
                placeholder="Add notes about this workout..."
                rows={3}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
              />
            </div>
          </div>
        </div>

        {/* Selected Exercises */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-900">Exercises</h2>
            <button
              onClick={() => setShowExercisePicker(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold text-sm"
            >
              <Plus className="w-4 h-4" />
              Add Exercise
            </button>
          </div>

          {selectedExercises.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg">
              <div className="text-5xl mb-4">🏋️</div>
              <p className="text-gray-500 mb-4">No exercises added yet</p>
              <button
                onClick={() => setShowExercisePicker(true)}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
              >
                Add Your First Exercise
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {selectedExercises.map((we, index) => (
                <div key={index} className="p-4 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors">
                  <div className="flex items-start gap-4">
                    {/* Exercise Number */}
                    <div className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-semibold text-sm">
                      {index + 1}
                    </div>

                    {/* Exercise Details */}
                    <div className="flex-1">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="font-semibold text-gray-900 text-lg">{we.exercise.name}</h3>
                          <div className="flex gap-2 mt-1">
                            <span className="text-xs px-2 py-1 bg-purple-100 text-purple-800 rounded-full">
                              {we.exercise.muscle_group}
                            </span>
                            <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded-full">
                              {we.exercise.equipment}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => removeExercise(index)}
                          className="text-red-500 hover:text-red-700 transition-colors p-1"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-4 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Sets</label>
                          <input
                            type="number"
                            min="1"
                            value={we.sets}
                            onChange={(e) => updateExercise(index, 'sets', parseInt(e.target.value) || 1)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Reps</label>
                          <input
                            type="number"
                            min="1"
                            value={we.reps}
                            onChange={(e) => updateExercise(index, 'reps', parseInt(e.target.value) || 1)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Weight (lbs)</label>
                          <input
                            type="number"
                            min="0"
                            step="5"
                            value={we.weight}
                            onChange={(e) => updateExercise(index, 'weight', parseFloat(e.target.value) || 0)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Rest (sec)</label>
                          <input
                            type="number"
                            min="0"
                            step="15"
                            value={we.rest_seconds}
                            onChange={(e) => updateExercise(index, 'rest_seconds', parseInt(e.target.value) || 0)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                          />
                        </div>
                      </div>
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
            href="/dashboard"
            className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition-colors text-center"
          >
            Cancel
          </Link>
          <button
            onClick={saveWorkout}
            disabled={saving || !workoutName.trim() || selectedExercises.length === 0}
            className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Saving...
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                Save Workout
              </>
            )}
          </button>
        </div>
      </main>

      {/* Exercise Picker Modal */}
      {showExercisePicker && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-gray-900">Select Exercise</h3>
                <button
                  onClick={() => {
                    setShowExercisePicker(false)
                    setSearchTerm('')
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search exercises..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  autoFocus
                />
              </div>
            </div>

            <div className="overflow-y-auto max-h-[60vh] p-6">
              {loading ? (
                <div className="text-center py-8 text-gray-600">Loading exercises...</div>
              ) : filteredExercises.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">No exercises found</p>
                  <p className="text-sm text-gray-400 mt-2">Try a different search term</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredExercises.map(exercise => (
                    <button
                      key={exercise.id}
                      onClick={() => {
                        addExercise(exercise)
                      }}
                      className="w-full text-left p-4 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all"
                    >
                      <h4 className="font-semibold text-gray-900">{exercise.name}</h4>
                      <p className="text-sm text-gray-600">{exercise.muscle_group} • {exercise.equipment}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}