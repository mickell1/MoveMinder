'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/src/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Exercise = {
  id: string
  name: string
  description: string | null
  muscle_group: string
  video_url: string | null
  difficulty: string | null
}

// Robustly extracts the YouTube video ID from various URL formats:
// - https://www.youtube.com/watch?v=VIDEO_ID
// - https://youtu.be/VIDEO_ID
// - https://youtube.com/shorts/VIDEO_ID
function getYouTubeVideoId(url: string): string | null {
  try {
    const parsed = new URL(url)
    if (parsed.hostname.includes('youtu.be')) {
      return parsed.pathname.slice(1).split('?')[0]
    }
    if (parsed.pathname.includes('/shorts/')) {
      return parsed.pathname.split('/shorts/')[1].split('/')[0]
    }
    return parsed.searchParams.get('v')
  } catch {
    return null
  }
}

// youtube-nocookie.com has far fewer iframe embedding restrictions than youtube.com
function getYouTubeEmbedUrl(url: string | null): string | null {
  if (!url) return null
  const id = getYouTubeVideoId(url)
  return id ? `https://www.youtube-nocookie.com/embed/${id}?rel=0` : null
}

function getYouTubeEmbedUrlAutoplay(url: string | null): string | null {
  if (!url) return null
  const id = getYouTubeVideoId(url)
  return id ? `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0` : null
}

// hqdefault is far more reliable than maxresdefault (which often 404s)
function getYouTubeThumbnail(url: string | null): string | null {
  if (!url) return null
  const id = getYouTubeVideoId(url)
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null
}

