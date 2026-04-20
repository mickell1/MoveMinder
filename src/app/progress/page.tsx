'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/src/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AppHeader } from '@/src/components/AppHeader'

type Profile = {
  full_name: string | null
  goals?: string[] | string | null
  fitness_level: string | null
  goal_weight: number | null
}

type WeighIn = {
  weight_kg: number
  logged_date: string
}

type WorkoutSession = {
  completed_at: string
}

function calcWeighInStreak(dates: string[]): number {
  if (dates.length === 0) return 0
  const set = new Set(dates)
  let streak = 0
  const cur = new Date()
  cur.setHours(0, 0, 0, 0)
  if (!set.has(cur.toLocaleDateString('en-CA'))) {
    cur.setDate(cur.getDate() - 1)
  }
  while (set.has(cur.toLocaleDateString('en-CA'))) {
    streak++
    cur.setDate(cur.getDate() - 1)
  }
  return streak
}

function calcWorkoutStreak(sessions: WorkoutSession[]): number {
  if (sessions.length === 0) return 0
  const dates = sessions.map(s => {
    const d = new Date(s.completed_at)
    d.setHours(0, 0, 0, 0)
    return d.getTime()
  })
  const uniqueDates = [...new Set(dates)].sort((a, b) => b - a)

  let streak = 0
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  let currentDate = today.getTime()

  for (const date of uniqueDates) {
    if (date === currentDate || date === currentDate - 86400000) {
      streak++
      currentDate = date - 86400000
    } else {
      break
    }
  }
  return streak
}

