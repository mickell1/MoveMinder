'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/src/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'

type Exercise = {
  id: string           // workout_exercises.id
  exercise_id: string  // exercises.id (FK used in workout_sets)
  name: string
  sets: number
  reps: number
  rest_seconds: number
  order_index: number
  video_url?: string | null
  muscle_group?: string | null
}

type SetLog = {
  workoutExerciseId: string // workout_exercises.id (for grouping)
  exerciseId: string        // exercises.id (inserted into workout_sets)
  setNumber: number
  reps: number
  weight: number
  completed: boolean
}

// ─── YouTube helpers ───────────────────────────────────────────────────────────
function getYouTubeVideoId(url: string): string | null {
  try {
    const parsed = new URL(url)
    if (parsed.hostname.includes('youtu.be')) return parsed.pathname.slice(1).split('?')[0]
    if (parsed.pathname.includes('/shorts/')) return parsed.pathname.split('/shorts/')[1].split('/')[0]
    return parsed.searchParams.get('v')
  } catch {
    return null
  }
}

// Autoplay MUTED so browsers allow it. Loops for continuous form reference.
function getEmbedUrl(url: string | null | undefined): string | null {
  if (!url) return null
  const id = getYouTubeVideoId(url)
  if (!id) return null
  return `https://www.youtube-nocookie.com/embed/${id}?rel=0&autoplay=1&mute=1&loop=1&playlist=${id}`
}

function getThumbnail(url: string | null | undefined): string | null {
  if (!url) return null
  const id = getYouTubeVideoId(url)
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null
}

