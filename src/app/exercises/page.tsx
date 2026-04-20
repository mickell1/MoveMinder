'use client'

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
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

// ─── Media helpers — support YouTube URLs, direct GIFs, and MP4/WebM ────────
type MediaType = 'youtube' | 'gif' | 'video' | null

function getMediaType(url: string | null | undefined): MediaType {
  if (!url) return null
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube'
  if (/\.gif(\?|$)/i.test(url)) return 'gif'
  if (/\.(mp4|webm|mov)(\?|$)/i.test(url)) return 'video'
  return 'youtube'
}

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

function getYouTubeEmbedUrl(url: string | null): string | null {
  if (!url) return null
  const id = getYouTubeVideoId(url)
  return id ? `https://www.youtube-nocookie.com/embed/${id}?rel=0` : null
}

function getYouTubeEmbedUrlAutoplay(url: string | null): string | null {
  if (!url) return null
  const id = getYouTubeVideoId(url)
  return id ? `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&mute=1&loop=1&playlist=${id}&rel=0` : null
}

function getYouTubeThumbnail(url: string | null): string | null {
  if (!url) return null
  const id = getYouTubeVideoId(url)
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null
}

// Generic media player — renders the right element for the media type
function ExerciseMediaPlayer({ exercise, autoplay = false }: {
  exercise: Exercise
  autoplay?: boolean
}) {
  const type = getMediaType(exercise.video_url)

  if (type === 'youtube') {
    const src = autoplay
      ? getYouTubeEmbedUrlAutoplay(exercise.video_url)
      : getYouTubeEmbedUrl(exercise.video_url)
    if (!src) return null
    return (
      <iframe
        key={exercise.id}
        width="100%"
        height="100%"
        src={src}
        title={exercise.name}
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    )
  }

  if (type === 'gif') {
    // Animated GIFs loop forever and autoplay by default
    return (
      <img
        src={exercise.video_url!}
        alt={exercise.name}
        className="w-full h-full object-contain bg-black"
      />
    )
  }

  if (type === 'video') {
    return (
      <video
        key={exercise.id}
        src={exercise.video_url!}
        autoPlay={autoplay}
        muted
        loop
        playsInline
        controls
        className="w-full h-full object-contain bg-black"
      />
    )
  }

  return null
}

// SSR-safe "am I on the client" hook — needed for portaled modal
const emptySubscribe = () => () => {}
function useIsClient(): boolean {
  return useSyncExternalStore(emptySubscribe, () => true, () => false)
}

