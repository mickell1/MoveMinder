'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/src/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AppHeader } from '@/src/components/AppHeader'

export default function AICoachPage() {
  const supabase = createClient()
  const router = useRouter()
  const [name, setName] = useState<string | null>(null)
  const [profileComplete, setProfileComplete] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data } = await supabase.from('profiles').select('full_name, height_cm, age, sex, activity_level').eq('id', user.id).single()
      setName(data?.full_name?.split(' ')[0] ?? null)
      setProfileComplete(!!(data?.height_cm && data?.age && data?.sex && data?.activity_level))
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const firstName = name ?? 'there'

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader title="MoveMinder" />

      <main className="max-w-xl mx-auto px-4 py-8 space-y-6">
        {/* Hero */}
        <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-3xl p-6 text-white">
          <div className="text-4xl mb-2">🤖</div>
          <h1 className="text-2xl font-bold mb-1">AI Personal Trainer</h1>
          <p className="text-indigo-200 text-sm">
            Hey {firstName}! I&apos;m your AI coach. I use your body stats, fitness level, and goals to build workouts and meal plans specifically for you.
          </p>
        </div>

        {/* Profile completeness warning */}
        {!profileComplete && (
          <Link href="/ai/profile"
            className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
            <span className="text-2xl">⚠️</span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-800">Complete your AI profile</p>
              <p className="text-xs text-amber-600">Add height, age & activity level for accurate plans</p>
            </div>
            <span className="text-amber-500 font-bold">→</span>
          </Link>
        )}

        {/* Feature cards */}
        <div className="space-y-3">

          <Link href="/ai/workout"
            className="block bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow active:scale-[0.99]">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0">🏋️</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <h2 className="font-bold text-gray-900">AI Workout Generator</h2>
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">New</span>
                </div>
                <p className="text-sm text-gray-500">Get a single session or full 4-week program tailored to your level and goals. Saves straight to your workout library.</p>
                <p className="text-xs text-blue-600 font-semibold mt-2">Generate workout →</p>
              </div>
            </div>
          </Link>

          <Link href="/nutrition"
            className="block bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow active:scale-[0.99]">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0">🥗</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <h2 className="font-bold text-gray-900">AI Meal Plan</h2>
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">New</span>
                </div>
                <p className="text-sm text-gray-500">7-day meal plan with calculated macros, respecting your dietary preferences and calorie targets.</p>
                <p className="text-xs text-green-600 font-semibold mt-2">Generate meal plan →</p>
              </div>
            </div>
          </Link>

          <Link href="/ai/profile"
            className="block bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow active:scale-[0.99]">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-violet-100 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0">👤</div>
              <div className="flex-1 min-w-0">
                <h2 className="font-bold text-gray-900 mb-0.5">AI Profile Setup</h2>
                <p className="text-sm text-gray-500">Height, age, sex, activity level, and dietary preferences. The more you add, the more accurate your plans will be.</p>
                <p className="text-xs text-violet-600 font-semibold mt-2">{profileComplete ? 'Edit profile →' : 'Complete profile →'}</p>
              </div>
            </div>
          </Link>
        </div>

        <p className="text-center text-xs text-gray-400">
          Powered by Claude AI · Plans are AI-generated and for guidance only
        </p>
      </main>
    </div>
  )
}