const muscleGroupEmojis: Record<string, string> = {
  chest: '💪',
  back: '🦾',
  legs: '🦵',
  shoulders: '🏋️',
  arms: '💪',
  core: '🔥',
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

  const [isVideoCollapsed, setIsVideoCollapsed] = useState(false)
  const [thumbErrors, setThumbErrors] = useState<Record<string, boolean>>({})

  useEffect(() => {
    async function loadWorkout() {
      const { data: { user } } = await supabaseClient.auth.getUser()
      if (!user) { router.push('/login'); return }

      const workoutResponse = await supabaseClient
        .from('workouts').select('*').eq('id', params.id).eq('user_id', user.id).single()

      if (!workoutResponse.data) { router.push('/dashboard/workouts'); return }
      setWorkoutName(workoutResponse.data.name)

      const exercisesResponse = await supabaseClient
        .from('workout_exercises')
        .select(`
          id, exercise_id, sets, reps, rest_seconds, order_index,
          exercises!exercise_id ( name, video_url, muscle_group )
        `)
        .eq('workout_id', params.id)
        .order('order_index', { ascending: true })

      if (exercisesResponse.error) {
        console.error('Error loading exercises:', exercisesResponse.error)
      }

      if (exercisesResponse.data) {
        type WERow = {
          id: string; exercise_id: string; sets: number; reps: number
          rest_seconds: number; order_index: number
          exercises: { name: string; video_url: string | null; muscle_group: string | null } | null
        }

        const flat: Exercise[] = (exercisesResponse.data as unknown as WERow[]).map((row) => ({
          id: row.id,
          exercise_id: row.exercise_id,
          name: row.exercises?.name ?? 'Unknown',
          sets: row.sets,
          reps: row.reps,
          rest_seconds: row.rest_seconds,
          order_index: row.order_index,
          video_url: row.exercises?.video_url ?? null,
          muscle_group: row.exercises?.muscle_group ?? null,
        }))

        setExercises(flat)

        const logs: SetLog[] = []
        flat.forEach((ex) => {
          for (let i = 1; i <= ex.sets; i++) {
            logs.push({
              workoutExerciseId: ex.id,
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
          if (prev <= 1) { setIsResting(false); return 0 }
          return prev - 1
        })
      }, 1000)
    }
    return () => { if (interval) clearInterval(interval) }
  }, [isResting, restTimer])

  const currentExercise = exercises[currentExerciseIndex]
  const currentExerciseSets = setLogs.filter((log) => log.workoutExerciseId === currentExercise?.id)
  const currentSetLog = currentExerciseSets?.[currentSet - 1]

  const updateSetLog = (field: 'reps' | 'weight', value: number) => {
    setSetLogs(setLogs.map((log) =>
      log.workoutExerciseId === currentExercise.id && log.setNumber === currentSet
        ? { ...log, [field]: value } : log
    ))
  }

  const completeSet = () => {
    setSetLogs(setLogs.map((log) =>
      log.workoutExerciseId === currentExercise.id && log.setNumber === currentSet
        ? { ...log, completed: true } : log
    ))

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

  const skipRest = () => { setIsResting(false); setRestTimer(0) }

  const finishWorkout = async () => {
    if (!confirm('Are you sure you want to finish this workout?')) return
    setSaving(true)

    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user) { router.push('/login'); return }

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
      .select().single()

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
        exercise_id: log.exerciseId,   // exercises.id — never null
        set_number: log.setNumber,
        reps: log.reps,
        weight: log.weight,
      }))

    if (completedSets.length > 0) {
      console.log('Inserting sets, first row:', JSON.stringify(completedSets[0], null, 2))
      const { error: setsError } = await supabaseClient
        .from('workout_sets').insert(completedSets)
      if (setsError) {
        console.error('Error saving sets:', JSON.stringify(setsError, null, 2))
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
  const progress =
    ((currentExerciseIndex * 100) + ((completedSets / totalSets) * 100)) / exercises.length

  const embedUrl = getEmbedUrl(currentExercise.video_url)
  const thumbnail = getThumbnail(currentExercise.video_url)
  const emoji = muscleGroupEmojis[currentExercise.muscle_group ?? ''] ?? '💪'

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
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

      {/* Progress bar */}
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

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

        {/* ══════════════════════════════════════════════════════════════════
            STICKY VIDEO REFERENCE
            Always visible while scrolling. Loads immediately on page load.
        ══════════════════════════════════════════════════════════════════ */}
        <div className="sticky top-4 z-30 mb-6">
          <div className="bg-gray-900 rounded-xl shadow-2xl overflow-hidden ring-1 ring-black/5">
            {/* Always-visible header bar */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-gray-800">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-green-400 text-xs font-bold uppercase tracking-wider shrink-0">
                  🎬 Reference
                </span>
                <span className="text-white text-sm font-semibold truncate">
                  {currentExercise.name}
                </span>
                {currentExercise.muscle_group && (
                  <span className="text-gray-400 text-xs capitalize shrink-0 hidden sm:inline">
                    • {emoji} {currentExercise.muscle_group}
                  </span>
                )}
              </div>
              <button
                onClick={() => setIsVideoCollapsed((c) => !c)}
                className="text-gray-300 hover:text-white text-xs px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 transition-colors shrink-0 ml-2"
                title={isVideoCollapsed ? 'Show video' : 'Hide video'}
              >
                {isVideoCollapsed ? '▼ Show' : '▲ Hide'}
              </button>
            </div>

            {!isVideoCollapsed && (
              <>
                {embedUrl ? (
                  <div className="aspect-video w-full bg-black">
                    {/* key forces iframe reload when exercise changes */}
                    <iframe
                      key={currentExercise.id}
                      width="100%"
                      height="100%"
                      src={embedUrl}
                      title={currentExercise.name}
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                    />
                  </div>
                ) : (
                  /* Placeholder: always show SOMETHING so the user has a visual anchor */
                  <div className="aspect-video w-full bg-gradient-to-br from-blue-900 via-indigo-900 to-purple-900 flex items-center justify-center relative overflow-hidden">
                    {thumbnail && !thumbErrors[currentExercise.id] ? (
                      <img
                        src={thumbnail}
                        alt={currentExercise.name}
                        className="absolute inset-0 w-full h-full object-cover opacity-60"
                        onError={() => setThumbErrors((prev) => ({ ...prev, [currentExercise.id]: true }))}
                      />
                    ) : null}
                    <div className="relative text-center">
                      <div className="text-9xl mb-4">{emoji}</div>
                      <p className="text-white text-lg font-bold capitalize">
                        {currentExercise.muscle_group ?? 'Exercise'}
                      </p>
                      <p className="text-gray-300 text-sm mt-1">No video available</p>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Rest timer */}
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

        {/* Current set card */}
        <div className="bg-white rounded-xl shadow-lg p-8 mb-6">
          <div className="text-center mb-6">
            <p className="text-lg text-gray-600">Set {currentSet} of {totalSets}</p>
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
                <label className="block text-sm font-medium text-gray-700 mb-2">Reps Completed</label>
                <input
                  type="number"
                  value={currentSetLog.reps}
                  onChange={(e) => updateSetLog('reps', parseInt(e.target.value) || 0)}
                  min="0"
                  className="w-full px-4 py-3 text-2xl font-bold text-center border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Weight (lbs/kg)</label>
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

        {/* Target info */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-2 text-blue-800 text-sm">
            <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <p>Target: {currentExercise.reps} reps • Rest: {currentExercise.rest_seconds}s between sets</p>
          </div>
        </div>

        {/* Workout plan — clickable to jump between exercises */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Workout Plan</h3>
          <div className="space-y-2">
            {exercises.map((exercise, index) => {
              const exerciseSets = setLogs.filter((log) => log.workoutExerciseId === exercise.id)
              const completedCount = exerciseSets.filter((s) => s.completed).length
              const isActive = index === currentExerciseIndex
              const exEmoji = muscleGroupEmojis[exercise.muscle_group ?? ''] ?? '💪'
              const thumb = getThumbnail(exercise.video_url)

              return (
                <button
                  key={exercise.id}
                  onClick={() => { setCurrentExerciseIndex(index); setCurrentSet(1) }}
                  className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                    isActive
                      ? 'border-blue-500 bg-blue-50'
                      : completedCount === exercise.sets
                      ? 'border-green-300 bg-green-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
                          isActive
                            ? 'bg-blue-600 text-white'
                            : completedCount === exercise.sets
                            ? 'bg-green-500 text-white'
                            : 'bg-gray-200 text-gray-600'
                        }`}
                      >
                        {completedCount === exercise.sets ? '✓' : index + 1}
                      </div>

                      {thumb && !thumbErrors[exercise.id] ? (
                        <img
                          src={thumb}
                          alt={exercise.name}
                          className="w-10 h-10 rounded-lg object-cover shrink-0"
                          onError={() => setThumbErrors((prev) => ({ ...prev, [exercise.id]: true }))}
                        />
                      ) : (
                        <span className="text-xl shrink-0">{exEmoji}</span>
                      )}

                      <div className="min-w-0">
                        <h4 className="font-semibold text-gray-900 truncate">{exercise.name}</h4>
                        <p className="text-xs text-gray-600">
                          {exercise.sets} sets × {exercise.reps} reps
                        </p>
                      </div>
                    </div>

                    <div className="text-sm font-medium text-gray-600 shrink-0 ml-2">
                      {completedCount}/{exercise.sets}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </main>
    </div>
  )
}