export default function ExercisesPage() {
  const router = useRouter()
  const supabase = createClient()
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMuscleGroup, setSelectedMuscleGroup] = useState<string>('all')
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null)
  const [creatingWorkout, setCreatingWorkout] = useState(false)

  // Sticky video reference (replaces floating player)
  const [workoutExercise, setWorkoutExercise] = useState<Exercise | null>(null)
  const [isVideoCollapsed, setIsVideoCollapsed] = useState(false)

  const isClient = useIsClient()

  const muscleGroups = ['all', 'chest', 'back', 'legs', 'shoulders', 'arms', 'core']

  useEffect(() => {
    async function loadExercises() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

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
    chest: '💪', back: '🦾', legs: '🦵', shoulders: '🏋️',
    arms: '💪', core: '🔥', all: '🎯',
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Auto workout generator — now uses REGULAR QUERIES instead of an RPC,
  // so it works whether or not `get_random_exercises_by_groups` exists in the
  // database. Fisher-Yates shuffle picks N random exercises per muscle group.
  // ══════════════════════════════════════════════════════════════════════════
  const createAutoWorkout = async (type: 'full' | 'upper' | 'lower') => {
    setCreatingWorkout(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setCreatingWorkout(false); return }

      let targetGroups: string[] = []
      let workoutName = ''

      if (type === 'full') {
        targetGroups = ['chest', 'back', 'legs', 'shoulders', 'arms', 'core']
        workoutName = 'Full Body Workout'
      } else if (type === 'upper') {
        targetGroups = ['chest', 'back', 'shoulders', 'arms']
        workoutName = 'Upper Body Workout'
      } else {
        targetGroups = ['legs', 'core']
        workoutName = 'Lower Body Workout'
      }
      const exercisesPerGroup = type === 'lower' ? 3 : 2

      // Fetch all exercises for the target groups in one query
      const { data: pool, error: poolErr } = await supabase
        .from('exercises')
        .select('*')
        .in('muscle_group', targetGroups)

      if (poolErr) {
        console.error('Error fetching exercise pool:', poolErr)
        alert('Failed to load exercises')
        setCreatingWorkout(false)
        return
      }

      if (!pool || pool.length === 0) {
        alert('No exercises found in the database for these muscle groups')
        setCreatingWorkout(false)
        return
      }

      // Group by muscle_group, shuffle within each, take N
      const selected: Exercise[] = []
      for (const group of targetGroups) {
        const groupExercises = pool.filter((e: Exercise) => e.muscle_group === group)
        // Fisher-Yates shuffle
        const shuffled = [...groupExercises]
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1))
          ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
        }
        selected.push(...shuffled.slice(0, exercisesPerGroup))
      }

      if (selected.length === 0) {
        alert('Not enough exercises to build this workout')
        setCreatingWorkout(false)
        return
      }

      // Create the workout
      const { data: workout, error: workoutErr } = await supabase
        .from('workouts')
        .insert({
          user_id: user.id,
          name: workoutName,
          description: `Auto-generated ${type} body workout`,
          difficulty: 'intermediate',
        })
        .select()
        .single()

      if (workoutErr || !workout) {
        console.error('Workout create error:', workoutErr)
        alert('Failed to create workout')
        setCreatingWorkout(false)
        return
      }

      const workoutExercises = selected.map((ex, index) => ({
        workout_id: workout.id,
        exercise_id: ex.id,
        name: ex.name,
        sets: 3,
        reps: 12,
        rest_seconds: 60,
        order_index: index,
      }))

      const { error: weErr } = await supabase
        .from('workout_exercises')
        .insert(workoutExercises)

      if (weErr) {
        console.error('Insert workout_exercises error:', weErr)
        alert('Failed to add exercises to workout')
        setCreatingWorkout(false)
        return
      }

      setCreatingWorkout(false)
      router.push(`/dashboard/workouts/${workout.id}`)
    } catch (err) {
      console.error('Auto workout error:', err)
      alert('Something went wrong creating the workout')
      setCreatingWorkout(false)
    }
  }

  const startWorkoutVideo = (exercise: Exercise) => {
    setWorkoutExercise(exercise)
    setIsVideoCollapsed(false)
    setSelectedExercise(null)

    // Scroll to the top so they see the sticky video immediately
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-xl text-gray-600">Loading exercises...</div>
      </div>
    )
  }

  // ─── Detail modal (portaled) ────────────────────────────────────────────────
  const detailModal = selectedExercise ? (
    <div
      className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4"
      style={{ zIndex: 9998 }}
      onClick={() => setSelectedExercise(null)}
    >
      <div
        className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {selectedExercise.video_url ? (
          <div className="aspect-video w-full">
            <ExerciseMediaPlayer exercise={selectedExercise} />
          </div>
        ) : null}

        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">{selectedExercise.name}</h2>
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
            >×</button>
          </div>

          <div className="prose max-w-none">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Description</h3>
            <p className="text-gray-700">
              {selectedExercise.description || 'No description available'}
            </p>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={() => setSelectedExercise(null)}
              className="flex-1 min-w-[120px] px-6 py-3 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
            >Close</button>
            <button
              onClick={() => startWorkoutVideo(selectedExercise)}
              className="flex-1 min-w-[120px] px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors"
            >▶ Work Out with This</button>
            {!selectedExercise.video_url && (
              <a
                href={`https://www.youtube.com/results?search_query=${encodeURIComponent('how to ' + selectedExercise.name + ' proper form')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 min-w-[120px] px-6 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors text-center"
              >🔍 Find on YouTube</a>
            )}
          </div>
        </div>
      </div>
    </div>
  ) : null

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <Link href="/dashboard" className="text-2xl hover:opacity-70 transition-opacity">←</Link>
              <h1 className="text-2xl font-bold text-gray-900">Exercise Library</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* ══════════════════════════════════════════════════════════════════
            STICKY VIDEO REFERENCE — replaces the floating player.
            Uses `sticky` (not `fixed`) so it's immune to containing-block
            issues from ancestors.
        ══════════════════════════════════════════════════════════════════ */}
        {workoutExercise && (
          <div className="sticky top-20 z-30 mb-6">
            <div className="bg-gray-900 rounded-xl shadow-2xl overflow-hidden ring-1 ring-black/5">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-2.5 bg-gray-800">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-green-400 text-xs font-bold uppercase tracking-wider shrink-0">
                    🎬 Now
                  </span>
                  <span className="text-white text-sm font-semibold truncate">
                    {workoutExercise.name}
                  </span>
                  <span className="text-gray-400 text-xs capitalize shrink-0 hidden sm:inline">
                    • {muscleGroupEmojis[workoutExercise.muscle_group]} {workoutExercise.muscle_group}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <button
                    onClick={() => setIsVideoCollapsed((c) => !c)}
                    className="text-gray-300 hover:text-white text-xs px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 transition-colors"
                  >
                    {isVideoCollapsed ? '▼ Show' : '▲ Hide'}
                  </button>
                  <button
                    onClick={() => setWorkoutExercise(null)}
                    className="text-gray-300 hover:text-red-400 text-xs px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 transition-colors"
                    title="Close"
                  >✕</button>
                </div>
              </div>

              {!isVideoCollapsed && (
                <>
                  {workoutExercise.video_url ? (
                    <div className="aspect-video w-full bg-black">
                      <ExerciseMediaPlayer exercise={workoutExercise} autoplay />
                    </div>
                  ) : (
                    <div className="aspect-video w-full bg-gradient-to-br from-blue-900 via-indigo-900 to-purple-900 flex items-center justify-center">
                      <div className="text-center p-4">
                        <div className="text-7xl mb-3">{muscleGroupEmojis[workoutExercise.muscle_group]}</div>
                        <p className="text-white font-semibold mb-3">No video yet for this exercise</p>
                        <a
                          href={`https://www.youtube.com/results?search_query=${encodeURIComponent('how to ' + workoutExercise.name + ' proper form')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block px-5 py-2.5 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors text-sm"
                        >🔍 Search YouTube</a>
                      </div>
                    </div>
                  )}

                  {/* Quick-switch to another exercise */}
                  {filteredExercises.filter((e) => e.id !== workoutExercise.id).length > 0 && (
                    <div className="p-3 border-t border-gray-700">
                      <p className="text-gray-400 text-xs mb-2">Switch exercise:</p>
                      <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
                        {filteredExercises
                          .filter((e) => e.id !== workoutExercise.id)
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
          </div>
        )}

        {/* Auto Workout Generator */}
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl shadow-lg p-8 mb-8 text-white">
          <h2 className="text-2xl font-bold mb-2">🤖 Auto Workout Generator</h2>
          <p className="mb-6 opacity-90">Let AI create a workout routine for you!</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => createAutoWorkout('full')}
              disabled={creatingWorkout}
              className="bg-white text-blue-600 px-6 py-4 rounded-lg font-semibold hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >🎯 Full Body</button>
            <button
              onClick={() => createAutoWorkout('upper')}
              disabled={creatingWorkout}
              className="bg-white text-purple-600 px-6 py-4 rounded-lg font-semibold hover:bg-purple-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >💪 Upper Body</button>
            <button
              onClick={() => createAutoWorkout('lower')}
              disabled={creatingWorkout}
              className="bg-white text-pink-600 px-6 py-4 rounded-lg font-semibold hover:bg-pink-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >🦵 Lower Body</button>
          </div>

          {creatingWorkout && <p className="mt-4 text-center animate-pulse">Creating your workout...</p>}
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
            const mediaType = getMediaType(exercise.video_url)
            // Use GIF itself as thumbnail preview if it's a GIF
            const previewSrc = mediaType === 'gif' ? exercise.video_url : thumbnail

            return (
              <div
                key={exercise.id}
                className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-lg transition-all"
              >
                <div className="cursor-pointer" onClick={() => setSelectedExercise(exercise)}>
                  {previewSrc ? (
                    <div className="relative h-48 bg-gray-900">
                      <img
                        src={previewSrc}
                        alt={exercise.name}
                        className="w-full h-full object-cover opacity-80"
                      />
                      {mediaType === 'youtube' && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center shadow-lg">
                            <span className="text-white text-2xl ml-1">▶</span>
                          </div>
                        </div>
                      )}
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
                    >{exercise.name}</h3>
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

                    <button
                      onClick={() => startWorkoutVideo(exercise)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
                    >
                      <span>▶</span> Work Out
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </main>

      {/* Portaled detail modal — escapes any parent containing-block issues */}
      {isClient && detailModal && createPortal(detailModal, document.body)}
    </div>
  )
}