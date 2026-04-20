'use client'
 
import { useEffect, useState } from 'react'
import { createClient } from '@/src/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
 
type InviteState =
  | { status: 'loading' }
  | { status: 'invalid'; reason: string }
  | { status: 'unauthenticated'; inviterName: string | null; token: string }
  | { status: 'already_friends' }
  | { status: 'ready'; inviterId: string; inviterName: string | null; inviteId: string }
  | { status: 'accepting' }
  | { status: 'done' }
 
export default function InvitePage() {
  const supabase = createClient()
  const router = useRouter()
  const params = useParams()
  const token = params?.token as string | undefined
 
  const [state, setState] = useState<InviteState>({ status: 'loading' })
 
  useEffect(() => {
    if (!token) { setState({ status: 'invalid', reason: 'Missing token' }); return }
 
    async function init() {
      // Look up the invite
      const { data: invite, error } = await supabase
        .from('friend_invites')
        .select('id, inviter_id, uses_remaining, expires_at')
        .eq('token', token)
        .maybeSingle()
 
      if (error || !invite) {
        setState({ status: 'invalid', reason: 'This invite link is invalid.' })
        return
      }
 
      if (invite.uses_remaining !== null && invite.uses_remaining <= 0) {
        setState({ status: 'invalid', reason: 'This invite link has already been used.' })
        return
      }
 
      if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
        setState({ status: 'invalid', reason: 'This invite link has expired.' })
        return
      }
 
      // Get inviter name
      const { data: inviterProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', invite.inviter_id)
        .maybeSingle()
 
      const inviterName = inviterProfile?.full_name ?? null
 
      // Check if user is logged in
      const { data: { user } } = await supabase.auth.getUser()
 
      if (!user) {
        setState({ status: 'unauthenticated', inviterName, token: token! })
        return
      }
 
      // Can't accept your own invite
      if (user.id === invite.inviter_id) {
        setState({ status: 'invalid', reason: 'You cannot accept your own invite.' })
        return
      }
 
      // Check if already friends
      const { data: existing } = await supabase
        .from('friendships')
        .select('id')
        .or(
          `and(user_id.eq.${user.id},friend_id.eq.${invite.inviter_id}),` +
          `and(user_id.eq.${invite.inviter_id},friend_id.eq.${user.id})`
        )
        .maybeSingle()
 
      if (existing) {
        setState({ status: 'already_friends' })
        return
      }
 
      setState({
        status: 'ready',
        inviterId: invite.inviter_id,
        inviterName,
        inviteId: invite.id,
      })
    }
 
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])
 
  async function acceptInvite() {
    if (state.status !== 'ready') return
    setState({ status: 'accepting' })
 
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
 
    // Insert friendship
    const { error: fErr } = await supabase
      .from('friendships')
      .insert({
        user_id: state.inviterId,
        friend_id: user.id,
        status: 'accepted',
        accepted_at: new Date().toISOString(),
      })
 
    if (fErr) {
      setState({ status: 'invalid', reason: 'Something went wrong. Please try again.' })
      return
    }
 
    // Decrement uses_remaining
    await supabase.rpc('decrement_invite_uses', { invite_id: state.inviteId }).maybeSingle()
 
    setState({ status: 'done' })
  }
 
  // Redirect after success
  useEffect(() => {
    if (state.status === 'already_friends' || state.status === 'done') {
      router.push('/feed')
    }
  }, [state.status, router])
 
  const InviterName = ({ name }: { name: string | null }) => (
    <span className="font-semibold">{name ?? 'Someone'}</span>
  )
 
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full border border-gray-100 text-center">
        <div className="text-5xl mb-4">🤝</div>
 
        {state.status === 'loading' && (
          <p className="text-gray-600">Loading invite...</p>
        )}
 
        {state.status === 'invalid' && (
          <>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Link unavailable</h2>
            <p className="text-gray-600 mb-6">{state.reason}</p>
            <Link href="/dashboard" className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors">
              Go to Dashboard
            </Link>
          </>
        )}
 
        {state.status === 'unauthenticated' && (
          <>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              <InviterName name={state.inviterName} /> wants to connect
            </h2>
            <p className="text-gray-600 mb-6">Sign in to accept the invite and start tracking together.</p>
            <div className="flex flex-col gap-3">
              <Link
                href={`/login?redirect=/invite/${state.token}`}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
              >
                Sign in to connect
              </Link>
              <Link
                href={`/signup?redirect=/invite/${state.token}`}
                className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
              >
                Create an account
              </Link>
            </div>
          </>
        )}
 
        {state.status === 'ready' && (
          <>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              <InviterName name={state.inviterName} /> wants to connect
            </h2>
            <p className="text-gray-600 mb-6">Accept to see each other's workouts and weigh-ins in your feed.</p>
            <button
              onClick={acceptInvite}
              className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              Accept
            </button>
          </>
        )}
 
        {state.status === 'accepting' && (
          <p className="text-gray-600">Connecting...</p>
        )}
 
        {(state.status === 'already_friends' || state.status === 'done') && (
          <p className="text-gray-600">Redirecting...</p>
        )}
      </div>
    </div>
  )
}