import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700">
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          {/* Logo */}
          <div className="mb-8">
            <div className="inline-block bg-white rounded-full p-8 shadow-2xl mb-6">
              <span className="text-8xl">💪</span>
            </div>
            <h1 className="text-6xl font-bold text-white mb-4">
              MoveMinder AI Fitness Coach
            </h1>
            <p className="text-2xl text-blue-100 mb-8">
              Your personal workout companion
            </p>
          </div>

          {/* Features */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto mb-12">
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 text-white">
              <div className="text-4xl mb-3">🎯</div>
              <h3 className="font-semibold text-lg mb-2">Set Goals</h3>
              <p className="text-blue-100 text-sm">Define your fitness objectives</p>
            </div>
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 text-white">
              <div className="text-4xl mb-3">📝</div>
              <h3 className="font-semibold text-lg mb-2">Track Workouts</h3>
              <p className="text-blue-100 text-sm">Log every rep and set</p>
            </div>
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 text-white">
              <div className="text-4xl mb-3">📈</div>
              <h3 className="font-semibold text-lg mb-2">See Progress</h3>
              <p className="text-blue-100 text-sm">Watch yourself improve</p>
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/signup"
              className="px-8 py-4 bg-white text-blue-600 rounded-xl font-bold text-lg hover:bg-blue-50 transition-all shadow-xl hover:shadow-2xl transform hover:-translate-y-1"
            >
              Get Started Free
            </Link>
            <Link
              href="/login"
              className="px-8 py-4 bg-white/10 backdrop-blur-lg text-white border-2 border-white rounded-xl font-bold text-lg hover:bg-white/20 transition-all"
            >
              Sign In
            </Link>
          </div>

          {/* Footer */}
          <p className="text-blue-100 text-sm mt-12">
            Join thousands of users transforming their fitness journey
          </p>
        </div>
      </div>
    </div>
  )
}