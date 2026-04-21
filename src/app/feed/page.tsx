'use client'
 
import { useEffect, useState } from 'react'
import { createClient } from '@/src/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AppHeader } from '@/src/components/AppHeader'
import { ReactionBar } from '@/src/components/social/ReactionBar'
 
type WorkoutItem = {
  type: 'workout'
  id: string
  userId: string
  userName: string | null
  workoutName: string
  durationMinutes: number
  setCount: number
  time: string
}
 
type WeighInItem = {
  type: 'weighin'
  id: string
  userId: string
  userName: string | null
  weightKg: number | null
  loggedDate: string
  streak: number
  time: string
}
 
type MilestoneItem = {
  type: 'milestone'
  id: string
  userId: string
  userName: string | null
  message: string
  time: string
}

type FeedItem = WorkoutItem | WeighInItem | MilestoneItem
 
function calcStreak(dates: string[]): number {
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
 
function relativeTime(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 60) return diffMins <= 1 ? 'just now' : `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  return diffDays === 1 ? 'yesterday' : `${diffDays}d ago`
}
 
function Avatar({ name }: { name: string | null }) {
  const initial = name?.trim()[0]?.toUpperCase() ?? '?'
  return (
    <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-sm flex-shrink-0">
      {initial}
    </div>
  )
}
 
function WorkoutCard({ item, currentUserId }: { item: WorkoutItem; currentUserId: string }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
      <div className="flex items-center gap-3 mb-3">
        <Avatar name={item.userName} />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 text-sm truncate">{item.userName ?? 'Someone'}</p>
          <p className="text-xs text-gray-400">{relativeTime(item.time)}</p>
        </div>
        <span className="text-xl">🏋️</span>
      </div>
      <p className="font-bold text-gray-900 mb-0.5">{item.workoutName}</p>
      <p className="text-sm text-gray-500 mb-3">
        {item.durationMinutes} min · {item.setCount} set{item.setCount !== 1 ? 's' : ''}
      </p>
      <ReactionBar sessionId={item.id} userId={currentUserId} />
    </div>
  )
}
 
function MilestoneCard({ item }: { item: MilestoneItem }) {
  return (
    <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-xl border border-yellow-200 px-4 py-3 flex items-center gap-3">
      <div className="w-9 h-9 rounded-full bg-yellow-100 flex items-center justify-center flex-shrink-0 text-lg">
        🏆
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-700">
          <span className="font-semibold">{item.userName ?? 'Someone'}</span>
          {' '}{item.message}
        </p>
        <p className="text-xs text-gray-400 mt-0.5">{relativeTime(item.time)}</p>
      </div>
    </div>
  )
}

function WeighInCard({ item }: { item: WeighInItem }) {
  return (
    <div className="bg-gray-50 rounded-xl border border-gray-200 px-4 py-3 flex items-center gap-3">
      <Avatar name={item.userName} />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-700">
          <span className="font-semibold">{item.userName ?? 'Someone'}</span>
          {' '}weighed in
          {item.weightKg !== null && (
            <span className="text-gray-500"> — {Math.round(item.weightKg * 10) / 10} kg</span>
          )}
          {item.streak > 1 && (
            <span className="ml-1 text-orange-500 font-medium">🔥 {item.streak} day streak</span>
          )}
        </p>
        <p className="text-xs text-gray-400 mt-0.5">{relativeTime(item.time)}</p>
      </div>
    </div>
  )
}
 
export default function FeedPage() {
  const supabase = createClient()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [feedItems, setFeedItems] = useState<FeedItem[]>([])
  const [currentUserId, setCurrentUserId] = useState<string>('')
 
  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    setCurrentUserId(user.id)
 
    // Get accepted friends
    const { data: ships } = await supabase
      .from('friendships')
      .select('user_id, friend_id')
      .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
      .eq('status', 'accepted')
 
    const friendIds = (ships ?? []).map(f => f.user_id === user.id ? f.friend_id : f.user_id)
 
    if (friendIds.length === 0) {
      setFeedItems([])
      setLoading(false)
      return
    }
 
    // Friend profiles
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', friendIds)
    const profileMap = new Map((profiles ?? []).map(p => [p.id, p.full_name as string | null]))
 
    // Recent workout sessions
    const { data: sessions } = await supabase
      .from('workout_sessions')
      .select('id, user_id, completed_at, duration_minutes, workouts(name)')
      .in('user_id', friendIds)
      .order('completed_at', { ascending: false })
      .limit(30)
 
    // Set counts for those sessions
    const sessionIds = (sessions ?? []).map(s => s.id)
    const setCountMap = new Map<string, number>()
    if (sessionIds.length > 0) {
      const { data: sets } = await supabase
        .from('workout_sets')
        .select('session_id')
        .in('session_id', sessionIds)
      sets?.forEach(s => setCountMap.set(s.session_id, (setCountMap.get(s.session_id) ?? 0) + 1))
    }
 
    // Recent weigh-ins from friend_weigh_ins (also used for streaks)
    const ago60 = new Date()
    ago60.setDate(ago60.getDate() - 60)
    const { data: weighins } = await supabase
      .from('friend_weigh_ins')
      .select('user_id, weight_kg, logged_date')
      .in('user_id', friendIds)
      .gte('logged_date', ago60.toLocaleDateString('en-CA'))
      .order('logged_date', { ascending: false })
 
    // Compute streaks per friend
    const byUser = new Map<string, string[]>()
    ;(weighins ?? []).forEach(w => {
      if (!byUser.has(w.user_id)) byUser.set(w.user_id, [])
      byUser.get(w.user_id)!.push(w.logged_date)
    })
    const streakMap = new Map(friendIds.map(id => [id, calcStreak(byUser.get(id) ?? [])]))
 
    // Workout feed items
    const workoutItems: FeedItem[] = (sessions ?? []).map(s => {
      const name = Array.isArray(s.workouts)
        ? (s.workouts[0]?.name ?? 'Workout')
        : ((s.workouts as { name: string } | null)?.name ?? 'Workout')
      return {
        type: 'workout' as const,
        id: s.id,
        userId: s.user_id,
        userName: profileMap.get(s.user_id) ?? null,
        workoutName: name,
        durationMinutes: s.duration_minutes,
        setCount: setCountMap.get(s.id) ?? 0,
        time: s.completed_at,
      }
    })
 
    // Weigh-in feed items (most recent 30 days)
    const ago30 = new Date()
    ago30.setDate(ago30.getDate() - 30)
    const ago30str = ago30.toLocaleDateString('en-CA')
    const weighInItems: FeedItem[] = (weighins ?? [])
      .filter(w => w.logged_date >= ago30str)
      .map(w => ({
        type: 'weighin' as const,
        id: `${w.user_id}-${w.logged_date}`,
        userId: w.user_id,
        userName: profileMap.get(w.user_id) ?? null,
        weightKg: w.weight_kg,
        loggedDate: w.logged_date,
        streak: streakMap.get(w.user_id) ?? 0,
        time: w.logged_date + 'T06:00:00',
      }))
 
    // Milestone posts from friends
    const { data: milestones } = await supabase
      .from('feed_posts')
      .select('id, user_id, message, created_at')
      .in('user_id', friendIds)
      .order('created_at', { ascending: false })
      .limit(20)

    const milestoneItems: FeedItem[] = (milestones ?? []).map(m => ({
      type: 'milestone' as const,
      id: m.id,
      userId: m.user_id,
      userName: profileMap.get(m.user_id) ?? null,
      message: m.message,
      time: m.created_at,
    }))

    const all = [...workoutItems, ...weighInItems, ...milestoneItems]
      .sort((a, b) => b.time.localeCompare(a.time))
      .slice(0, 50)
 
    setFeedItems(all)
    setLoading(false)
  }

  useEffect(() => {
    async function init() { await load() }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
 
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
        title="Feed"
        links={[
          { href: '/friends', label: 'Friends' },
          { href: '/weigh-in', label: 'Weigh-In' },
          { href: '/dashboard/workouts', label: 'Workouts' },
        ]}
      />
 
      <main className="max-w-xl mx-auto px-4 py-8">
        {feedItems.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-8 border border-gray-200 text-center">
            <div className="text-6xl mb-4">🌟</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Your feed is empty</h2>
            <p className="text-gray-500 mb-6">Invite a friend to get started</p>
            <Link
              href="/friends"
              className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              Invite a Friend
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {feedItems.map(item => (
              item.type === 'workout'
                ? <WorkoutCard key={item.id} item={item} currentUserId={currentUserId} />
                : item.type === 'milestone'
                ? <MilestoneCard key={item.id} item={item} />
                : <WeighInCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}