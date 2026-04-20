'use client'
 
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/src/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
 
type FriendProfile = { id: string; full_name: string | null }
 
type FriendData = {
  friendshipId: string
  profile: FriendProfile
  weeklyWorkouts: number
  weighInStreak: number
}
 
type PendingFriend = {
  friendshipId: string
  otherId: string
  profile: FriendProfile
}
 
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
 
function Avatar({ name }: { name: string | null }) {
  const initial = name?.trim()[0]?.toUpperCase() ?? '?'
  return (
    <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-sm flex-shrink-0">
      {initial}
    </div>
  )
}
 
export default function FriendsPage() {
  const supabase = createClient()
  const router = useRouter()
 
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'friends' | 'pending' | 'sent'>('friends')
  const [userId, setUserId] = useState<string | null>(null)
  const [friends, setFriends] = useState<FriendData[]>([])
  const [pendingIn, setPendingIn] = useState<PendingFriend[]>([])
  const [pendingOut, setPendingOut] = useState<PendingFriend[]>([])
  const [inviteLink, setInviteLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [creatingInvite, setCreatingInvite] = useState(false)
 
  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    setUserId(user.id)
 
    const { data: ships } = await supabase
      .from('friendships')
      .select('id, user_id, friend_id, status')
      .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
 
    const accepted = (ships ?? []).filter(f => f.status === 'accepted')
    const inbound = (ships ?? []).filter(f => f.status === 'pending' && f.friend_id === user.id)
    const outbound = (ships ?? []).filter(f => f.status === 'pending' && f.user_id === user.id)
 
    const friendIds = accepted.map(f => f.user_id === user.id ? f.friend_id : f.user_id)
    const inboundIds = inbound.map(f => f.user_id)
    const outboundIds = outbound.map(f => f.friend_id)
    const allIds = [...new Set([...friendIds, ...inboundIds, ...outboundIds])]
 
    const profileMap = new Map<string, FriendProfile>()
    if (allIds.length > 0) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', allIds)
      profs?.forEach(p => profileMap.set(p.id, p))
    }
 
    // Weekly workout counts for accepted friends
    const weeklyMap = new Map<string, number>()
    if (friendIds.length > 0) {
      const start = new Date()
      start.setDate(start.getDate() - start.getDay())
      start.setHours(0, 0, 0, 0)
      const { data: sess } = await supabase
        .from('workout_sessions')
        .select('user_id')
        .in('user_id', friendIds)
        .gte('completed_at', start.toISOString())
      sess?.forEach(s => weeklyMap.set(s.user_id, (weeklyMap.get(s.user_id) ?? 0) + 1))
    }
 
    // Weigh-in streaks for accepted friends
    const streakMap = new Map<string, number>()
    if (friendIds.length > 0) {
      const ago = new Date()
      ago.setDate(ago.getDate() - 60)
      const { data: weighins } = await supabase
        .from('friend_weigh_ins')
        .select('user_id, logged_date')
        .in('user_id', friendIds)
        .gte('logged_date', ago.toLocaleDateString('en-CA'))
      const byUser = new Map<string, string[]>()
      weighins?.forEach(w => {
        if (!byUser.has(w.user_id)) byUser.set(w.user_id, [])
        byUser.get(w.user_id)!.push(w.logged_date)
      })
      friendIds.forEach(id => streakMap.set(id, calcStreak(byUser.get(id) ?? [])))
    }
 
    setFriends(
      accepted.map(f => {
        const fid = f.user_id === user.id ? f.friend_id : f.user_id
        return {
          friendshipId: f.id,
          profile: profileMap.get(fid) ?? { id: fid, full_name: null },
          weeklyWorkouts: weeklyMap.get(fid) ?? 0,
          weighInStreak: streakMap.get(fid) ?? 0,
        }
      })
    )
    setPendingIn(
      inbound.map(f => ({
        friendshipId: f.id,
        otherId: f.user_id,
        profile: profileMap.get(f.user_id) ?? { id: f.user_id, full_name: null },
      }))
    )
    setPendingOut(
      outbound.map(f => ({
        friendshipId: f.id,
        otherId: f.friend_id,
        profile: profileMap.get(f.friend_id) ?? { id: f.friend_id, full_name: null },
      }))
    )
    setLoading(false)
  }, [supabase, router])
 
  useEffect(() => { load() }, [load])
 
  async function createInvite() {
    if (!userId) return
    setCreatingInvite(true)
    const token = crypto.randomUUID()
    const expires = new Date()
    expires.setDate(expires.getDate() + 7)
    const { error } = await supabase
      .from('friend_invites')
      .insert({ inviter_id: userId, token, uses_remaining: 10, expires_at: expires.toISOString() })
    if (!error) {
      setInviteLink(`${window.location.origin}/invite/${token}`)
    }
    setCreatingInvite(false)
  }
 
  async function copyLink() {
    if (!inviteLink) return
    if (navigator.share) {
      try { await navigator.share({ title: 'Join me on MoveMinder', url: inviteLink }); return } catch { /* fallthrough */ }
    }
    await navigator.clipboard.writeText(inviteLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
 
  async function acceptFriend(friendshipId: string) {
    await supabase
      .from('friendships')
      .update({ status: 'accepted', accepted_at: new Date().toISOString() })
      .eq('id', friendshipId)
    load()
  }
 
  async function rejectFriend(friendshipId: string) {
    await supabase.from('friendships').delete().eq('id', friendshipId)
    load()
  }
 
  async function removeFriend(friendshipId: string) {
    if (!confirm('Remove this friend?')) return
    await supabase.from('friendships').delete().eq('id', friendshipId)
    load()
  }
 
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-xl text-gray-600">Loading...</div>
      </div>
    )
  }
 
  const TABS = [
    { key: 'friends' as const, label: 'Friends', count: friends.length },
    { key: 'pending' as const, label: 'Pending', count: pendingIn.length },
    { key: 'sent' as const, label: 'Sent', count: pendingOut.length },
  ]
 
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <span className="text-3xl">💪</span>
              <h1 className="text-2xl font-bold text-gray-900">Friends</h1>
            </div>
            <div className="flex items-center gap-4">
              <Link href="/feed" className="text-sm font-medium text-gray-700 hover:text-blue-600">Feed</Link>
              <Link href="/weigh-in" className="text-sm font-medium text-gray-700 hover:text-blue-600">Weigh-In</Link>
              <Link href="/dashboard" className="text-sm font-medium text-gray-700 hover:text-blue-600">Dashboard</Link>
            </div>
          </div>
        </div>
      </header>
 
      <main className="max-w-2xl mx-auto px-4 py-8">
        {/* Invite card */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-1">Invite a friend</h2>
          <p className="text-sm text-gray-500 mb-4">Share a link — anyone with it can connect with you</p>
          {inviteLink ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                <span className="text-sm text-gray-700 truncate flex-1 font-mono">{inviteLink}</span>
              </div>
              <button
                onClick={copyLink}
                className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
              >
                {copied ? '✓ Copied!' : navigator.share ? 'Share Link' : 'Copy Link'}
              </button>
              <button
                onClick={() => setInviteLink(null)}
                className="w-full py-2 text-sm text-gray-500 hover:text-gray-700"
              >
                Generate a new link
              </button>
            </div>
          ) : (
            <button
              onClick={createInvite}
              disabled={creatingInvite}
              className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {creatingInvite ? 'Generating...' : 'Generate Invite Link'}
            </button>
          )}
        </div>
 
        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-4">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
              {t.count > 0 && (
                <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                  tab === t.key ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'
                }`}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>
 
        {/* Friends tab */}
        {tab === 'friends' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            {friends.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No friends yet — invite someone!
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {friends.map(f => (
                  <div key={f.friendshipId} className="flex items-center justify-between px-5 py-4">
                    <div className="flex items-center gap-3">
                      <Avatar name={f.profile.full_name} />
                      <div>
                        <p className="font-semibold text-gray-900">{f.profile.full_name ?? 'Unknown'}</p>
                        <p className="text-sm text-gray-500">
                          {f.weeklyWorkouts} workout{f.weeklyWorkouts !== 1 ? 's' : ''} this week
                          {f.weighInStreak > 0 && (
                            <span className="ml-2">🔥 {f.weighInStreak} day streak</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => removeFriend(f.friendshipId)}
                      className="text-sm text-gray-400 hover:text-red-500 transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
 
        {/* Pending tab */}
        {tab === 'pending' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            {pendingIn.length === 0 ? (
              <div className="p-8 text-center text-gray-500">No pending requests</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {pendingIn.map(f => (
                  <div key={f.friendshipId} className="flex items-center justify-between px-5 py-4">
                    <div className="flex items-center gap-3">
                      <Avatar name={f.profile.full_name} />
                      <p className="font-semibold text-gray-900">{f.profile.full_name ?? 'Unknown'}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => acceptFriend(f.friendshipId)}
                        className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => rejectFriend(f.friendshipId)}
                        className="px-3 py-1.5 bg-gray-100 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
 
        {/* Sent tab */}
        {tab === 'sent' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            {pendingOut.length === 0 ? (
              <div className="p-8 text-center text-gray-500">No sent requests</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {pendingOut.map(f => (
                  <div key={f.friendshipId} className="flex items-center justify-between px-5 py-4">
                    <div className="flex items-center gap-3">
                      <Avatar name={f.profile.full_name} />
                      <div>
                        <p className="font-semibold text-gray-900">{f.profile.full_name ?? 'Unknown'}</p>
                        <p className="text-sm text-gray-400">Awaiting response</p>
                      </div>
                    </div>
                    <button
                      onClick={() => rejectFriend(f.friendshipId)}
                      className="text-sm text-gray-400 hover:text-red-500 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}