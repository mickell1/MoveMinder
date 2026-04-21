'use client'

import { useState } from 'react'
import { createClient } from '@/src/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function OnboardingPage() {
  const router = useRouter()
  const supabaseClient = createClient()
  const redirect = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('redirect')
    : null
  
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  
  // Form state
  const [fitnessGoal, setFitnessGoal] = useState('')
  const [fitnessLevel, setFitnessLevel] = useState('')
  const [workoutFrequency, setWorkoutFrequency] = useState('')

  const handleComplete = async () => {
    setLoading(true)

    const { data: { user } } = await supabaseClient.auth.getUser()
    
    if (!user) {
      router.push('/login')
      setLoading(false)
      return
    }

    // Update user profile with onboarding data
        const payload = {
          id: user.id,
          // write fitness_level
          fitness_level: fitnessLevel || null,
          goals: fitnessGoal ? [fitnessGoal] : [],
          workout_frequency: workoutFrequency ? parseInt(workoutFrequency, 10) : null,
        }

    const { data: upsertData, error } = await supabaseClient
      .from('profiles')
      .upsert(payload)
      .select()
      .single()

    if (error) {
      console.error('Error updating profile:', error)
      setLoading(false)
      return
    }

    // profile upsert successful
 
     router.push(redirect || '/dashboard')
     router.refresh()
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-2xl w-full">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Step {step} of 3</span>
            <span className="text-sm font-medium text-gray-700">{Math.round((step / 3) * 100)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(step / 3) * 100}%` }}
            />
          </div>
        </div>

        {/* Step 1: Fitness Goal */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">What&apos;s your main fitness goal?</h1>
              <p className="text-gray-600">We&apos;ll personalize your experience based on this</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { value: 'lose_weight', label: 'Lose Weight', icon: '🔥', desc: 'Burn fat and get lean' },
                { value: 'build_muscle', label: 'Build Muscle', icon: '💪', desc: 'Gain strength and size' },
                { value: 'get_fit', label: 'Get Fit', icon: '⚡', desc: 'Improve overall fitness' },
                { value: 'maintain', label: 'Stay Healthy', icon: '🎯', desc: 'Maintain current fitness' },
              ].map((goal) => (
                <button
                  key={goal.value}
                  onClick={() => setFitnessGoal(goal.value)}
                  className={`p-6 rounded-xl border-2 text-left transition-all ${
                    fitnessGoal === goal.value
                      ? 'border-blue-600 bg-blue-50 shadow-md'
                      : 'border-gray-200 hover:border-blue-300 hover:shadow'
                  }`}
                >
                  <div className="text-4xl mb-2">{goal.icon}</div>
                  <h3 className="font-semibold text-lg text-gray-900 mb-1">{goal.label}</h3>
                  <p className="text-sm text-gray-600">{goal.desc}</p>
                </button>
              ))}
            </div>

            <button
              onClick={() => setStep(2)}
              disabled={!fitnessGoal}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
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
              ].map((level) => (
                <button
                  key={level.value}
                  onClick={() => setFitnessLevel(level.value)}
                  className={`w-full p-5 rounded-xl border-2 text-left transition-all ${
                    fitnessLevel === level.value
                      ? 'border-blue-600 bg-blue-50 shadow-md'
                      : 'border-gray-200 hover:border-blue-300 hover:shadow'
                  }`}
                >
                  <h3 className="font-semibold text-lg text-gray-900 mb-1">{level.label}</h3>
                  <p className="text-sm text-gray-600">{level.desc}</p>
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
              >
                Back
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={!fitnessLevel}
                className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Workout Frequency */}
        {step === 3 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">How often do you want to train?</h1>
              <p className="text-gray-600">We&apos;ll suggest a workout plan that fits your schedule</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[
                { value: '2', label: '2x/week' },
                { value: '3', label: '3x/week' },
                { value: '4', label: '4x/week' },
                { value: '5', label: '5x/week' },
                { value: '6', label: '6x/week' },
                { value: '7', label: 'Daily' },
              ].map((freq) => (
                <button
                  key={freq.value}
                  onClick={() => setWorkoutFrequency(freq.value)}
                  className={`p-4 rounded-xl border-2 font-semibold transition-all ${
                    workoutFrequency === freq.value
                      ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-md'
                      : 'border-gray-200 text-gray-700 hover:border-blue-300 hover:shadow'
                  }`}
                >
                  {freq.label}
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(2)}
                className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleComplete}
                disabled={!workoutFrequency || loading}
                className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Saving...' : 'Complete Setup'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}