export default function ExercisesPage() {
  const router = useRouter()
  const supabase = createClient()
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMuscleGroup, setSelectedMuscleGroup] = useState<string>('all')
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null)
  const [creatingWorkout, setCreatingWorkout] = useState(false)

  // Floating workout video player state
  const [workoutExercise, setWorkoutExercise] = useState<Exercise | null>(null)
  const [isMinimised, setIsMinimised] = useState(false)

  const muscleGroups = ['all', 'chest', 'back', 'legs', 'shoulders', 'arms', 'core']

  useEffect(() => {
    async function loadExercises() {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      const { data } = await supabase
        .from('exercises')
        .select('*')
        .order('muscle_group')
        .order('name')

      if (data) setExercises(data)
      setLoading(false)
    }

    loadExercises()
  }, [router, supabase])

  const filteredExercises = useMemo(() => {
    if (selectedMuscleGroup === 'all') return exercises
    return exercises.filter(e => e.muscle_group === selectedMuscleGroup)
  }, [selectedMuscleGroup, exercises])

  const difficultyColors: Record<string, string> = {
    beginner: 'bg-green-100 text-green-800 border-green-200',
    intermediate: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    advanced: 'bg-red-100 text-red-800 border-red-200',
  }

  const muscleGroupEmojis: Record<string, string> = {
    chest: '💪',
    back: '🦾',
    legs: '🦵',
    shoulders: '🏋️',
    arms: '💪',
    core: '🔥',
    all: '🎯',
  }

  const createAutoWorkout = async (type: 'full' | 'upper' | 'lower') => {
    setCreatingWorkout(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    let muscleGroups: string[] = []
    let workoutName = ''

    if (type === 'full') {
      muscleGroups = ['chest', 'back', 'legs', 'shoulders', 'arms', 'core']
      workoutName = 'Full Body Workout'
    } else if (type === 'upper') {
      muscleGroups = ['chest', 'back', 'shoulders', 'arms']
      workoutName = 'Upper Body Workout'
    } else {
      muscleGroups = ['legs', 'core']
      workoutName = 'Lower Body Workout'
    }

    const { data: randomExercises } = await supabase
      .rpc('get_random_exercises_by_groups', {
        muscle_groups: muscleGroups,
        exercises_per_group: type === 'lower' ? 3 : 2,
      })

    if (!randomExercises || randomExercises.length === 0) {
      alert('Not enough exercises in database')
      setCreatingWorkout(false)
      return
    }

    const { data: workout, error: workoutError } = await supabase
      .from('workouts')
      .insert({
        user_id: user.id,
        name: workoutName,
        description: `Auto-generated ${type} body workout`,
        difficulty: 'intermediate',
      })
      .select()
      .single()

    if (workoutError || !workout) {
      alert('Failed to create workout')
      setCreatingWorkout(false)
      return
    }

    const workoutExercises = randomExercises.map((exercise: Exercise, index: number) => ({
      workout_id: workout.id,
      exercise_id: exercise.id,
      sets: 3,
      reps: 12,
      order: index,
    }))

    const { error: exercisesError } = await supabase
      .from('workout_exercises')
      .insert(workoutExercises)

    if (exercisesError) {
      alert('Failed to add exercises')
      setCreatingWorkout(false)
      return
    }

    setCreatingWorkout(false)
    router.push(`/dashboard/workouts/${workout.id}`)
  }

  const startWorkoutVideo = (exercise: Exercise) => {
    if (!exercise.video_url) return
    setWorkoutExercise(exercise)
    setIsMinimised(false)
    setSelectedExercise(null) // close detail modal if open
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-xl text-gray-600">Loading exercises...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <Link href="/dashboard" className="text-2xl hover:opacity-70 transition-opacity">
                ←
              </Link>
              <h1 className="text-2xl font-bold text-gray-900">Exercise Library</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Auto Workout Generator */}
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl shadow-lg p-8 mb-8 text-white">
          <h2 className="text-2xl font-bold mb-2">🤖 Auto Workout Generator</h2>
          <p className="mb-6 opacity-90">Let AI create a workout routine for you!</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => createAutoWorkout('full')}
              disabled={creatingWorkout}
              className="bg-white text-blue-600 px-6 py-4 rounded-lg font-semibold hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              🎯 Full Body
            </button>
            <button
              onClick={() => createAutoWorkout('upper')}
              disabled={creatingWorkout}
              className="bg-white text-purple-600 px-6 py-4 rounded-lg font-semibold hover:bg-purple-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              💪 Upper Body
            </button>
            <button
              onClick={() => createAutoWorkout('lower')}
              disabled={creatingWorkout}
              className="bg-white text-pink-600 px-6 py-4 rounded-lg font-semibold hover:bg-pink-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              🦵 Lower Body
            </button>
          </div>

          {creatingWorkout && (
            <p className="mt-4 text-center animate-pulse">Creating your workout...</p>
          )}
        </div>

        {/* Muscle Group Filter */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Filter by Muscle Group</h3>
          <div className="flex flex-wrap gap-2">
            {muscleGroups.map((group) => (
              <button
                key={group}
                onClick={() => setSelectedMuscleGroup(group)}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  selectedMuscleGroup === group
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {muscleGroupEmojis[group]} {group.charAt(0).toUpperCase() + group.slice(1)}
              </button>
            ))}
          </div>
          <div className="mt-4 text-sm text-gray-600">
            Showing {filteredExercises.length} exercise{filteredExercises.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Exercise Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredExercises.map((exercise) => {
            const thumbnail = getYouTubeThumbnail(exercise.video_url)
            return (
              <div
                key={exercise.id}
                className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-lg transition-all"
              >
                {/* Thumbnail — click opens detail modal */}
                <div
                  className="cursor-pointer"
                  onClick={() => setSelectedExercise(exercise)}
                >
                  {thumbnail ? (
                    <div className="relative h-48 bg-gray-900">
                      <img
                        src={thumbnail}
                        alt={exercise.name}
                        className="w-full h-full object-cover opacity-80"
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center shadow-lg">
                          <span className="text-white text-2xl ml-1">▶</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="h-48 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                      <span className="text-6xl">{muscleGroupEmojis[exercise.muscle_group]}</span>
                    </div>
                  )}
                </div>

                <div className="p-5">
                  <div className="flex items-start justify-between mb-2">
                    <h3
                      className="text-lg font-semibold text-gray-900 cursor-pointer hover:text-blue-600 transition-colors"
                      onClick={() => setSelectedExercise(exercise)}
                    >
                      {exercise.name}
                    </h3>
                    {exercise.difficulty && (
                      <span className={`px-2 py-1 rounded text-xs font-medium border ${difficultyColors[exercise.difficulty]}`}>
                        {exercise.difficulty}
                      </span>
                    )}
                  </div>

                  <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                    {exercise.description || 'No description available'}
                  </p>

                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700 capitalize">
                      {muscleGroupEmojis[exercise.muscle_group]} {exercise.muscle_group}
                    </span>

                    {/* Opens the floating workout player */}
                    {exercise.video_url && (
                      <button
                        onClick={() => startWorkoutVideo(exercise)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
                      >
                        <span>▶</span> Work Out
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </main>

      {/* ─── Exercise Detail Modal ─── */}
      {selectedExercise && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedExercise(null)}
        >
          <div
            className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {selectedExercise.video_url && (
              <div className="aspect-video w-full">
                <iframe
                  width="100%"
                  height="100%"
                  src={getYouTubeEmbedUrl(selectedExercise.video_url) || ''}
                  title={selectedExercise.name}
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="rounded-t-xl"
                />
              </div>
            )}

            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    {selectedExercise.name}
                  </h2>
                  <div className="flex items-center gap-3">
                    <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium capitalize">
                      {muscleGroupEmojis[selectedExercise.muscle_group]} {selectedExercise.muscle_group}
                    </span>
                    {selectedExercise.difficulty && (
                      <span className={`px-3 py-1 rounded-full text-sm font-medium border ${difficultyColors[selectedExercise.difficulty]}`}>
                        {selectedExercise.difficulty}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedExercise(null)}
                  className="text-gray-400 hover:text-gray-600 text-3xl leading-none"
                >
                  ×
                </button>
              </div>

              <div className="prose max-w-none">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Description</h3>
                <p className="text-gray-700">
                  {selectedExercise.description || 'No description available'}
                </p>
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => setSelectedExercise(null)}
                  className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
                >
                  Close
                </button>
                {selectedExercise.video_url && (
                  <>
                    <button
                      onClick={() => startWorkoutVideo(selectedExercise)}
                      className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors"
                    >
                      ▶ Work Out with This
                    </button>
                    <a
                      href={selectedExercise.video_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors text-center"
                    >
                      Watch on YouTube
                    </a>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Floating Workout Video Player ─── */}
      {workoutExercise && (
        <div
          className={`fixed top-20 right-4 z-50 bg-gray-900 rounded-2xl shadow-2xl overflow-hidden transition-all duration-300 ${
            isMinimised ? 'w-64' : 'w-80 sm:w-96'
          }`}
        >
          {/* Header bar */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-700">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-green-400 text-xs font-bold uppercase tracking-wide shrink-0">
                🏋️ Now
              </span>
              <span className="text-white text-sm font-medium truncate">
                {workoutExercise.name}
              </span>
            </div>
            <div className="flex items-center gap-1 ml-2 shrink-0">
              <button
                onClick={() => setIsMinimised((m) => !m)}
                className="text-gray-400 hover:text-white px-2 py-1 rounded text-xs transition-colors"
                title={isMinimised ? 'Expand' : 'Minimise'}
              >
                {isMinimised ? '▲' : '▼'}
              </button>
              <button
                onClick={() => setWorkoutExercise(null)}
                className="text-gray-400 hover:text-red-400 px-2 py-1 rounded text-xs transition-colors"
                title="Close player"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Video + switcher — hidden when minimised */}
          {!isMinimised && (
            <>
              <div className="aspect-video w-full">
                <iframe
                  width="100%"
                  height="100%"
                  src={getYouTubeEmbedUrlAutoplay(workoutExercise.video_url) || ''}
                  title={workoutExercise.name}
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>

              {/* Quick-switch to another exercise that has a video */}
              {filteredExercises.filter((e) => e.video_url && e.id !== workoutExercise.id).length > 0 && (
                <div className="p-3 border-t border-gray-700">
                  <p className="text-gray-400 text-xs mb-2">Switch exercise:</p>
                  <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
                    {filteredExercises
                      .filter((e) => e.video_url && e.id !== workoutExercise.id)
                      .map((e) => (
                        <button
                          key={e.id}
                          onClick={() => setWorkoutExercise(e)}
                          className="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded-lg transition-colors truncate max-w-[140px]"
                        >
                          {e.name}
                        </button>
                      ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}