'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/src/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'

type Exercise = {
  id: string
  exercise_id: string
  name: string
  sets: number
  reps: number
  rest_seconds: number
  order_index: number
}

type SetLog = {
  exerciseId: string
  setNumber: number
  reps: number
  weight: number
  completed: boolean
}

export default function WorkoutLogPage() {
  const router = useRouter()
  const params = useParams()
  const supabaseClient = createClient()
  
  const [workoutName, setWorkoutName] = useState('')
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [setLogs, setSetLogs] = useState<SetLog[]>([])
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0)
  const [currentSet, setCurrentSet] = useState(1)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [restTimer, setRestTimer] = useState(0)
  const [isResting, setIsResting] = useState(false)
  const [startTime] = useState(new Date())

  useEffect(() => {
    async function loadWorkout() {
    const { data: { user } } = await supabaseClient.auth.getUser()
        
        if (!user) {
          router.push('/login')
          return
        }

      const workoutResponse = await supabaseClient
        .from('workouts')
        .select('*')
        .eq('id', params.id)
        .eq('user_id', user.id)
        .single()

      if (!workoutResponse.data) {
        router.push('/dashboard/workouts')
        return
      }

      setWorkoutName(workoutResponse.data.name)

      const exercisesResponse = await supabaseClient
        .from('workout_exercises')
        .select('id, exercise_id, name, sets, reps, rest_seconds, order_index')
        .eq('workout_id', params.id)
        .order('order_index', { ascending: true })

      if (exercisesResponse.data) {
        setExercises(exercisesResponse.data as Exercise[])
        
        const logs: SetLog[] = []
        exercisesResponse.data.forEach((ex: Exercise) => {
          for (let i = 1; i <= ex.sets; i++) {
            logs.push({
              exerciseId: ex.exercise_id,
              setNumber: i,
              reps: ex.reps,
              weight: 0,
              completed: false,
            })
          }
        })
        setSetLogs(logs)
      }

      setLoading(false)
    }

    loadWorkout()
  }, [params.id, router, supabaseClient])

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null

    if (isResting && restTimer > 0) {
      interval = setInterval(() => {
        setRestTimer((prev) => {
          if (prev <= 1) {
            setIsResting(false)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isResting, restTimer])

  const currentExercise = exercises[currentExerciseIndex]
  const currentExerciseSets = setLogs.filter(
    (log) => log.exerciseId === currentExercise?.exercise_id
  )
  const currentSetLog = currentExerciseSets?.[currentSet - 1]

  const updateSetLog = (field: 'reps' | 'weight', value: number) => {
    setSetLogs(
      setLogs.map((log) =>
        log.exerciseId === currentExercise.exercise_id && log.setNumber === currentSet
          ? { ...log, [field]: value }
          : log
      )
    )
  }

  const completeSet = () => {
    setSetLogs(
      setLogs.map((log) =>
        log.exerciseId === currentExercise.exercise_id && log.setNumber === currentSet
          ? { ...log, completed: true }
          : log
      )
    )

    setRestTimer(currentExercise.rest_seconds)
    setIsResting(true)

    setTimeout(() => {
      if (currentSet < currentExercise.sets) {
        setCurrentSet(currentSet + 1)
      } else if (currentExerciseIndex < exercises.length - 1) {
        setCurrentExerciseIndex(currentExerciseIndex + 1)
        setCurrentSet(1)
        setIsResting(false)
      }
    }, 300)
  }

  const skipRest = () => {
    setIsResting(false)
    setRestTimer(0)
  }

  const finishWorkout = async () => {
    if (!confirm('Are you sure you want to finish this workout?')) {
      return
    }

    setSaving(true)

    const { data: { user } } = await supabaseClient.auth.getUser()
    
    if (!user) {
      router.push('/login')
      return
    }

    const endTime = new Date()
    const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / 60000)

    const sessionResponse = await supabaseClient
      .from('workout_sessions')
      .insert({
        user_id: user.id,
        workout_id: params.id,
        started_at: startTime.toISOString(),
        completed_at: endTime.toISOString(),
        duration_minutes: durationMinutes,
      })
      .select()
      .single()

    if (sessionResponse.error || !sessionResponse.data) {
      console.error('Error saving session:', sessionResponse.error)
      alert('Failed to save workout')
      setSaving(false)
      return
    }

    const completedSets = setLogs
      .filter((log) => log.completed)
      .map((log) => ({
        session_id: sessionResponse.data.id,
        exercise_id: log.exerciseId,
        set_number: log.setNumber,
        reps: log.reps,
        weight: log.weight,
      }))

    if (completedSets.length > 0) {
      const { error: setsError } = await supabaseClient
        .from('workout_sets')
        .insert(completedSets)

      if (setsError) {
        console.error('Error saving sets:', setsError)
      }
    }

    router.push('/dashboard/history')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-xl text-gray-600">Loading workout...</div>
      </div>
    )
  }

  if (!currentExercise) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Workout Complete!</h2>
          <p className="text-gray-600 mb-6">Great job finishing your workout!</p>
          <button
            onClick={finishWorkout}
            disabled={saving}
            className="px-8 py-4 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
          >
            {saving ? 'Saving...' : 'Save & Finish'}
          </button>
        </div>
      </div>
    )
  }

  const completedSets = currentExerciseSets.filter((s) => s.completed).length
  const totalSets = currentExercise.sets
  const progress = ((currentExerciseIndex * 100) + ((completedSets / totalSets) * 100)) / exercises.length 

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{workoutName}</h1>
              <p className="text-sm text-gray-600">
                Exercise {currentExerciseIndex + 1} of {exercises.length}
              </p>
            </div>
            <button
              onClick={finishWorkout}
              className="px-4 py-2 bg-red-50 text-red-600 rounded-lg font-semibold hover:bg-red-100 transition-colors"
            >
              End Workout
            </button>
          </div>
        </div>
      </header>

      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Overall Progress</span>
            <span className="text-sm font-medium text-gray-700">{Math.round(progress)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="bg-gradient-to-r from-blue-600 to-indigo-600 h-3 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isResting && (
          <div className="bg-orange-500 text-white rounded-xl shadow-lg p-8 mb-6 text-center animate-pulse">
            <div className="text-6xl font-bold mb-2">{restTimer}s</div>
            <p className="text-xl mb-4">Rest Time</p>
            <button
              onClick={skipRest}
              className="px-6 py-3 bg-white text-orange-600 rounded-lg font-semibold hover:bg-orange-50 transition-colors"
            >
              Skip Rest
            </button>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-lg p-8 mb-6">
          <div className="text-center mb-6">
            <div className="text-5xl mb-4">💪</div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              {currentExercise.name}
            </h2>
            <p className="text-lg text-gray-600">
              Set {currentSet} of {totalSets}
            </p>
          </div>

          <div className="flex gap-2 mb-6 justify-center flex-wrap">
            {Array.from({ length: totalSets }).map((_, index) => (
              <div
                key={index}
                className={`w-12 h-12 rounded-full flex items-center justify-center font-bold transition-all ${
                  currentExerciseSets[index]?.completed
                    ? 'bg-green-500 text-white scale-110'
                    : index + 1 === currentSet
                    ? 'bg-blue-600 text-white scale-110 ring-4 ring-blue-200'
                    : 'bg-gray-200 text-gray-500'
                }`}
              >
                {currentExerciseSets[index]?.completed ? '✓' : index + 1}
              </div>
            ))}
          </div>

          {currentSetLog && !currentSetLog.completed && (
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reps Completed
                </label>
                <input
                  type="number"
                  value={currentSetLog.reps}
                  onChange={(e) => updateSetLog('reps', parseInt(e.target.value) || 0)}
                  min="0"
                  className="w-full px-4 py-3 text-2xl font-bold text-center border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Weight (lbs/kg)
                </label>
                <input
                  type="number"
                  value={currentSetLog.weight}
                  onChange={(e) => updateSetLog('weight', parseFloat(e.target.value) || 0)}
                  min="0"
                  step="2.5"
                  className="w-full px-4 py-3 text-2xl font-bold text-center border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>
            </div>
          )}

          {currentSetLog && !currentSetLog.completed && (
            <button
              onClick={completeSet}
              className="w-full py-4 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-bold text-lg hover:from-green-600 hover:to-green-700 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              ✓ Complete Set
            </button>
          )}

          {currentSetLog && currentSetLog.completed && (
            <div className="w-full py-4 bg-green-100 text-green-700 rounded-xl font-bold text-lg text-center">
              ✓ Set Completed
            </div>
          )}
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-2 text-blue-800 text-sm">
            <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <p>
              Target: {currentExercise.reps} reps • Rest: {currentExercise.rest_seconds}s between sets
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Workout Plan</h3>
          <div className="space-y-2">
            {exercises.map((exercise, index) => {
              const exerciseSets = setLogs.filter((log) => log.exerciseId === exercise.exercise_id)
              const completedCount = exerciseSets.filter((s) => s.completed).length
              const isActive = index === currentExerciseIndex

              return (
                <div
                  key={exercise.id}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    isActive
                      ? 'border-blue-500 bg-blue-50'
                      : completedCount === exercise.sets
                      ? 'border-green-300 bg-green-50'
                      : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                          isActive
                            ? 'bg-blue-600 text-white'
                            : completedCount === exercise.sets
                            ? 'bg-green-500 text-white'
                            : 'bg-gray-200 text-gray-600'
                        }`}
                      >
                        {completedCount === exercise.sets ? '✓' : index + 1}
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900">{exercise.name}</h4>
                        <p className="text-xs text-gray-600">
                          {exercise.sets} sets × {exercise.reps} reps
                        </p>
                      </div>
                    </div>
                    <div className="text-sm font-medium text-gray-600">
                      {completedCount}/{exercise.sets}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </main>
    </div>
  )
}