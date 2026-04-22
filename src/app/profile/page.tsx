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
  goal_weight: number | null
  height_cm: number | null
  age: number | null
  sex: string | null
  activity_level: string | null
}

const goalLabels: Record<string, string> = {
  lose_weight: 'Lose Weight 🔥',
  build_muscle: 'Build Muscle 💪',
  get_fit: 'Get Fit ⚡',
  maintain: 'Stay Healthy 🎯',
}

const activityLabels: Record<string, string> = {
  sedentary: 'Sedentary',
  light: 'Lightly Active',
  moderate: 'Moderately Active',
  active: 'Active',
  very_active: 'Very Active',
}

function calcWorkoutStreak(dates: string[]): number {
  if (!dates.length) return 0
  const set = new Set(dates)
  let streak = 0
  const cur = new Date(); cur.setHours(0, 0, 0, 0)
  if (!set.has(cur.toLocaleDateString('en-CA'))) cur.setDate(cur.getDate() - 1)
  while (set.has(cur.toLocaleDateString('en-CA'))) { streak++; cur.setDate(cur.getDate() - 1) }
  return streak
}

export default function ProfilePage() {
  const router = useRouter()
  const supabase = createClient()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [stats, setStats] = useState({ totalWorkouts: 0, streak: 0, pbCount: 0, currentWeight: null as number | null, badgeCount: 0 })
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [userId, setUserId] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)

      const [profileRes, sessionsRes, weighInsRes, pbRes, badgesRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('workout_sessions').select('completed_at').eq('user_id', user.id),
        supabase.from('weigh_ins').select('weight_kg, logged_date').eq('user_id', user.id)
          .order('logged_date', { ascending: false }).limit(1),
        supabase.from('personal_bests').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('user_badges').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      ])

      const p = profileRes.data as Profile | null
      setProfile(p)
      setNameInput(p?.full_name ?? '')

      const sessions = sessionsRes.data ?? []
      const sessionDates = sessions.map(s => new Date(s.completed_at).toLocaleDateString('en-CA'))
      const streak = calcWorkoutStreak(sessionDates)
      const currentWeight = (weighInsRes.data?.[0]?.weight_kg as number | undefined) ?? null
      const pbCount = (pbRes.count ?? 0) as number
      const badgeCount = (badgesRes.count ?? 0) as number

      setStats({ totalWorkouts: sessions.length, streak, pbCount, currentWeight, badgeCount })
      setLoading(false)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function saveName() {
    if (!nameInput.trim() || !userId) return
    setSaving(true)
    await supabase.from('profiles').upsert({ id: userId, full_name: nameInput.trim() })
    setProfile(p => p ? { ...p, full_name: nameInput.trim() } : p)
    setSaving(false)
    setEditing(false)
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

  const initials = profile?.full_name?.trim().split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) ?? '?'

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-lg text-gray-600">Loading profile…</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader title="MoveMinder" />

      <main className="max-w-xl mx-auto px-4 py-8 space-y-5">

        {/* Avatar + name */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col items-center text-center">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mb-4 shadow-md">
            <span className="text-white text-2xl font-bold">{initials}</span>
          </div>

          {editing ? (
            <div className="flex gap-2 items-center mb-2">
              <input
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && saveName()}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-base font-semibold text-center focus:outline-none focus:border-blue-400"
                autoFocus
              />
              <button onClick={saveName} disabled={saving}
                className="px-3 py-1.5 bg-blue-600 text-white text-sm font-semibold rounded-lg disabled:opacity-50">
                {saving ? '…' : 'Save'}
              </button>
              <button onClick={() => { setEditing(false); setNameInput(profile?.full_name ?? '') }}
                className="px-3 py-1.5 text-gray-500 text-sm">✕</button>
            </div>
          ) : (
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold text-gray-900">{profile?.full_name ?? 'Your Name'}</h1>
              <button onClick={() => setEditing(true)} className="text-gray-400 hover:text-gray-600 transition-colors" title="Edit name">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
            </div>
          )}

          {goalDisplay && <p className="text-sm text-gray-500">{goalDisplay}</p>}
          {profile?.fitness_level && (
            <span className="mt-2 text-xs font-semibold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full capitalize">
              {profile.fitness_level}
            </span>
          )}
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Total Workouts', value: stats.totalWorkouts, icon: '💪', color: 'bg-blue-50 text-blue-700' },
            { label: 'Workout Streak', value: `${stats.streak}d`, icon: '🔥', color: 'bg-orange-50 text-orange-700' },
            { label: 'Personal Bests', value: stats.pbCount, icon: '💥', color: 'bg-amber-50 text-amber-700' },
            { label: 'Current Weight', value: stats.currentWeight ? `${stats.currentWeight}kg` : '—', icon: '⚖️', color: 'bg-purple-50 text-purple-700' },
          ].map(s => (
            <div key={s.label} className={`${s.color} rounded-2xl p-4`}>
              <div className="text-2xl mb-1">{s.icon}</div>
              <div className="text-2xl font-bold">{s.value}</div>
              <div className="text-xs font-medium mt-0.5 opacity-80">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Body stats (from AI profile) */}
        {(profile?.height_cm || profile?.age || profile?.sex || profile?.activity_level) && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-gray-700">Body & Activity</p>
              <Link href="/ai/profile" className="text-xs text-blue-600 font-medium">Edit →</Link>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                profile?.height_cm && { label: 'Height', value: `${profile.height_cm} cm` },
                profile?.age && { label: 'Age', value: `${profile.age} yrs` },
                profile?.sex && { label: 'Sex', value: profile.sex.charAt(0).toUpperCase() + profile.sex.slice(1) },
                profile?.activity_level && { label: 'Activity', value: activityLabels[profile.activity_level] ?? profile.activity_level },
              ].filter(Boolean).map(s => s && (
                <div key={s.label} className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-400 font-medium">{s.label}</p>
                  <p className="text-sm font-semibold text-gray-800 mt-0.5">{s.value}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick links */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-100">
          {[
            { href: '/friends', icon: '🔗', label: 'Friends & Invites', sub: 'Invite friends, manage connections' },
            { href: '/badges', icon: '🏅', label: 'Achievements', sub: `${stats.badgeCount} badge${stats.badgeCount !== 1 ? 's' : ''} earned` },
            { href: '/progress/pbs', icon: '🏆', label: 'Personal Bests', sub: `${stats.pbCount} all-time records` },
            { href: '/dashboard/history', icon: '📋', label: 'Workout History', sub: `${stats.totalWorkouts} sessions logged` },
            { href: '/progress', icon: '📈', label: 'Progress Stats', sub: 'Streaks and weight trend' },
            { href: '/ai/profile', icon: '🤖', label: 'AI Profile', sub: 'Height, goals, dietary preferences' },
          ].map(l => (
            <Link key={l.href} href={l.href}
              className="flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors">
              <span className="text-xl flex-shrink-0">{l.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">{l.label}</p>
                <p className="text-xs text-gray-400">{l.sub}</p>
              </div>
              <svg className="w-4 h-4 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          ))}
        </div>

      </main>
    </div>
  )
}
