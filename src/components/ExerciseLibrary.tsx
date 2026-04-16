import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase/supabase';
import { Search, Plus, Dumbbell } from 'lucide-react';

interface Exercise {
  id: string;
  name: string;
  description: string;
  muscle_group: string;
  equipment: string;
  difficulty: string;
}

interface ExerciseLibraryProps {
  onSelectExercise: (exercise: Exercise) => void;
}

export default function ExerciseLibrary({ onSelectExercise }: ExerciseLibraryProps) {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMuscleGroup, setSelectedMuscleGroup] = useState('all');
  const [loading, setLoading] = useState(true);

  const muscleGroups = ['all', 'chest', 'back', 'legs', 'shoulders', 'arms', 'core', 'cardio'];

  const fetchExercises = async () => {
    const { data, error } = await supabase
      .from('exercises')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error fetching exercises:', error);
    } else {
      setExercises(data || []);
    }
    setLoading(false);
  };

  const filteredExercises = useMemo(() => {
    let filtered = exercises;

    if (selectedMuscleGroup !== 'all') {
      filtered = filtered.filter(ex => ex.muscle_group === selectedMuscleGroup);
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(ex =>
        ex.name.toLowerCase().includes(term) ||
        ex.description?.toLowerCase().includes(term)
      );
    }

    return filtered;
  }, [searchTerm, selectedMuscleGroup, exercises]);

  useEffect(() => {
    let isMounted = true;

    (async () => {
      const { data, error } = await supabase
        .from('exercises')
        .select('*')
        .order('name');

      if (!isMounted) return;

      if (error) {
        console.error('Error fetching exercises:', error);
      } else {
        setExercises(data || []);
      }
      setLoading(false);
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'bg-green-100 text-green-800';
      case 'intermediate': return 'bg-yellow-100 text-yellow-800';
      case 'advanced': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading exercises...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          type="text"
          placeholder="Search exercises..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Muscle Group Filter */}
      <div className="flex gap-2 overflow-x-auto pb-2">
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

      {/* Exercise List */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {filteredExercises.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Dumbbell className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No exercises found</p>
          </div>
        ) : (
          filteredExercises.map(exercise => (
            <div
              key={exercise.id}
              className="border border-gray-200 rounded-lg p-4 hover:border-blue-500 transition-colors cursor-pointer"
              onClick={() => onSelectExercise(exercise)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">{exercise.name}</h3>
                  <p className="text-sm text-gray-600 mt-1">{exercise.description}</p>
                  <div className="flex gap-2 mt-2">
                    <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded">
                      {exercise.equipment}
                    </span>
                    <span className={`text-xs px-2 py-1 rounded ${getDifficultyColor(exercise.difficulty)}`}>
                      {exercise.difficulty}
                    </span>
                  </div>
                </div>
                <Plus className="w-5 h-5 text-blue-600 flex-shrink-0 ml-2" />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}