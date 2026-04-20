'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/src/lib/supabase/client'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { AppHeader } from '@/src/components/AppHeader'
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

type WeighIn = {
  logged_date: string
  weight_kg: number
}

function WeightSparkline({ entries }: { entries: WeighIn[] }) {
  if (entries.length < 2) return null
  const sorted = [...entries].sort((a, b) => a.logged_date.localeCompare(b.logged_date))
  const weights = sorted.map(e => e.weight_kg)
  const min = Math.min(...weights)
  const max = Math.max(...weights)
  const range = max - min || 1
  const W = 160, H = 48, pad = 4
  const pts = weights.map((w, i) => {
    const x = pad + (i / (weights.length - 1)) * (W - pad * 2)
    const y = pad + ((max - w) / range) * (H - pad * 2)
    return `${x},${y}`
  })
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="overflow-visible">
      <polyline
        points={pts.join(' ')}
        fill="none"
        stroke="#3b82f6"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {pts.slice(-1).map(pt => {
        const [x, y] = pt.split(',').map(Number)
        return <circle key="dot" cx={x} cy={y} r={3} fill="#3b82f6" />
      })}
    </svg>
  )
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
 

export default function DashboardPage() {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [recentSessions, setRecentSessions] = useState<WorkoutSession[]>([])
  const [stats, setStats] = useState({ thisWeek: 0, total: 0, streak: 0 })
  const [weighInStreak, setWeighInStreak] = useState(0)
  const [todayWeighIn, setTodayWeighIn] = useState<boolean>(false)
  const [recentWeighIns, setRecentWeighIns] = useState<WeighIn[]>([])
  const [goalWeight, setGoalWeight] = useState<number | null>(null)
  const [editingGoal, setEditingGoal] = useState(false)
  const [goalError, setGoalError] = useState<string | null>(null)
  const [goalInput, setGoalInput] = useState('')
  const [pendingRequests, setPendingRequests] = useState<{ friendshipId: string; name: string | null }[]>([])
 
  const today = new Date().toLocaleDateString('en-CA')
  const currentHour = new Date().getHours()
  const isMorningWindow = currentHour >= 5 && currentHour < 12

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
      setGoalWeight(profileResponse.data?.goal_weight ?? null)

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

        let streak = 0
        const today2 = new Date()
        today2.setHours(0, 0, 0, 0)
        
        const dates = allSessionsResponse.data.map((s: { completed_at: string }) => {
          const d = new Date(s.completed_at)
          d.setHours(0, 0, 0, 0)
          return d.getTime()
        })
        
        const uniqueDates = [...new Set(dates)].sort((a: number, b: number) => b - a)
        
        let currentDate = today2.getTime()
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

      // Fetch weigh-in data (last 60 days)
      const ago60 = new Date()
      ago60.setDate(ago60.getDate() - 60)
      const { data: weighins } = await supabase
        .from('weigh_ins')
        .select('logged_date, weight_kg')
        .eq('user_id', user.id)
        .gte('logged_date', ago60.toLocaleDateString('en-CA'))
        .order('logged_date', { ascending: false })

      const allWeighIns = (weighins ?? []) as WeighIn[]
      const weighInDates = allWeighIns.map(w => w.logged_date)
      setWeighInStreak(calcWeighInStreak(weighInDates))
      setTodayWeighIn(weighInDates.includes(today))
      setRecentWeighIns(allWeighIns.slice(0, 14))

      // Fetch pending friend requests
      const { data: pending } = await supabase
        .from('friendships')
        .select('id, user_id')
        .eq('friend_id', user.id)
        .eq('status', 'pending')

      if (pending && pending.length > 0) {
        const requesterIds = pending.map(p => p.user_id)
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', requesterIds)
        const profileMap = new Map((profiles ?? []).map(p => [p.id, p.full_name as string | null]))
        setPendingRequests(pending.map(p => ({ friendshipId: p.id, name: profileMap.get(p.user_id) ?? null })))
      } else {
        setPendingRequests([])
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
  }, [router, supabase, pathname, today])

  async function acceptRequest(friendshipId: string) {
    await supabase.from('friendships').update({ status: 'accepted', accepted_at: new Date().toISOString() }).eq('id', friendshipId)
    setPendingRequests(prev => prev.filter(r => r.friendshipId !== friendshipId))
  }

  async function rejectRequest(friendshipId: string) {
    await supabase.from('friendships').delete().eq('id', friendshipId)
    setPendingRequests(prev => prev.filter(r => r.friendshipId !== friendshipId))
  }

  async function saveGoal() {
    const val = parseFloat(goalInput)
    if (isNaN(val) || val <= 0) return
    setGoalError(null)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await supabase.from('profiles').update({ goal_weight: val }).eq('id', user.id)
    if (error) {
      setGoalError(error.message)
      return
    }
    setGoalWeight(val)
    setEditingGoal(false)
  }

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
      <AppHeader
        title="Fitness Coach"
        links={[
          { href: '/feed', label: 'Feed' },
          { href: '/friends', label: 'Friends' },
          { href: '/weigh-in', label: 'Weigh-In' },
          { href: '/dashboard/workouts', label: 'Workouts' },
          { href: '/dashboard/history', label: 'History' },
          { href: '/exercises', label: 'Exercises' },
          { href: '/progress', label: 'Progress' },
        ]}
        onLogout={handleLogout}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Pending friend requests */}
        {pendingRequests.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-blue-100 p-4 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full">
                {pendingRequests.length}
              </span>
              <h3 className="font-semibold text-gray-900 text-sm">
                Friend Request{pendingRequests.length !== 1 ? 's' : ''}
              </h3>
            </div>
            <div className="space-y-2">
              {pendingRequests.map(r => (
                <div key={r.friendshipId} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-sm font-bold flex-shrink-0">
                      {r.name?.trim()[0]?.toUpperCase() ?? '?'}
                    </div>
                    <span className="text-sm font-medium text-gray-900">{r.name ?? 'Someone'}</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => acceptRequest(r.friendshipId)}
                      className="px-3 py-1 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => rejectRequest(r.friendshipId)}
                      className="px-3 py-1 text-xs font-semibold bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Morning weigh-in banner */}
        {isMorningWindow && (
          todayWeighIn ? (
            <div className="bg-green-50 border border-green-200 rounded-xl px-5 py-4 mb-6 flex items-center gap-3">
              <span className="text-green-500 text-xl">✓</span>
              <p className="text-green-800 font-medium text-sm">Weighed in today</p>
              <Link href="/weigh-in" className="ml-auto text-sm text-green-700 hover:text-green-900 font-medium">Update</Link>
            </div>
          ) : (
            <div className="bg-blue-600 text-white rounded-xl px-5 py-4 mb-6 flex items-center justify-between">
              <div>
                <p className="font-bold">Good morning — time to weigh in</p>
                <p className="text-blue-200 text-sm mt-0.5">Takes 10 seconds. Keep your streak going.</p>
              </div>
              <Link
                href="/weigh-in"
                className="flex-shrink-0 ml-4 px-4 py-2 bg-white text-blue-600 rounded-lg text-sm font-bold hover:bg-blue-50 transition-colors"
              >
                Log Weight
              </Link>
            </div>
          )
        )}
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
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
              <h3 className="text-sm font-medium text-gray-600">Workout Streak</h3>
              <span className="text-2xl">⚡</span>
            </div>
            <p className="text-3xl font-bold text-gray-900">{stats.streak} days</p>
            <p className="text-sm text-gray-500 mt-1">
              {stats.streak > 0 ? 'Amazing!' : 'Start your streak!'}
            </p>
          </div>
             <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600">Weigh-In Streak</h3>
              <span className="text-2xl">⚖️</span>
            </div>
            <p className="text-3xl font-bold text-gray-900">{weighInStreak} days</p>
            <p className="text-sm text-gray-500 mt-1">
              <Link href="/weigh-in" className="text-blue-500 hover:text-blue-600">
                {todayWeighIn ? 'Logged today ✓' : 'Log today'}
              </Link>
            </p>
          </div>
        </div>

        {/* Weight Trend */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-gray-900">Weight Trend</h3>
            <Link href="/weigh-in/history" className="text-sm font-medium text-blue-600 hover:text-blue-700">
              Full History
            </Link>
          </div>

          {recentWeighIns.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 mb-3">No weigh-ins logged yet</p>
              <Link
                href="/weigh-in"
                className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
              >
                Log Your First Weight
              </Link>
            </div>
          ) : (
            <div className="flex flex-col md:flex-row md:items-start gap-6">
              {/* Latest + delta */}
              <div className="flex-shrink-0">
                <p className="text-sm text-gray-500 mb-1">Latest</p>
                <p className="text-4xl font-bold text-gray-900">
                  {recentWeighIns[0].weight_kg}
                  <span className="text-lg font-normal text-gray-500 ml-1">kg</span>
                </p>
                {recentWeighIns.length >= 2 && (() => {
                  const delta = recentWeighIns[0].weight_kg - recentWeighIns[1].weight_kg
                  const sign = delta > 0 ? '+' : ''
                  const colour = delta > 0 ? 'text-red-500' : delta < 0 ? 'text-green-600' : 'text-gray-400'
                  return (
                    <p className={`text-sm font-medium mt-1 ${colour}`}>
                      {sign}{delta.toFixed(1)} kg vs previous
                    </p>
                  )
                })()}
              </div>

              {/* Sparkline */}
              {recentWeighIns.length >= 2 && (
                <div className="flex-1 flex items-center">
                  <WeightSparkline entries={recentWeighIns} />
                </div>
              )}

              {/* Last 5 entries */}
              <div className="flex-shrink-0 min-w-[160px]">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Recent</p>
                <div className="space-y-1.5">
                  {recentWeighIns.slice(0, 5).map(entry => (
                    <div key={entry.logged_date} className="flex justify-between text-sm">
                      <span className="text-gray-500">
                        {new Date(entry.logged_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                      <span className="font-medium text-gray-900">{entry.weight_kg} kg</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-600">Weight Goal</p>
              <button onClick={() => { setEditingGoal(true); setGoalInput(goalWeight ? String(goalWeight) : '') }} className="text-xs text-blue-600 hover:text-blue-700">
                {goalWeight ? 'Edit' : 'Set goal'}
              </button>
            </div>
            {editingGoal ? (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input type="number" step="0.1" value={goalInput} onChange={e => setGoalInput(e.target.value)}
                    placeholder="e.g. 75" className="w-28 px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900" />
                  <button onClick={saveGoal} className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">Save</button>
                  <button onClick={() => { setEditingGoal(false); setGoalError(null) }} className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700">Cancel</button>
                </div>
                {goalError && <p className="text-xs text-red-500">{goalError}</p>}
              </div>
            ) : goalWeight ? (
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-500">Current: <span className="font-medium text-gray-900">{recentWeighIns[0]?.weight_kg ?? '—'} kg</span></span>
                  <span className="text-gray-500">Goal: <span className="font-medium text-gray-900">{goalWeight} kg</span></span>
                </div>
                {recentWeighIns[0] && (() => {
                  const current = recentWeighIns[0].weight_kg
                  const start = recentWeighIns[recentWeighIns.length - 1]?.weight_kg ?? current
                  const totalChange = Math.abs(start - goalWeight)
                  const progress = totalChange === 0 ? 100 : Math.min(100, Math.max(0, Math.abs(start - current) / totalChange * 100))
                  const remaining = Math.abs(current - goalWeight).toFixed(1)
                  const achieved = Math.abs(current - goalWeight) < 0.5
                  return (
                    <div>
                      <div className="w-full bg-gray-100 rounded-full h-2 mb-1">
                        <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
                      </div>
                      <p className="text-xs text-gray-500">{achieved ? '🎉 Goal reached!' : `${remaining} kg to go`}</p>
                    </div>
                  )
                })()}
              </div>
            ) : (
              <p className="text-sm text-gray-400">Set a target weight to track your progress</p>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 mb-8">
          <h3 className="text-xl font-bold text-gray-900 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link
              href="/dashboard/workouts/new"
              className="p-6 border-2 border-dashed border-gray-300 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all group"
            >
              <div className="text-3xl mb-2">➕</div>
              <h4 className="font-semibold text-gray-900 mb-1 group-hover:text-blue-600">Create Workout</h4>
              <p className="text-sm text-gray-600">Build a custom workout routine</p>
            </Link>

            <Link
              href="/weigh-in"
              className="p-6 border-2 border-dashed border-gray-300 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all group"
            >
              <div className="text-3xl mb-2">⚖️</div>
              <h4 className="font-semibold text-gray-900 mb-1 group-hover:text-blue-600">
                {todayWeighIn ? 'Update Weigh-In' : 'Log Weigh-In'}
              </h4>
              <p className="text-sm text-gray-600">
                {todayWeighIn ? 'Already logged today ✓' : 'Track your daily weight'}
              </p>
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
                        href={`/dashboard/history/${session.id}`}
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