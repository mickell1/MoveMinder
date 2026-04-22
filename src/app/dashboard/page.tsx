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
  workout_frequency: string | null
}

type WorkoutSession = {
  id: string
  workout_id: string
  completed_at: string
  duration_minutes: number
  workouts: { name: string }[] | null
}

type WeighIn = {
  logged_date: string
  weight_kg: number
}

type FeedItem = {
  userName: string | null
  action: string
  time: string
}

function WeightSparkline({ entries }: { entries: WeighIn[] }) {
  if (entries.length < 2) return null
  const sorted = [...entries].sort((a, b) => a.logged_date.localeCompare(b.logged_date))
  const weights = sorted.map(e => e.weight_kg)
  const min = Math.min(...weights)
  const max = Math.max(...weights)
  const range = max - min || 1
  const W = 120, H = 40, pad = 4
  const pts = weights.map((w, i) => {
    const x = pad + (i / (weights.length - 1)) * (W - pad * 2)
    const y = pad + ((max - w) / range) * (H - pad * 2)
    return `${x},${y}`
  })
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="overflow-visible">
      <polyline points={pts.join(' ')} fill="none" stroke="#3b82f6" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" />
      {(() => { const [x, y] = pts[pts.length - 1].split(',').map(Number); return <circle cx={x} cy={y} r={3} fill="#3b82f6" /> })()}
    </svg>
  )
}

function calcWeighInStreak(dates: string[]): number {
  if (dates.length === 0) return 0
  const set = new Set(dates)
  let streak = 0
  const cur = new Date()
  cur.setHours(0, 0, 0, 0)
  if (!set.has(cur.toLocaleDateString('en-CA'))) cur.setDate(cur.getDate() - 1)
  while (set.has(cur.toLocaleDateString('en-CA'))) { streak++; cur.setDate(cur.getDate() - 1) }
  return streak
}

