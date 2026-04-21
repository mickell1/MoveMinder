'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/src/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

type Exercise = {
  id: string
  exercise_id: string
  name: string
  sets: number
  reps: number
  rest_seconds: number
  order_index: number
  video_url?: string | null
  muscle_group?: string | null
}

type SetLog = {
  workoutExerciseId: string
  exerciseId: string
  setNumber: number
  reps: number
  weight: number
  completed: boolean
}

function getYouTubeId(url: string): string | null {
  try {
    const p = new URL(url)
    if (p.hostname.includes('youtu.be')) return p.pathname.slice(1).split('?')[0]
    if (p.pathname.includes('/shorts/')) return p.pathname.split('/shorts/')[1].split('/')[0]
    return p.searchParams.get('v')
  } catch { return null }
}

const muscleEmoji: Record<string, string> = {
  chest: '💪', back: '🦾', legs: '🦵', shoulders: '🏋️', arms: '💪', core: '🔥',
}

export default function WorkoutLogPage() {
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()

  const [workoutName, setWorkoutName] = useState('')
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [setLogs, setSetLogs] = useState<SetLog[]>([])
  const [currentExIdx, setCurrentExIdx] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Start gate
  const [started, setStarted] = useState(false)

  // Video collapsed by default
  const [videoOpen, setVideoOpen] = useState(false)

  // Manual rest timer
  const [timerDuration, setTimerDuration] = useState(60)
  const [timerRemaining, setTimerRemaining] = useState(60)
  const [timerRunning, setTimerRunning] = useState(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const startTime = useRef(new Date())

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: workout } = await supabase.from('workouts').select('*').eq('id', params.id).eq('user_id', user.id).single()
      if (!workout) { router.push('/dashboard/workouts'); return }
      setWorkoutName(workout.name)

      type WERow = {
        id: string; exercise_id: string; sets: number; reps: number; rest_seconds: number; order_index: number
        exercises: { name: string; video_url: string | null; muscle_group: string | null } | null
      }
      const { data: exData } = await supabase
        .from('workout_exercises')
        .select('id, exercise_id, sets, reps, rest_seconds, order_index, exercises!exercise_id(name, video_url, muscle_group)')
        .eq('workout_id', params.id)
        .order('order_index', { ascending: true })

      const flat: Exercise[] = ((exData ?? []) as unknown as WERow[]).map(r => ({
        id: r.id, exercise_id: r.exercise_id,
        name: r.exercises?.name ?? 'Unknown',
        sets: r.sets, reps: r.reps, rest_seconds: r.rest_seconds, order_index: r.order_index,
        video_url: r.exercises?.video_url ?? null,
        muscle_group: r.exercises?.muscle_group ?? null,
      }))
      setExercises(flat)

      const logs: SetLog[] = []
      flat.forEach(ex => {
        for (let i = 1; i <= ex.sets; i++) {
          logs.push({ workoutExerciseId: ex.id, exerciseId: ex.exercise_id, setNumber: i, reps: ex.reps, weight: 0, completed: false })
        }
      })
      setSetLogs(logs)
      setLoading(false)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Timer countdown
  useEffect(() => {
    if (timerRunning) {
      timerRef.current = setInterval(() => {
        setTimerRemaining(prev => {
          if (prev <= 1) { setTimerRunning(false); return 0 }
          return prev - 1
        })
      }, 1000)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [timerRunning])

  function selectDuration(secs: number) {
    setTimerRunning(false)
    if (timerRef.current) clearInterval(timerRef.current)
    setTimerDuration(secs)
    setTimerRemaining(secs)
  }
  function toggleTimer() {
    if (timerRemaining === 0) setTimerRemaining(timerDuration)
    setTimerRunning(r => !r)
  }
  function resetTimer() {
    setTimerRunning(false)
    if (timerRef.current) clearInterval(timerRef.current)
    setTimerRemaining(timerDuration)
  }

  function updateSet(workoutExerciseId: string, setNumber: number, field: 'reps' | 'weight', value: number) {
    setSetLogs(logs => logs.map(l =>
      l.workoutExerciseId === workoutExerciseId && l.setNumber === setNumber ? { ...l, [field]: value } : l
    ))
  }
  function toggleSet(workoutExerciseId: string, setNumber: number) {
    setSetLogs(logs => logs.map(l =>
      l.workoutExerciseId === workoutExerciseId && l.setNumber === setNumber ? { ...l, completed: !l.completed } : l
    ))
  }

  async function finishWorkout() {
    if (!confirm('Finish and save this workout?')) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const end = new Date()
    const dur = Math.round((end.getTime() - startTime.current.getTime()) / 60000)

    const { data: session, error: sErr } = await supabase
      .from('workout_sessions')
      .insert({ user_id: user.id, workout_id: params.id, started_at: startTime.current.toISOString(), completed_at: end.toISOString(), duration_minutes: dur })
      .select().single()

    if (sErr || !session) { alert('Failed to save workout'); setSaving(false); return }

    const completedSets = setLogs.filter(l => l.completed).map(l => ({
      session_id: session.id, exercise_id: l.exerciseId, set_number: l.setNumber, reps: l.reps, weight: l.weight,
    }))
    if (completedSets.length > 0) {
      await supabase.from('workout_sets').insert(completedSets)
    }

    // Milestone check
    const { count: total } = await supabase.from('workout_sessions').select('id', { count: 'exact', head: true }).eq('user_id', user.id)
    const milestones: Record<number, string> = { 10: 'hit 10 workouts! 💪', 25: 'completed 25 workouts! 🔥', 50: 'reached 50 workouts! 🏆', 100: 'hit 100 workouts! 🎉', 250: 'completed 250 workouts! 🌟' }
    if (total && milestones[total]) {
      await supabase.from('feed_posts').upsert(
        { user_id: user.id, post_type: 'milestone_workout', milestone_key: `workouts_${total}`, message: milestones[total] },
        { onConflict: 'user_id,milestone_key', ignoreDuplicates: true }
      )
    }

    router.push('/dashboard/history')
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-lg text-gray-600">Loading workout...</div>
    </div>
  )

  const currentEx = exercises[currentExIdx]
  const totalSets = setLogs.length
  const doneSets = setLogs.filter(l => l.completed).length
  const progress = totalSets > 0 ? (doneSets / totalSets) * 100 : 0

  // ── PRE-START SCREEN ──
  if (!started) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b sticky top-0 z-50 shadow-sm">
          <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
            <Link href="/dashboard/workouts" className="text-gray-500 hover:text-gray-800 p-1 -ml-1">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="text-base font-bold text-gray-900 truncate flex-1">{workoutName}</h1>
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h2 className="text-lg font-bold text-gray-900 mb-1">Ready to train?</h2>
            <p className="text-sm text-gray-500 mb-4">{exercises.length} exercise{exercises.length !== 1 ? 's' : ''} · {setLogs.length} total sets</p>
            <div className="space-y-2 mb-6">
              {exercises.map((ex, i) => (
                <div key={ex.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                    <span className="text-sm text-gray-800">{ex.name}</span>
                  </div>
                  <span className="text-xs text-gray-500 flex-shrink-0 ml-2">{ex.sets} × {ex.reps}</span>
                </div>
              ))}
            </div>
            <button
              onClick={() => { startTime.current = new Date(); setStarted(true) }}
              className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold text-lg hover:bg-blue-700 active:scale-95 transition-all shadow-md"
            >
              Start Workout
            </button>
          </div>
        </main>
      </div>
    )
  }

  // ── ACTIVE WORKOUT ──
  const exSets = setLogs.filter(l => l.workoutExerciseId === currentEx?.id)
  const exDone = exSets.filter(l => l.completed).length
  const videoId = currentEx?.video_url ? getYouTubeId(currentEx.video_url) : null
  const embedUrl = videoId ? `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&autoplay=0&mute=0` : null
  const emoji = muscleEmoji[currentEx?.muscle_group ?? ''] ?? '💪'

  const timerMins = Math.floor(timerRemaining / 60).toString().padStart(2, '0')
  const timerSecs = (timerRemaining % 60).toString().padStart(2, '0')

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-50 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <h1 className="text-base font-bold text-gray-900 truncate flex-1">{workoutName}</h1>
          <button onClick={finishWorkout} disabled={saving}
            className="flex-shrink-0 px-3 py-1.5 bg-red-50 text-red-600 text-sm font-semibold rounded-xl hover:bg-red-100 active:scale-95 transition-all disabled:opacity-50">
            {saving ? 'Saving…' : 'Finish'}
          </button>
        </div>
        {/* Progress bar */}
        <div className="w-full bg-gray-100 h-1">
          <div className="bg-blue-500 h-1 transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-4 space-y-4">

        {/* Progress summary */}
        <p className="text-xs text-gray-500 text-center">{doneSets} of {totalSets} sets completed</p>

        {/* Exercise navigation */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
          {exercises.map((ex, i) => {
            const s = setLogs.filter(l => l.workoutExerciseId === ex.id)
            const d = s.filter(l => l.completed).length
            const allDone = d === ex.sets
            return (
              <button key={ex.id} onClick={() => { setCurrentExIdx(i); setVideoOpen(false) }}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  i === currentExIdx
                    ? 'bg-blue-600 text-white'
                    : allDone
                    ? 'bg-green-100 text-green-700'
                    : 'bg-white text-gray-600 border border-gray-200'
                }`}>
                {allDone ? '✓ ' : ''}{ex.name}
              </button>
            )
          })}
        </div>

        {/* Current exercise card */}
        {currentEx && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {/* Exercise header */}
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <div className="min-w-0">
                <h2 className="text-base font-bold text-gray-900 truncate">{currentEx.name}</h2>
                <p className="text-xs text-gray-500">{currentEx.sets} sets · {currentEx.reps} reps target{currentEx.muscle_group ? ` · ${emoji} ${currentEx.muscle_group}` : ''}</p>
              </div>
              {/* Video toggle */}
              {currentEx.video_url && (
                <button onClick={() => setVideoOpen(v => !v)}
                  className="flex-shrink-0 ml-3 px-3 py-1.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-xl hover:bg-gray-200 transition-colors">
                  {videoOpen ? 'Hide Video' : '▶ Video'}
                </button>
              )}
            </div>

            {/* Video (lazy — only loads when opened) */}
            {videoOpen && embedUrl && (
              <div className="aspect-video bg-black">
                <iframe key={currentEx.id} width="100%" height="100%" src={embedUrl} title={currentEx.name}
                  frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen />
              </div>
            )}
            {videoOpen && !embedUrl && (
              <div className="aspect-video bg-gradient-to-br from-blue-900 to-indigo-900 flex items-center justify-center">
                <div className="text-center"><div className="text-7xl mb-2">{emoji}</div><p className="text-white text-sm">No video available</p></div>
              </div>
            )}

            {/* Sets table */}
            <div className="p-4">
              {/* Column headers */}
              <div className="grid grid-cols-[32px_1fr_1fr_40px] gap-2 mb-2 text-xs text-gray-400 font-medium px-1">
                <span>Set</span>
                <span>Reps</span>
                <span>Weight</span>
                <span className="text-center">✓</span>
              </div>
              <div className="space-y-2">
                {exSets.map(log => (
                  <div key={log.setNumber} className={`grid grid-cols-[32px_1fr_1fr_40px] gap-2 items-center p-2 rounded-xl transition-colors ${log.completed ? 'bg-green-50' : 'bg-gray-50'}`}>
                    <span className={`text-sm font-bold text-center ${log.completed ? 'text-green-600' : 'text-gray-500'}`}>{log.setNumber}</span>
                    <input type="number" min="0" value={log.reps}
                      onChange={e => updateSet(log.workoutExerciseId, log.setNumber, 'reps', parseInt(e.target.value) || 0)}
                      className="w-full px-2 py-2 text-sm font-semibold text-center border border-gray-200 rounded-lg focus:border-blue-400 focus:outline-none bg-white"
                      placeholder="Reps"
                    />
                    <input type="number" min="0" step="2.5" value={log.weight || ''}
                      onChange={e => updateSet(log.workoutExerciseId, log.setNumber, 'weight', parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-2 text-sm font-semibold text-center border border-gray-200 rounded-lg focus:border-blue-400 focus:outline-none bg-white"
                      placeholder="kg"
                    />
                    <button onClick={() => toggleSet(log.workoutExerciseId, log.setNumber)}
                      className={`w-9 h-9 rounded-xl border-2 flex items-center justify-center transition-all active:scale-90 ${
                        log.completed ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 bg-white'
                      }`}>
                      {log.completed && (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  </div>
                ))}
              </div>
              {exDone === currentEx.sets && (
                <p className="text-center text-sm text-green-600 font-semibold mt-3">✓ All sets done!</p>
              )}
            </div>

            {/* Next exercise button */}
            {currentExIdx < exercises.length - 1 && (
              <div className="px-4 pb-4">
                <button onClick={() => { setCurrentExIdx(i => i + 1); setVideoOpen(false) }}
                  className="w-full py-2.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50 active:scale-95 transition-all">
                  Next: {exercises[currentExIdx + 1].name} →
                </button>
              </div>
            )}
          </div>
        )}

        {/* Rest Timer */}
        <div className="bg-gray-900 rounded-2xl p-4 text-white">
          <p className="text-xs font-medium text-gray-400 text-center mb-3">Rest Timer</p>

          {/* Duration selector */}
          <div className="flex gap-2 justify-center mb-4">
            {[{ label: '30s', val: 30 }, { label: '60s', val: 60 }, { label: '2 min', val: 120 }].map(d => (
              <button key={d.val} onClick={() => selectDuration(d.val)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${timerDuration === d.val ? 'bg-white text-gray-900' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>
                {d.label}
              </button>
            ))}
          </div>

          {/* Countdown */}
          <div className={`text-center text-5xl font-bold tabular-nums mb-4 ${timerRemaining === 0 ? 'text-green-400' : 'text-white'}`}>
            {timerMins}:{timerSecs}
          </div>

          {timerRemaining === 0 && <p className="text-center text-green-400 text-sm font-medium mb-3">Rest complete!</p>}

          {/* Controls */}
          <div className="flex gap-3 justify-center">
            <button onClick={toggleTimer}
              className="px-8 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 active:scale-95 transition-all">
              {timerRunning ? 'Pause' : timerRemaining === 0 ? 'Restart' : 'Start'}
            </button>
            <button onClick={resetTimer}
              className="px-5 py-2.5 bg-gray-700 text-gray-200 text-sm font-medium rounded-xl hover:bg-gray-600 active:scale-95 transition-all">
              Reset
            </button>
          </div>
        </div>

        {/* Finish workout */}
        <button onClick={finishWorkout} disabled={saving}
          className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold text-lg rounded-2xl hover:from-green-600 hover:to-emerald-600 active:scale-95 transition-all shadow-md disabled:opacity-50">
          {saving ? 'Saving…' : `Save Workout (${doneSets}/${totalSets} sets)`}
        </button>
      </main>
    </div>
  )
}