export default function ProgressPage() {
  const router = useRouter()
  const supabase = createClient()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [weighIns, setWeighIns] = useState<WeighIn[]>([])
  const [sessions, setSessions] = useState<WorkoutSession[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const [profileRes, weighInsRes, sessionsRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('full_name, goals, fitness_level, goal_weight')
          .eq('id', user.id)
          .single(),
        supabase
          .from('weigh_ins')
          .select('weight_kg, logged_date')
          .eq('user_id', user.id)
          .gte('logged_date', (() => {
            const d = new Date()
            d.setDate(d.getDate() - 90)
            return d.toLocaleDateString('en-CA')
          })())
          .order('logged_date', { ascending: false }),
        supabase
          .from('workout_sessions')
          .select('completed_at')
          .eq('user_id', user.id)
          .order('completed_at', { ascending: false }),
      ])

      setProfile(profileRes.data ?? null)
      setWeighIns((weighInsRes.data ?? []) as WeighIn[])
      setSessions((sessionsRes.data ?? []) as WorkoutSession[])
      setLoading(false)
    }

    loadData()
  }, [router, supabase])

  const goalLabels: Record<string, string> = {
    lose_weight: 'Lose Weight 🔥',
    build_muscle: 'Build Muscle 💪',
    get_fit: 'Get Fit ⚡',
    maintain: 'Stay Healthy 🎯',
  }

  const goalDisplay = (() => {
    const goalsRaw = profile?.goals
    if (!goalsRaw) return 'Fitness Journey'
    if (Array.isArray(goalsRaw)) {
      return goalLabels[goalsRaw[0]] ?? goalsRaw[0] ?? 'Fitness Journey'
    }
    if (typeof goalsRaw === 'string') {
      try {
        const parsed = JSON.parse(goalsRaw)
        if (Array.isArray(parsed) && parsed.length) return goalLabels[parsed[0]] ?? parsed[0]
        if (typeof parsed === 'string') return goalLabels[parsed] ?? parsed
      } catch {
        // not JSON
      }
      return goalLabels[goalsRaw] ?? goalsRaw
    }
    return 'Fitness Journey'
  })()

  const workoutStreak = calcWorkoutStreak(sessions)
  const weighInStreak = calcWeighInStreak(weighIns.map(w => w.logged_date))
  const totalWorkouts = sessions.length
  const currentWeight = weighIns.length > 0 ? weighIns[0].weight_kg : null
  const goalWeight = profile?.goal_weight ?? null

  const firstInitial = profile?.full_name?.trim()?.[0]?.toUpperCase() ?? '?'
  const fullName = profile?.full_name ?? 'You'

  const handleShare = async () => {
    const shareText = `🏋️ ${fullName}'s MoveMinder progress: ${totalWorkouts} workouts, ${workoutStreak}-day streak!`
    const shareUrl = window.location.href
    if ('share' in navigator) {
      await navigator.share({
        title: `${fullName}'s Progress`,
        text: shareText,
        url: shareUrl,
      })
    } else {
      await (navigator as Navigator).clipboard.writeText(shareText)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-xl text-gray-600">Loading...</div>
      </div>
    )
  }

  // Weight goal progress bar
  let weightGoalSection: React.ReactNode = null
  if (goalWeight !== null && currentWeight !== null) {
    const startWeight = weighIns.length > 0 ? weighIns[weighIns.length - 1].weight_kg : currentWeight
    const totalChange = Math.abs(startWeight - goalWeight)
    const progress = totalChange === 0
      ? 100
      : Math.min(100, Math.max(0, Math.abs(startWeight - currentWeight) / totalChange * 100))
    const remaining = Math.abs(currentWeight - goalWeight).toFixed(1)
    const achieved = Math.abs(currentWeight - goalWeight) < 0.5

    weightGoalSection = (
      <div className="col-span-2 mt-2">
        <div className="border-t border-gray-100 pt-4 mb-3" />
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Weight Goal</p>
        <div className="flex justify-between text-sm mb-2">
          <span className="text-gray-500">
            Current: <span className="font-semibold text-gray-900">{currentWeight} kg</span>
          </span>
          <span className="text-gray-500">
            Goal: <span className="font-semibold text-gray-900">{goalWeight} kg</span>
          </span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2.5 mb-1.5">
          <div
            className="bg-gradient-to-r from-blue-500 to-indigo-500 h-2.5 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-xs text-gray-500 text-center">
          {achieved ? '🎉 Goal reached!' : `${remaining} kg to go`}
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <AppHeader
        title="My Progress"
        links={[
          { href: '/dashboard', label: 'Dashboard' },
          { href: '/feed', label: 'Feed' },
        ]}
      />

      <main className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-8">
          {/* Avatar + Name */}
          <div className="flex flex-col items-center mb-6">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mb-4 shadow-md">
              <span className="text-white text-2xl font-bold">{firstInitial}</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 text-center">{fullName}</h2>
            <p className="text-sm text-gray-500 mt-1">{goalDisplay}</p>
          </div>

          <div className="border-t border-gray-100 mb-6" />

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-4 mb-2">
            <div className="bg-blue-50 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-blue-700">{totalWorkouts}</p>
              <p className="text-xs text-blue-500 mt-0.5 font-medium">Total Workouts</p>
            </div>
            <div className="bg-indigo-50 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-indigo-700">{workoutStreak}</p>
              <p className="text-xs text-indigo-500 mt-0.5 font-medium">Workout Streak</p>
            </div>
            <div className="bg-purple-50 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-purple-700">{weighInStreak}</p>
              <p className="text-xs text-purple-500 mt-0.5 font-medium">Weigh-In Streak</p>
            </div>
            <div className="bg-pink-50 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-pink-700">
                {currentWeight !== null ? `${currentWeight}` : '—'}
              </p>
              <p className="text-xs text-pink-500 mt-0.5 font-medium">Current Weight (kg)</p>
            </div>

            {weightGoalSection}
          </div>

          <div className="border-t border-gray-100 mt-6 mb-6" />

          {/* Share Button */}
          <button
            onClick={handleShare}
            className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-sm mb-3"
          >
            Share Progress
          </button>

          {/* Back to Dashboard */}
          <Link
            href="/dashboard"
            className="block w-full text-center py-2.5 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
          >
            ← Back to Dashboard
          </Link>
        </div>
      </main>
    </div>
  )
}
