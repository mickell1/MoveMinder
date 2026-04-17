'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/src/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type WorkoutSession = {
  id: string
  workout_id: string
  started_at: string
  completed_at: string
  duration_minutes: number
  workout: {
    name: string
  }
  sets_count?: number
  total_volume?: number
}

type WorkoutSet = {
  reps: number
  weight: number
}

export default function HistoryPage() {
  const router = useRouter()
  const supabase = createClient()
  
  const [sessions, setSessions] = useState<WorkoutSession[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'week' | 'month'>('all')

  useEffect(() => {
    async function loadHistory() {
      setLoading(true)
      
      const userResponse = await supabase.auth.getUser()
      const user = userResponse.data?.user

      if (!user) {
        router.push('/login')
        return
      }

      let query = supabase
        .from('workout_sessions')
        .select(`
          *,
          workout:workouts(name)
        `)
        .eq('user_id', user.id)
        .order('completed_at', { ascending: false })

      // Apply date filters
      if (filter === 'week') {
        const weekAgo = new Date()
        weekAgo.setDate(weekAgo.getDate() - 7)
        query = query.gte('completed_at', weekAgo.toISOString())
      } else if (filter === 'month') {
        const monthAgo = new Date()
        monthAgo.setMonth(monthAgo.getMonth() - 1)
        query = query.gte('completed_at', monthAgo.toISOString())
      }

      const sessionResponse = await query

      if (sessionResponse.error) {
        console.error('Error loading history:', sessionResponse.error)
        setLoading(false)
        return
      }

      if (!sessionResponse.data) {
        setSessions([])
        setLoading(false)
        return
      }

      // Load set counts and volume for each session
      const sessionsWithStats = await Promise.all(
        sessionResponse.data.map(async (session: WorkoutSession) => {
          const setsResponse = await supabase
            .from('workout_sets')
            .select('reps, weight')
            .eq('session_id', session.id)

          const setsCount = setsResponse.data?.length || 0
          const totalVolume = setsResponse.data?.reduce((sum: number, set: WorkoutSet) => {
            return sum + (set.reps * set.weight)
          }, 0) || 0

          return {
            ...session,
            sets_count: setsCount,
            total_volume: Math.round(totalVolume),
          }
        })
      )

      setSessions(sessionsWithStats as WorkoutSession[])
      setLoading(false)
    }

    loadHistory()
  }, [filter, router, supabase])

  const totalWorkouts = sessions.length
  const totalMinutes = sessions.reduce((sum: number, s: WorkoutSession) => sum + (s.duration_minutes || 0), 0)
  const totalVolume = sessions.reduce((sum: number, s: WorkoutSession) => sum + (s.total_volume || 0), 0)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-xl text-gray-600">Loading history...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Workout History</h1>
              <p className="text-gray-600 mt-1">Track your fitness journey</p>
            </div>
            <Link
              href="/dashboard"
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
            >
              ← Dashboard
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-blue-100">Total Workouts</h3>
              <div className="text-3xl">💪</div>
            </div>
            <div className="text-4xl font-bold">{totalWorkouts}</div>
            <p className="text-blue-100 text-sm mt-1">Sessions completed</p>
          </div>

          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg p-6 text-white">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-green-100">Total Time</h3>
              <div className="text-3xl">⏱️</div>
            </div>
            <div className="text-4xl font-bold">{totalMinutes}</div>
            <p className="text-green-100 text-sm mt-1">Minutes trained</p>
          </div>

          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg p-6 text-white">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-purple-100">Total Volume</h3>
              <div className="text-3xl">🏋️</div>
            </div>
            <div className="text-4xl font-bold">{totalVolume.toLocaleString()}</div>
            <p className="text-purple-100 text-sm mt-1">lbs/kg lifted</p>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setFilter('all')}
              className={`flex-1 px-6 py-4 font-semibold transition-colors ${
                filter === 'all'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              All Time
            </button>
            <button
              onClick={() => setFilter('week')}
              className={`flex-1 px-6 py-4 font-semibold transition-colors ${
                filter === 'week'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              This Week
            </button>
            <button
              onClick={() => setFilter('month')}
              className={`flex-1 px-6 py-4 font-semibold transition-colors ${
                filter === 'month'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              This Month
            </button>
          </div>
        </div>

        {/* Workout Sessions List */}
        {sessions.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <div className="text-6xl mb-4">🏃</div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">No Workouts Yet</h3>
            <p className="text-gray-600 mb-6">
              {filter === 'all'
                ? "You haven't completed any workouts yet. Start your first workout!"
                : `No workouts completed in the selected time period.`}
            </p>
            <Link
              href="/dashboard/workouts"
              className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              Browse Workouts
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {sessions.map((session) => {
              const completedDate = new Date(session.completed_at)
              const dateStr = completedDate.toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })
              const timeStr = completedDate.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
              })

              return (
                <Link
                  key={session.id}
                  href={`/dashboard/history/${session.id}`}
                  className="block bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:border-blue-300 hover:shadow-md transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-2xl">
                          💪
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-gray-900">
                            {session.workout?.name || 'Workout'}
                          </h3>
                          <p className="text-sm text-gray-600">
                            {dateStr} at {timeStr}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-6 mt-4 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-600">⏱️</span>
                          <span className="font-semibold text-gray-900">
                            {session.duration_minutes} min
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-600">✓</span>
                          <span className="font-semibold text-gray-900">
                            {session.sets_count} sets
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-600">🏋️</span>
                          <span className="font-semibold text-gray-900">
                            {session.total_volume?.toLocaleString()} lbs
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="text-gray-400">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}