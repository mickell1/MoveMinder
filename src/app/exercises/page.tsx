'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/src/lib/supabase/client'
import { Search, Dumbbell } from 'lucide-react'
import Link from 'next/link'

interface Exercise {
  id: string
  name: string
  description: string
  muscle_group: string
  equipment: string
  difficulty: string
}

export default function ExercisesPage() {
  const supabase = createClient()
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedMuscleGroup, setSelectedMuscleGroup] = useState('all')
  const [loading, setLoading] = useState(true)

  const muscleGroups = ['all', 'chest', 'back', 'legs', 'shoulders', 'arms', 'core', 'cardio']

  useEffect(() => {
    const fetchExercises = async () => {
      const { data, error } = await supabase
        .from('exercises')
        .select('*')
        .order('name')

      if (error) {
        console.error('Error fetching exercises:', error)
      } else {
        setExercises(data || [])
      }
      setLoading(false)
    }

    fetchExercises()
  }, [supabase])

  const filteredExercises = exercises.filter(ex => {
    const matchesMuscleGroup = selectedMuscleGroup === 'all' || ex.muscle_group === selectedMuscleGroup
    const matchesSearch = !searchTerm || 
      ex.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ex.description?.toLowerCase().includes(searchTerm.toLowerCase())
    
    return matchesMuscleGroup && matchesSearch
  })

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'bg-green-100 text-green-800'
      case 'intermediate': return 'bg-yellow-100 text-yellow-800'
      case 'advanced': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <Link href="/dashboard" className="text-3xl">💪</Link>
              <h1 className="text-2xl font-bold text-gray-900">Exercise Library</h1>
            </div>
            <Link
              href="/dashboard"
              className="text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors"
            >
              ← Back to Dashboard
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search exercises..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Muscle Group Filter */}
        <div className="flex gap-2 overflow-x-auto pb-4 mb-6">
          {muscleGroups.map(group => (
            <button
              key={group}
              onClick={() => setSelectedMuscleGroup(group)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                selectedMuscleGroup === group
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {group.charAt(0).toUpperCase() + group.slice(1)}
            </button>
          ))}
        </div>

        {/* Exercise Grid */}
        {loading ? (
          <div className="text-center py-12">
            <div className="text-xl text-gray-600">Loading exercises...</div>
          </div>
        ) : filteredExercises.length === 0 ? (
          <div className="text-center py-12">
            <Dumbbell className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-500">No exercises found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredExercises.map(exercise => (
              <div
                key={exercise.id}
                className="bg-white border border-gray-200 rounded-lg p-6 hover:border-blue-500 hover:shadow-md transition-all"
              >
                <h3 className="font-semibold text-gray-900 text-lg mb-2">{exercise.name}</h3>
                <p className="text-sm text-gray-600 mb-4">{exercise.description}</p>
                <div className="flex flex-wrap gap-2">
                  <span className="text-xs px-3 py-1 bg-blue-100 text-blue-800 rounded-full">
                    {exercise.equipment}
                  </span>
                  <span className="text-xs px-3 py-1 bg-purple-100 text-purple-800 rounded-full">
                    {exercise.muscle_group}
                  </span>
                  <span className={`text-xs px-3 py-1 rounded-full ${getDifficultyColor(exercise.difficulty)}`}>
                    {exercise.difficulty}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}