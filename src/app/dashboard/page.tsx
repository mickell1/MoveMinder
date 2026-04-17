'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/src/lib/supabase/client'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import type { User } from '@supabase/supabase-js'

type Profile = {
  full_name: string | null
  goals?: string[] | string | null
  fitness_level: string | null
  workout_frequency: string | null
}

type WorkoutSession = {
  id: string
  workout_id: string
  completed_at: string
  duration_minutes: number
  workouts: {
    name: string
  }[] | null
}

export default function DashboardPage() {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [recentSessions, setRecentSessions] = useState<WorkoutSession[]>([])
  const [stats, setStats] = useState({
    thisWeek: 0,
    total: 0,
    streak: 0
  })

  useEffect(() => {
    async function loadProfile() {
      const { data } = await supabase.auth.getUser()
      const user = data?.user as User | null
      
      if (!user) {
        router.push('/login')
        return
      }

      const profileResponse = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (profileResponse.error) {
        console.error('Failed to fetch profile:', profileResponse.error)
      }

      setProfile(profileResponse.data ?? null)

      // Fetch recent workout sessions
      const sessionsResponse = await supabase
        .from('workout_sessions')
        .select(`
          id,
          workout_id,
          completed_at,
          duration_minutes,
          workouts (
            name
          )
        `)
        .eq('user_id', user.id)
        .order('completed_at', { ascending: false })
        .limit(5)

      if (sessionsResponse.data) {
        setRecentSessions(sessionsResponse.data as WorkoutSession[])
      }

      // Calculate stats
      const allSessionsResponse = await supabase
        .from('workout_sessions')
        .select('completed_at')
        .eq('user_id', user.id)
        .order('completed_at', { ascending: false })

      if (allSessionsResponse.data) {
        // Total workouts
        const total = allSessionsResponse.data.length

        // Workouts this week
        const now = new Date()
        const startOfWeek = new Date(now)
        startOfWeek.setDate(now.getDate() - now.getDay())
        startOfWeek.setHours(0, 0, 0, 0)
        
        const thisWeek = allSessionsResponse.data.filter((session: { completed_at: string }) => 
          new Date(session.completed_at) >= startOfWeek
        ).length

        // Calculate streak
        let streak = 0
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        
        const dates = allSessionsResponse.data.map((s: { completed_at: string }) => {
          const d = new Date(s.completed_at)
          d.setHours(0, 0, 0, 0)
          return d.getTime()
        })
        
        const uniqueDates = [...new Set(dates)].sort((a: number, b: number) => b - a)
        
        let currentDate = today.getTime()
        for (const date of uniqueDates) {
          if (date === currentDate || date === currentDate - 86400000) {
            streak++
            currentDate = date - 86400000
          } else {
            break
          }
        }

        setStats({ thisWeek, total, streak })
      }

      setLoading(false)

      // Redirect to onboarding if not completed
      const hasFitness = !!profileResponse.data?.fitness_level
      let hasGoals = false
      const goalsRaw = profileResponse.data?.goals

      if (Array.isArray(goalsRaw)) {
        hasGoals = (goalsRaw as unknown[]).length > 0
      } else if (typeof goalsRaw === 'string') {
        try {
          const parsed = JSON.parse(goalsRaw as string)
          hasGoals = Array.isArray(parsed) ? parsed.length > 0 : !!parsed
        } catch {
          hasGoals = (goalsRaw as string).trim().length > 0
        }
      } else {
        hasGoals = !!goalsRaw
      }

      if (pathname?.startsWith('/dashboard') && (!hasFitness || !hasGoals)) {
        router.push('/onboarding')
      }
    }

    loadProfile()
  }, [router, supabase, pathname])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const goalLabels: Record<string, string> = {
    lose_weight: 'Lose Weight 🔥',
    build_muscle: 'Build Muscle 💪',
    get_fit: 'Get Fit ⚡',
    maintain: 'Stay Healthy 🎯',
  }

  const goalDisplay = (() => {
    const goalsRaw = profile?.goals
    if (!goalsRaw) return 'Not set'
    if (Array.isArray(goalsRaw)) {
      return goalLabels[goalsRaw[0]] ?? goalsRaw[0] ?? 'Not set'
    }
    if (typeof goalsRaw === 'string') {
      try {
        const parsed = JSON.parse(goalsRaw as string)
        if (Array.isArray(parsed) && parsed.length) return goalLabels[parsed[0]] ?? parsed[0]
        if (typeof parsed === 'string') return goalLabels[parsed] ?? parsed
      } catch {
        // not JSON, fallthrough
      }
      return goalLabels[goalsRaw] ?? goalsRaw
    }
    return 'Not set'
  })()

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffHours < 24) {
      if (diffHours < 1) return 'Just now'
      return `${diffHours}h ago`
    } else if (diffDays === 1) {
      return 'Yesterday'
    } else if (diffDays < 7) {
      return `${diffDays} days ago`
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
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
      <header className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <span className="text-3xl">💪</span>
              <h1 className="text-2xl font-bold text-gray-900">Fitness Coach</h1>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href="/dashboard/workouts"
                className="text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors"
              >
                Workouts
              </Link>
              <Link
                href="/dashboard/history"
                className="text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors"
              >
                History
              </Link>
              <Link
                href="/exercises"
                className="text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors"
              >
                Exercises
              </Link>
              <button
                onClick={handleLogout}
                className="text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome back, {profile?.full_name || 'there'}! 👋
          </h2>
          <p className="text-gray-600">
            Goal: {goalDisplay} • 
            Level: {profile?.fitness_level || 'Not set'} • 
            Training {profile?.workout_frequency || '0'}x/week
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600">Workouts This Week</h3>
              <span className="text-2xl">🔥</span>
            </div>
            <p className="text-3xl font-bold text-gray-900">{stats.thisWeek}</p>
            <p className="text-sm text-gray-500 mt-1">Goal: {profile?.workout_frequency || '3'}/week</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600">Total Workouts</h3>
              <span className="text-2xl">💪</span>
            </div>
            <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
            <p className="text-sm text-gray-500 mt-1">Keep it up!</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600">Current Streak</h3>
              <span className="text-2xl">⚡</span>
            </div>
            <p className="text-3xl font-bold text-gray-900">{stats.streak} days</p>
            <p className="text-sm text-gray-500 mt-1">
              {stats.streak > 0 ? 'Amazing!' : 'Start your streak!'}
            </p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 mb-8">
          <h3 className="text-xl font-bold text-gray-900 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link
              href="/dashboard/workouts/new"
              className="p-6 border-2 border-dashed border-gray-300 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all group"
            >
              <div className="text-3xl mb-2">➕</div>
              <h4 className="font-semibold text-gray-900 mb-1 group-hover:text-blue-600">Create Workout</h4>
              <p className="text-sm text-gray-600">Build a custom workout routine</p>
            </Link>

            <Link
              href="/exercises"
              className="p-6 border-2 border-dashed border-gray-300 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all group"
            >
              <div className="text-3xl mb-2">📚</div>
              <h4 className="font-semibold text-gray-900 mb-1 group-hover:text-blue-600">Browse Exercises</h4>
              <p className="text-sm text-gray-600">Explore our exercise library</p>
            </Link>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-gray-900">Recent Activity</h3>
            {recentSessions.length > 0 && (
              <Link
                href="/dashboard/history"
                className="text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                View All
              </Link>
            )}
          </div>
          
          {recentSessions.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🏋️</div>
              <p className="text-gray-500 mb-4">No workouts yet</p>
              <Link
                href="/dashboard/workouts/new"
                className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
              >
                Start Your First Workout
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {recentSessions.map((session) => (
                <div
                  key={session.id}
                  className="p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-gray-50 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                        <span className="text-lg">✓</span>
                      </div>
                      <div>
                <h4 className="font-semibold text-gray-900">
                {session.workouts?.[0]?.name || 'Workout'}
                </h4>
                        <p className="text-sm text-gray-600">
                          {session.duration_minutes} minutes • {formatDate(session.completed_at)}
                        </p>
                      </div>
                    </div>
                    <Link
                      href={`/dashboard/history`}
                      className="text-sm font-medium text-blue-600 hover:text-blue-700"
                    >
                      View Details
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}