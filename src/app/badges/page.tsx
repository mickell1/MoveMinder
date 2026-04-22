'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/src/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AppHeader } from '@/src/components/AppHeader'
import { BADGES, BADGE_CATEGORIES, type BadgeCategory } from '@/src/lib/badges'

type EarnedBadge = { badge_id: string; earned_at: string }

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function BadgesPage() {
  const router = useRouter()
  const supabase = createClient()
  const [earned, setEarned] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [newBadges, setNewBadges] = useState<string[]>([])
  const [filter, setFilter] = useState<BadgeCategory | 'all'>('all')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const res = await fetch('/api/badges/check', { method: 'POST' })
      const data = await res.json()

      if (data.earned) {
        const map = new Map<string, string>()
        for (const b of data.earned as EarnedBadge[]) {
          map.set(b.badge_id, b.earned_at)
        }
        setEarned(map)
        setNewBadges(data.newBadges ?? [])
      }
      setLoading(false)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtered = filter === 'all' ? BADGES : BADGES.filter(b => b.category === filter)
  const earnedCount = BADGES.filter(b => earned.has(b.id)).length

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-lg text-gray-600">Checking achievements…</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader title="MoveMinder" />

      <main className="max-w-xl mx-auto px-4 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href="/profile" className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Achievements</h1>
            <p className="text-sm text-gray-500 mt-0.5">{earnedCount} of {BADGES.length} unlocked</p>
          </div>
        </div>

        {/* New badges alert */}
        {newBadges.length > 0 && (
          <div className="bg-gradient-to-r from-amber-400 to-orange-500 rounded-2xl p-4 text-white">
            <p className="font-bold text-lg mb-1">🎉 New achievement{newBadges.length > 1 ? 's' : ''} unlocked!</p>
            {newBadges.map(id => {
              const badge = BADGES.find(b => b.id === id)
              return badge ? (
                <p key={id} className="text-sm text-amber-100">{badge.icon} {badge.name}</p>
              ) : null
            })}
          </div>
        )}

        {/* Progress bar */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="font-semibold text-gray-700">Overall Progress</span>
            <span className="text-gray-500">{earnedCount}/{BADGES.length}</span>
          </div>
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full transition-all duration-500"
              style={{ width: `${Math.max((earnedCount / BADGES.length) * 100, earnedCount > 0 ? 4 : 0)}%` }}
            />
          </div>
        </div>

        {/* Category filter */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
          <button onClick={() => setFilter('all')}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${filter === 'all' ? 'bg-amber-500 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>
            All
          </button>
          {BADGE_CATEGORIES.map(cat => (
            <button key={cat.id} onClick={() => setFilter(cat.id)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${filter === cat.id ? 'bg-amber-500 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>
              {cat.icon} {cat.label}
            </button>
          ))}
        </div>

        {/* Badge grid */}
        <div className="grid grid-cols-2 gap-3">
          {filtered.map(badge => {
            const earnedAt = earned.get(badge.id)
            const isNew = newBadges.includes(badge.id)
            return (
              <div key={badge.id}
                className={`rounded-2xl border p-4 transition-all ${earnedAt ? 'bg-white border-gray-100 shadow-sm' : 'bg-gray-50 border-gray-100'} ${isNew ? 'ring-2 ring-amber-400' : ''}`}>
                <div className={`text-3xl mb-2 ${earnedAt ? '' : 'grayscale opacity-40'}`}>{badge.icon}</div>
                <p className={`font-semibold text-sm mb-0.5 ${earnedAt ? 'text-gray-900' : 'text-gray-400'}`}>{badge.name}</p>
                <p className="text-xs text-gray-400">{badge.description}</p>
                {earnedAt && (
                  <div className="mt-2 flex items-center gap-1.5">
                    <p className="text-xs text-amber-600 font-medium">{formatDate(earnedAt)}</p>
                    {isNew && <span className="text-xs font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">New!</span>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </main>
    </div>
  )
}
