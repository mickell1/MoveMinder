import { NextResponse } from 'next/server'
import { createClient } from '@/src/lib/supabase/server'
import { BADGES, type BadgeStats } from '@/src/lib/badges'

function computeStreak(dates: string[]): number {
  if (!dates.length) return 0
  const set = new Set(dates)
  let streak = 0
  const cur = new Date()
  cur.setHours(0, 0, 0, 0)
  if (!set.has(cur.toLocaleDateString('en-CA'))) cur.setDate(cur.getDate() - 1)
  while (set.has(cur.toLocaleDateString('en-CA'))) {
    streak++
    cur.setDate(cur.getDate() - 1)
  }
  return streak
}

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const [sessionsRes, weighInsRes, pbRes, foodRes, earnedRes] = await Promise.all([
      supabase.from('workout_sessions').select('completed_at').eq('user_id', user.id),
      supabase.from('weigh_ins').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      supabase.from('personal_bests').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      supabase.from('food_logs').select('logged_date').eq('user_id', user.id),
      supabase.from('user_badges').select('badge_id, earned_at').eq('user_id', user.id),
    ])

    const sessions = sessionsRes.data ?? []
    const sessionDates = sessions.map(s => new Date(s.completed_at).toLocaleDateString('en-CA'))
    const uniqueFoodDays = new Set((foodRes.data ?? []).map((f: { logged_date: string }) => f.logged_date))

    const stats: BadgeStats = {
      workoutCount: sessions.length,
      streak: computeStreak(sessionDates),
      pbCount: pbRes.count ?? 0,
      weighInCount: weighInsRes.count ?? 0,
      foodLogDays: uniqueFoodDays.size,
    }

    const alreadyEarned = new Set((earnedRes.data ?? []).map((b: { badge_id: string }) => b.badge_id))
    const toAward = BADGES
      .filter(b => !alreadyEarned.has(b.id) && b.check(stats))
      .map(b => ({ user_id: user.id, badge_id: b.id }))

    if (toAward.length > 0) {
      await supabase.from('user_badges').insert(toAward)
    }

    const now = new Date().toISOString()
    const allEarned = [
      ...(earnedRes.data ?? []),
      ...toAward.map(b => ({ badge_id: b.badge_id, earned_at: now })),
    ]

    return NextResponse.json({
      earned: allEarned,
      newBadges: toAward.map(b => b.badge_id),
      stats,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
