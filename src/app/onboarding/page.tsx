'use client'

import { useState } from 'react'
import { createClient } from '@/src/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function OnboardingPage() {
  const router = useRouter()
  const supabaseClient = createClient()
  const redirect = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('redirect')
    : null

  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)

  const [fitnessGoal, setFitnessGoal] = useState('')
  const [fitnessLevel, setFitnessLevel] = useState('')
  const [workoutFrequency, setWorkoutFrequency] = useState('')

  const handleComplete = async () => {
    setLoading(true)
    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user) { router.push('/login'); setLoading(false); return }

    const { error } = await supabaseClient.from('profiles').upsert({
      id: user.id,
      fitness_level: fitnessLevel || null,
      goals: fitnessGoal ? [fitnessGoal] : [],
      workout_frequency: workoutFrequency ? parseInt(workoutFrequency, 10) : null,
    }).select().single()

    if (error) { console.error('Error updating profile:', error); setLoading(false); return }

    setStep(4)
    setLoading(false)
  }

  const TOTAL_STEPS = 3

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-2xl w-full">

        {/* Progress bar (steps 1-3 only) */}
        {step <= TOTAL_STEPS && (
          <div className="mb-8">
            <div className="flex justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Step {step} of {TOTAL_STEPS}</span>
              <span className="text-sm font-medium text-gray-700">{Math.round((step / TOTAL_STEPS) * 100)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Step 1: Fitness Goal */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">What&apos;s your main fitness goal?</h1>
              <p className="text-gray-600">We&apos;ll personalise your experience based on this</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { value: 'lose_weight', label: 'Lose Weight', icon: '🔥', desc: 'Burn fat and get lean' },
                { value: 'build_muscle', label: 'Build Muscle', icon: '💪', desc: 'Gain strength and size' },
                { value: 'get_fit', label: 'Get Fit', icon: '⚡', desc: 'Improve overall fitness' },
                { value: 'maintain', label: 'Stay Healthy', icon: '🎯', desc: 'Maintain current fitness' },
              ].map(goal => (
                <button key={goal.value} onClick={() => setFitnessGoal(goal.value)}
                  className={`p-6 rounded-xl border-2 text-left transition-all ${fitnessGoal === goal.value ? 'border-blue-600 bg-blue-50 shadow-md' : 'border-gray-200 hover:border-blue-300 hover:shadow'}`}>
                  <div className="text-4xl mb-2">{goal.icon}</div>
                  <h3 className="font-semibold text-lg text-gray-900 mb-1">{goal.label}</h3>
                  <p className="text-sm text-gray-600">{goal.desc}</p>
                </button>
              ))}
            </div>
            <button onClick={() => setStep(2)} disabled={!fitnessGoal}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors">
              Continue
            </button>
          </div>
        )}

        {/* Step 2: Experience Level */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">What&apos;s your experience level?</h1>
              <p className="text-gray-600">This helps us recommend the right workouts</p>
            </div>
            <div className="space-y-3">
              {[
                { value: 'beginner', label: 'Beginner', desc: 'New to working out or returning after a break' },
                { value: 'intermediate', label: 'Intermediate', desc: 'Been training consistently for 6+ months' },
                { value: 'advanced', label: 'Advanced', desc: 'Training for years with solid technique' },
              ].map(level => (
                <button key={level.value} onClick={() => setFitnessLevel(level.value)}
                  className={`w-full p-5 rounded-xl border-2 text-left transition-all ${fitnessLevel === level.value ? 'border-blue-600 bg-blue-50 shadow-md' : 'border-gray-200 hover:border-blue-300 hover:shadow'}`}>
                  <h3 className="font-semibold text-lg text-gray-900 mb-1">{level.label}</h3>
                  <p className="text-sm text-gray-600">{level.desc}</p>
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep(1)}
                className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-200 transition-colors">Back</button>
              <button onClick={() => setStep(3)} disabled={!fitnessLevel}
                className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors">Continue</button>
            </div>
          </div>
        )}

        {/* Step 3: Workout Frequency */}
        {step === 3 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">How often do you want to train?</h1>
              <p className="text-gray-600">We&apos;ll suggest a plan that fits your schedule</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {['2', '3', '4', '5', '6', '7'].map(v => (
                <button key={v} onClick={() => setWorkoutFrequency(v)}
                  className={`p-4 rounded-xl border-2 font-semibold transition-all ${workoutFrequency === v ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-md' : 'border-gray-200 text-gray-700 hover:border-blue-300 hover:shadow'}`}>
                  {v === '7' ? 'Daily' : `${v}×/week`}
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep(2)}
                className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-200 transition-colors">Back</button>
              <button onClick={handleComplete} disabled={!workoutFrequency || loading}
                className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors">
                {loading ? 'Saving…' : 'Continue'}
              </button>
            </div>
          </div>
        )}

        {/* Step 4: AI Showcase */}
        {step === 4 && (
          <div className="space-y-6">
            <div className="text-center">
              <div className="text-5xl mb-3">🎉</div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">You&apos;re all set!</h1>
              <p className="text-gray-600">Here&apos;s what MoveMinder can do for you</p>
            </div>

            <div className="space-y-3">
              {[
                { icon: '🤖', title: 'AI Personal Trainer', desc: 'Generate a personalised workout or full 4-week program in seconds — based on your goal and level.' },
                { icon: '🥗', title: 'AI Meal Planning', desc: 'Get a 7-day meal plan with macros calculated to your TDEE and dietary preferences.' },
                { icon: '💥', title: 'Personal Best Tracking', desc: 'Every time you set a new PR, MoveMinder detects it automatically and posts it to your feed.' },
                { icon: '👥', title: 'Social & Streaks', desc: 'Add friends, react to their workouts, and keep each other accountable with streak tracking.' },
              ].map(f => (
                <div key={f.title} className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl">
                  <span className="text-2xl flex-shrink-0">{f.icon}</span>
                  <div>
                    <p className="font-semibold text-gray-900">{f.title}</p>
                    <p className="text-sm text-gray-500 mt-0.5">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <Link href="/ai/workout"
                className="block w-full py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-center rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md">
                Generate My First Workout 🏋️
              </Link>
              <Link href={redirect || '/dashboard'}
                className="block w-full py-3 text-center text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors">
                Skip — go to dashboard →
              </Link>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