function relTime(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (diff < 60) return diff <= 1 ? 'just now' : `${diff}m ago`
  const h = Math.floor(diff / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return d === 1 ? 'yesterday' : `${d}d ago`
}

export default function DashboardPage() {
  const router = useRouter()
  const supabase = createClient()

  const [userId, setUserId] = useState<string | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [recentSessions, setRecentSessions] = useState<WorkoutSession[]>([])
  const [stats, setStats] = useState({ thisWeek: 0, total: 0, streak: 0 })
  const [weighInStreak, setWeighInStreak] = useState(0)
  const [todayWeighIn, setTodayWeighIn] = useState(false)
  const [recentWeighIns, setRecentWeighIns] = useState<WeighIn[]>([])
  const [goalWeight, setGoalWeight] = useState<number | null>(null)
  const [editingGoal, setEditingGoal] = useState(false)
  const [goalError, setGoalError] = useState<string | null>(null)
  const [goalInput, setGoalInput] = useState('')
  const [pendingRequests, setPendingRequests] = useState<{ friendshipId: string; name: string | null }[]>([])
  const [feedPreview, setFeedPreview] = useState<FeedItem[]>([])
  const [workedOutToday, setWorkedOutToday] = useState(false)
  const [caloriesToday, setCaloriesToday] = useState(0)
  const [macrosToday, setMacrosToday] = useState({ protein: 0, carbs: 0, fat: 0 })
  const [calorieTarget, setCalorieTarget] = useState(2000)

  const today = new Date().toLocaleDateString('en-CA')
  const currentHour = new Date().getHours()
  const isMorningWindow = currentHour >= 5 && currentHour < 12
  const isEveningWindow = currentHour >= 17

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)

      const [profileRes, sessionsRes, allSessionsRes, weighInsRes, pendingRes, foodRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('workout_sessions')
          .select('id, workout_id, completed_at, duration_minutes, workouts(name)')
          .eq('user_id', user.id).order('completed_at', { ascending: false }).limit(5),
        supabase.from('workout_sessions').select('completed_at').eq('user_id', user.id),
        supabase.from('weigh_ins').select('logged_date, weight_kg')
          .eq('user_id', user.id)
          .gte('logged_date', (() => { const d = new Date(); d.setDate(d.getDate() - 60); return d.toLocaleDateString('en-CA') })())
          .order('logged_date', { ascending: false }),
        supabase.from('friendships').select('id, user_id').eq('friend_id', user.id).eq('status', 'pending'),
        supabase.from('food_logs').select('calories, protein_g, carbs_g, fat_g').eq('user_id', user.id).eq('logged_date', today),
      ])

      setProfile(profileRes.data ?? null)
      setGoalWeight(profileRes.data?.goal_weight ?? null)
      setRecentSessions((sessionsRes.data ?? []) as WorkoutSession[])

      // Stats
      const allS = allSessionsRes.data ?? []
      const startOfWeek = new Date(); startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay()); startOfWeek.setHours(0,0,0,0)
      const thisWeek = allS.filter(s => new Date(s.completed_at) >= startOfWeek).length
      const dates = [...new Set(allS.map(s => { const d = new Date(s.completed_at); d.setHours(0,0,0,0); return d.getTime() }))].sort((a,b)=>b-a)
      let streak = 0, cur = new Date(); cur.setHours(0,0,0,0)
      for (const d of dates) {
        if (d === cur.getTime() || d === cur.getTime() - 86400000) { streak++; cur = new Date(d - 86400000) } else break
      }
      setStats({ thisWeek, total: allS.length, streak })
      setWorkedOutToday(allS.some(s => new Date(s.completed_at).toLocaleDateString('en-CA') === today))

      // Weigh-ins
      const wi = (weighInsRes.data ?? []) as WeighIn[]
      setWeighInStreak(calcWeighInStreak(wi.map(w => w.logged_date)))
      setTodayWeighIn(wi.some(w => w.logged_date === today))
      setRecentWeighIns(wi.slice(0, 14))

      // Calorie target from profile (TDEE or override)
      const p = profileRes.data
      const wKg = wi[0]?.weight_kg ?? null
      let target = 2000
      if (p?.calorie_target) {
        target = p.calorie_target
      } else if (p?.height_cm && p?.age && p?.sex && wKg) {
        const bmr = p.sex === 'female'
          ? 10 * wKg + 6.25 * p.height_cm - 5 * p.age - 161
          : 10 * wKg + 6.25 * p.height_cm - 5 * p.age + 5
        const mult: Record<string, number> = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9 }
        target = Math.round(bmr * (mult[p.activity_level ?? 'moderate'] ?? 1.55))
      }
      setCalorieTarget(target)

      // Today's food intake
      type FoodRow = { calories: number | null; protein_g: number | null; carbs_g: number | null; fat_g: number | null }
      const food = (foodRes.data ?? []) as FoodRow[]
      setCaloriesToday(food.reduce((s, f) => s + (f.calories ?? 0), 0))
      setMacrosToday({
        protein: Math.round(food.reduce((s, f) => s + (f.protein_g ?? 0), 0)),
        carbs:   Math.round(food.reduce((s, f) => s + (f.carbs_g ?? 0), 0)),
        fat:     Math.round(food.reduce((s, f) => s + (f.fat_g ?? 0), 0)),
      })

      // Pending friend requests
      const pending = pendingRes.data ?? []
      if (pending.length > 0) {
        const { data: profs } = await supabase.from('profiles').select('id, full_name').in('id', pending.map(p => p.user_id))
        const pMap = new Map((profs ?? []).map(p => [p.id, p.full_name as string | null]))
        setPendingRequests(pending.map(p => ({ friendshipId: p.id, name: pMap.get(p.user_id) ?? null })))
      }

      // Feed preview — friends' recent activity (workouts + shared weigh-ins)
      const { data: ships } = await supabase.from('friendships')
        .select('user_id, friend_id').or(`user_id.eq.${user.id},friend_id.eq.${user.id}`).eq('status', 'accepted')
      const friendIds = (ships ?? []).map(f => f.user_id === user.id ? f.friend_id : f.user_id)
      if (friendIds.length > 0) {
        const [friendSessRes, friendWeighInsRes, friendProfs] = await Promise.all([
          supabase.from('workout_sessions').select('user_id, completed_at, workouts(name)')
            .in('user_id', friendIds).order('completed_at', { ascending: false }).limit(6),
          supabase.from('friend_weigh_ins').select('user_id, logged_date, weight_kg')
            .in('user_id', friendIds)
            .order('logged_date', { ascending: false }).limit(6),
          supabase.from('profiles').select('id, full_name').in('id', friendIds),
        ])
        const pMap = new Map((friendProfs.data ?? []).map(p => [p.id, p.full_name as string | null]))

        const workoutItems: FeedItem[] = (friendSessRes.data ?? []).map(s => {
          const name = Array.isArray(s.workouts) ? (s.workouts[0]?.name ?? 'a workout') : ((s.workouts as {name:string}|null)?.name ?? 'a workout')
          return { userName: pMap.get(s.user_id) ?? null, action: `completed ${name}`, time: s.completed_at }
        })

        const weighInItems: FeedItem[] = (friendWeighInsRes.data ?? []).map(w => ({
          userName: pMap.get(w.user_id) ?? null,
          action: w.weight_kg !== null ? `logged ${w.weight_kg} kg` : 'weighed in',
          time: `${w.logged_date}T00:00:00`,
        }))

        const combined = [...workoutItems, ...weighInItems]
          .sort((a, b) => b.time.localeCompare(a.time))
          .slice(0, 4)

        setFeedPreview(combined)
      }

      setLoading(false)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function acceptRequest(id: string) {
    await supabase.from('friendships').update({ status: 'accepted', accepted_at: new Date().toISOString() }).eq('id', id)
    setPendingRequests(p => p.filter(r => r.friendshipId !== id))
  }
  async function rejectRequest(id: string) {
    await supabase.from('friendships').delete().eq('id', id)
    setPendingRequests(p => p.filter(r => r.friendshipId !== id))
  }
  async function saveGoal() {
    const val = parseFloat(goalInput)
    if (isNaN(val) || val <= 0 || !userId) return
    setGoalError(null)
    const { error } = await supabase.from('profiles').upsert({ id: userId, goal_weight: val }, { onConflict: 'id' })
    if (error) { setGoalError(error.message); return }
    setGoalWeight(val); setEditingGoal(false)
  }
  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/login'); router.refresh() }

  const goalLabels: Record<string, string> = {
    lose_weight: 'Lose Weight 🔥', build_muscle: 'Build Muscle 💪', get_fit: 'Get Fit ⚡', maintain: 'Stay Healthy 🎯',
  }
  const goalDisplay = (() => {
    const g = profile?.goals
    if (!g) return null
    if (Array.isArray(g)) return goalLabels[g[0]] ?? g[0] ?? null
    if (typeof g === 'string') {
      try { const p = JSON.parse(g); return goalLabels[Array.isArray(p) ? p[0] : p] ?? (Array.isArray(p) ? p[0] : p) } catch { return goalLabels[g] ?? g }
    }
    return null
  })()

  const formatDate = (s: string) => {
    const diff = Math.floor((Date.now() - new Date(s).getTime()) / 3600000)
    if (diff < 24) return diff < 1 ? 'Just now' : `${diff}h ago`
    const d = Math.floor(diff / 24)
    return d === 1 ? 'Yesterday' : `${d}d ago`
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-lg text-gray-600">Loading...</div>
    </div>
  )

  const name = profile?.full_name?.split(' ')[0] ?? 'Your'

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader
        title="MoveMinder"
        links={[
          { href: '/feed',               label: 'Social' },
          { href: '/dashboard/workouts', label: 'Workouts' },
          { href: '/weigh-in',           label: 'Weigh-In' },
          { href: '/ai',                 label: 'AI Coach' },
        ]}
        onLogout={handleLogout}
      />

      <main className="max-w-2xl mx-auto px-4 py-5 space-y-4">

        {/* Page title */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{name}&apos;s Dashboard</h1>
          {goalDisplay && <p className="text-sm text-gray-500 mt-0.5">{goalDisplay}</p>}
        </div>

        {/* Pending friend requests */}
        {pendingRequests.length > 0 && (
          <div className="bg-white rounded-2xl border border-blue-100 p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full flex items-center justify-center">
                {pendingRequests.length}
              </span>
              <h3 className="font-semibold text-gray-900 text-sm">Friend Request{pendingRequests.length !== 1 ? 's' : ''}</h3>
            </div>
            <div className="space-y-2">
              {pendingRequests.map(r => (
                <div key={r.friendshipId} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-sm font-bold">
                      {r.name?.trim()[0]?.toUpperCase() ?? '?'}
                    </div>
                    <span className="text-sm font-medium text-gray-900">{r.name ?? 'Someone'}</span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => acceptRequest(r.friendshipId)} className="px-3 py-1 text-xs font-semibold bg-blue-600 text-white rounded-lg">Accept</button>
                    <button onClick={() => rejectRequest(r.friendshipId)} className="px-3 py-1 text-xs font-semibold bg-gray-100 text-gray-600 rounded-lg">Decline</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Morning weigh-in banner */}
        {isMorningWindow && (
          todayWeighIn ? (
            <div className="bg-green-50 border border-green-200 rounded-2xl px-4 py-3 flex items-center gap-3">
              <span className="text-green-500 text-lg">✓</span>
              <p className="text-green-800 font-medium text-sm flex-1">Weighed in today</p>
              <Link href="/weigh-in" className="text-sm text-green-700 font-medium">Update</Link>
            </div>
          ) : (
            <div className="bg-blue-600 text-white rounded-2xl px-4 py-4 flex items-center justify-between">
              <div>
                <p className="font-bold text-sm">Good morning — time to weigh in</p>
                <p className="text-blue-200 text-xs mt-0.5">Takes 10 seconds. Keep your streak going.</p>
              </div>
              <Link href="/weigh-in" className="flex-shrink-0 ml-3 px-3 py-1.5 bg-white text-blue-600 rounded-xl text-sm font-bold">
                Log Weight
              </Link>
            </div>
          )
        )}

        {/* Streak protection nudge — evening only, streak active, no workout yet today */}
        {isEveningWindow && stats.streak > 0 && !workedOutToday && (
          <div className="bg-orange-500 text-white rounded-2xl px-4 py-4 flex items-center justify-between">
            <div>
              <p className="font-bold text-sm">Your {stats.streak}-day streak ends tonight 🔥</p>
              <p className="text-orange-200 text-xs mt-0.5">
                {currentHour < 22
                  ? `${22 - currentHour}h left — don't break it now!`
                  : 'Last chance — finish a workout before midnight!'}
              </p>
            </div>
            <Link href="/dashboard/workouts"
              className="flex-shrink-0 ml-3 px-3 py-1.5 bg-white text-orange-600 rounded-xl text-sm font-bold">
              Train →
            </Link>
          </div>
        )}

        {/* ── BLUE SECTION: Stats + Weight + Feed ── */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-4 space-y-4">

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'This Week', value: stats.thisWeek, sub: `Goal: ${profile?.workout_frequency ?? '3'}/wk`, icon: '🔥' },
              { label: 'Total Workouts', value: stats.total, sub: 'All time', icon: '💪' },
              { label: 'Workout Streak', value: `${stats.streak}d`, sub: stats.streak > 0 ? 'Keep it up!' : 'Start today', icon: '⚡' },
              { label: 'Weigh-In Streak', value: `${weighInStreak}d`, sub: todayWeighIn ? 'Logged today ✓' : 'Log today', icon: '⚖️', href: '/weigh-in' },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-xl p-3 shadow-sm">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-medium text-gray-500 leading-tight">{s.label}</p>
                  <span className="text-lg">{s.icon}</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{s.value}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {s.href ? <Link href={s.href} className="text-blue-500">{s.sub}</Link> : s.sub}
                </p>
              </div>
            ))}
          </div>

          {/* Calories today */}
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-gray-700">Calories Today</p>
              <Link href="/food" className="text-xs text-blue-600 font-medium">Log food →</Link>
            </div>
            <div className="flex items-end gap-1.5 mb-2">
              <span className="text-2xl font-bold text-gray-900">{caloriesToday}</span>
              <span className="text-sm text-gray-400 pb-0.5">/ {calorieTarget} kcal</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-1.5 mb-3 overflow-hidden">
              <div
                className={`h-1.5 rounded-full transition-all ${caloriesToday > calorieTarget ? 'bg-red-400' : caloriesToday > calorieTarget * 0.9 ? 'bg-amber-400' : 'bg-green-500'}`}
                style={{ width: `${Math.min(100, (caloriesToday / calorieTarget) * 100)}%` }}
              />
            </div>
            {caloriesToday > 0 ? (
              <div className="flex justify-between text-xs text-gray-500">
                <span>P <span className="font-semibold text-red-600">{macrosToday.protein}g</span></span>
                <span>C <span className="font-semibold text-yellow-600">{macrosToday.carbs}g</span></span>
                <span>F <span className="font-semibold text-green-600">{macrosToday.fat}g</span></span>
                <span className={`font-semibold ${calorieTarget - caloriesToday < 0 ? 'text-red-500' : 'text-gray-600'}`}>
                  {calorieTarget - caloriesToday > 0 ? `${calorieTarget - caloriesToday} left` : `${Math.abs(calorieTarget - caloriesToday)} over`}
                </span>
              </div>
            ) : (
              <p className="text-xs text-gray-400">Nothing logged yet — <Link href="/food" className="text-blue-500">add food</Link></p>
            )}
          </div>

          {/* Weight trend + Feed preview */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

            {/* Weight trend */}
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-gray-700">Weight Trend</p>
                <Link href="/weigh-in/history" className="text-xs text-blue-600 font-medium">History</Link>
              </div>
              {recentWeighIns.length === 0 ? (
                <div className="text-center py-3">
                  <p className="text-xs text-gray-400 mb-2">No entries yet</p>
                  <Link href="/weigh-in" className="text-xs text-blue-600 font-medium">Log first weight →</Link>
                </div>
              ) : (
                <>
                  <div className="flex items-end gap-3 mb-2">
                    <div>
                      <p className="text-2xl font-bold text-gray-900">{recentWeighIns[0].weight_kg}<span className="text-sm font-normal text-gray-400 ml-0.5">kg</span></p>
                      {recentWeighIns.length >= 2 && (() => {
                        const d = recentWeighIns[0].weight_kg - recentWeighIns[1].weight_kg
                        return <p className={`text-xs font-medium ${d > 0 ? 'text-red-500' : d < 0 ? 'text-green-600' : 'text-gray-400'}`}>{d > 0 ? '+' : ''}{d.toFixed(1)} kg</p>
                      })()}
                    </div>
                    {recentWeighIns.length >= 2 && <WeightSparkline entries={recentWeighIns} />}
                  </div>
                  {/* Weight goal progress */}
                  <div className="border-t border-gray-100 pt-2">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs text-gray-500">Goal: {goalWeight ? `${goalWeight} kg` : 'Not set'}</p>
                      <button onClick={() => { setEditingGoal(true); setGoalInput(goalWeight ? String(goalWeight) : '') }} className="text-xs text-blue-600">
                        {goalWeight ? 'Edit' : 'Set'}
                      </button>
                    </div>
                    {editingGoal ? (
                      <div className="flex gap-1.5">
                        <input type="number" step="0.1" value={goalInput} onChange={e => setGoalInput(e.target.value)}
                          placeholder="75" className="w-20 px-2 py-1 border border-gray-300 rounded-lg text-xs" />
                        <button onClick={saveGoal} className="px-2 py-1 bg-blue-600 text-white text-xs rounded-lg">Save</button>
                        <button onClick={() => { setEditingGoal(false); setGoalError(null) }} className="px-2 py-1 text-xs text-gray-500">✕</button>
                        {goalError && <p className="text-xs text-red-500">{goalError}</p>}
                      </div>
                    ) : goalWeight && recentWeighIns[0] ? (() => {
                      const current = recentWeighIns[0].weight_kg
                      const start = recentWeighIns[recentWeighIns.length - 1]?.weight_kg ?? current
                      const total = Math.abs(start - goalWeight)
                      const progress = total === 0 ? 100 : Math.min(100, Math.abs(start - current) / total * 100)
                      const remaining = Math.abs(current - goalWeight).toFixed(1)
                      return (
                        <>
                          <div className="w-full bg-gray-100 rounded-full h-1.5">
                            <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${progress}%` }} />
                          </div>
                          <p className="text-xs text-gray-400 mt-1">{Math.abs(current - goalWeight) < 0.5 ? '🎉 Goal reached!' : `${remaining} kg to go`}</p>
                        </>
                      )
                    })() : null}
                  </div>
                </>
              )}
            </div>

            {/* Mini feed */}
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-gray-700">Friends</p>
                <Link href="/feed" className="text-xs text-blue-600 font-medium">See all</Link>
              </div>
              {feedPreview.length === 0 ? (
                <div className="text-center py-3">
                  <p className="text-xs text-gray-400 mb-2">No friend activity yet</p>
                  <Link href="/friends" className="text-xs text-blue-600 font-medium">Invite friends →</Link>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {feedPreview.slice(0, 3).map((item, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {item.userName?.trim()[0]?.toUpperCase() ?? '?'}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-gray-700 truncate"><span className="font-semibold">{item.userName ?? 'Friend'}</span> {item.action}</p>
                        <p className="text-xs text-gray-400">{relTime(item.time)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── AI DISCOVERY CARD (new users only) ── */}
        {stats.total < 3 && (
          <div className="bg-gradient-to-r from-indigo-600 to-violet-600 rounded-2xl p-5 text-white">
            <div className="flex items-start gap-3 mb-3">
              <span className="text-3xl">🤖</span>
              <div>
                <p className="font-bold text-lg leading-tight">Meet your AI Personal Trainer</p>
                <p className="text-indigo-200 text-sm mt-0.5">Generate a personalised workout or 7-day meal plan in seconds — tailored to your goals and body stats.</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Link href="/ai/workout"
                className="bg-white/20 hover:bg-white/30 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors text-center">
                Generate Workout
              </Link>
              <Link href="/nutrition"
                className="bg-white/20 hover:bg-white/30 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors text-center">
                Get Meal Plan
              </Link>
            </div>
          </div>
        )}


        {/* ── AI COACH SECTION ── */}
        <div className="bg-gradient-to-br from-indigo-50 to-violet-50 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">🤖</span>
              <p className="text-sm font-semibold text-gray-700">AI Personal Trainer</p>
            </div>
            <Link href="/ai" className="text-xs text-indigo-600 font-medium">See all →</Link>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { href: '/ai/workout', icon: '🏋️', label: 'Generate Workout', sub: 'Single or 4-week plan', color: 'bg-blue-100' },
              { href: '/nutrition', icon: '🥗', label: 'Meal Plan', sub: '7-day AI nutrition', color: 'bg-green-100' },
            ].map(a => (
              <Link key={a.href} href={a.href}
                className="flex flex-col gap-1 bg-white rounded-xl px-3 py-3 shadow-sm hover:shadow-md transition-shadow active:scale-95">
                <div className={`w-9 h-9 ${a.color} rounded-xl flex items-center justify-center text-lg mb-1`}>{a.icon}</div>
                <p className="text-xs font-semibold text-gray-900 leading-tight">{a.label}</p>
                <p className="text-xs text-gray-400">{a.sub}</p>
              </Link>
            ))}
          </div>
        </div>

        {/* ── PURPLE SECTION: Quick Actions ── */}
        <div className="bg-gradient-to-br from-violet-50 to-purple-50 rounded-2xl p-4">
          <p className="text-sm font-semibold text-gray-700 mb-3">Quick Actions</p>
          <div className="grid grid-cols-1 gap-2">
            {[
              { href: '/dashboard/workouts', icon: '🏋️', label: 'Start a Workout', sub: 'Pick from your routines' },
              { href: '/weigh-in', icon: '⚖️', label: todayWeighIn ? 'Update Weigh-In' : 'Log Weigh-In', sub: todayWeighIn ? 'Already logged today ✓' : 'Track your daily weight' },
              { href: '/dashboard/workouts/new', icon: '➕', label: 'Create Workout', sub: 'Build a new routine' },
              { href: '/exercises', icon: '📚', label: 'Browse Exercises', sub: 'Explore exercise library' },
            ].map(a => (
              <Link key={a.href} href={a.href}
                className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 shadow-sm hover:shadow-md transition-shadow active:scale-95">
                <span className="text-2xl flex-shrink-0">{a.icon}</span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{a.label}</p>
                  <p className="text-xs text-gray-500">{a.sub}</p>
                </div>
                <svg className="w-4 h-4 text-gray-400 ml-auto flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            ))}
          </div>
        </div>

        {/* ── Recent Activity ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-gray-700">Recent Workouts</p>
            {recentSessions.length > 0 && (
              <Link href="/dashboard/history" className="text-xs text-blue-600 font-medium">View all</Link>
            )}
          </div>
          {recentSessions.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-3">🏋️</div>
              <p className="text-sm text-gray-500 mb-3">No workouts yet</p>
              <Link href="/dashboard/workouts/new" className="inline-block px-5 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold">
                Start Your First Workout
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {recentSessions.map(s => (
                <div key={s.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-sm">✓</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{s.workouts?.[0]?.name ?? 'Workout'}</p>
                      <p className="text-xs text-gray-500">{s.duration_minutes}min · {formatDate(s.completed_at)}</p>
                    </div>
                  </div>
                  <Link href={`/dashboard/history/${s.id}`} className="text-xs text-blue-600 font-medium flex-shrink-0 ml-2">
                    Details
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="h-4" />
      </main>
    </div>
  )
}
