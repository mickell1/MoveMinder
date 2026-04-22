'use client'

import { useState, useEffect } from 'react'

export type CalorieUnit = 'kcal' | 'cal'

const STORAGE_KEY = 'calorie_unit'

export function useCalorieUnit() {
  const [unit, setUnitState] = useState<CalorieUnit>('kcal')

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'kcal' || stored === 'cal') setUnitState(stored)
  }, [])

  function setUnit(u: CalorieUnit) {
    setUnitState(u)
    localStorage.setItem(STORAGE_KEY, u)
  }

  // "kcal" or "Cal" — same number, different label
  const label = unit === 'kcal' ? 'kcal' : 'Cal'

  return { unit, label, setUnit }
}
