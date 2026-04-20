'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/src/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type WeighIn = {
  id: string
  weight_kg: number
  logged_date: string
  notes: string | null
  share_weight: boolean
}

function WeightChart({ data, unit }: { data: WeighIn[]; unit: 'kg' | 'lb' }) {
  if (data.length < 2) {
    return (
      <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
        Log at least 2 entries to see your chart
      </div>
    )
  }

  const sorted = [...data].sort((a, b) => a.logged_date.localeCompare(b.logged_date))
  const weights = sorted.map(d => unit === 'kg' ? d.weight_kg : d.weight_kg * 2.20462)
  const minW = Math.min(...weights)
  const maxW = Math.max(...weights)
  const range = maxW - minW || 1

  const W = 600
  const H = 160
  const PAD = { top: 10, right: 20, bottom: 30, left: 48 }
  const chartW = W - PAD.left - PAD.right
  const chartH = H - PAD.top - PAD.bottom

  const pts = sorted.map((_, i) => ({
    x: PAD.left + (i / (sorted.length - 1)) * chartW,
    y: PAD.top + (1 - (weights[i] - minW) / range) * chartH,
    w: weights[i],
  }))

  const polyline = pts.map(p => `${p.x},${p.y}`).join(' ')

  const yTicks = [0, 0.5, 1].map(t => ({
    w: minW + t * range,
    y: PAD.top + (1 - t) * chartH,
  }))

  const xStep = Math.max(1, Math.floor(sorted.length / 5))
  const xLabels = sorted
    .map((d, i) => ({ d, i }))
    .filter(({ i }) => i % xStep === 0 || i === sorted.length - 1)
    .map(({ d, i }) => ({
      x: PAD.left + (i / (sorted.length - 1)) * chartW,
      label: new Date(d.logged_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    }))

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 200 }}>
      {yTicks.map((t, i) => (
        <line key={i} x1={PAD.left} y1={t.y} x2={W - PAD.right} y2={t.y} stroke="#e5e7eb" strokeWidth="1" />
      ))}
      {yTicks.map((t, i) => (
        <text key={i} x={PAD.left - 6} y={t.y + 4} textAnchor="end" fontSize="11" fill="#9ca3af">
          {Math.round(t.w * 10) / 10}
        </text>
      ))}
      {xLabels.map((l, i) => (
        <text key={i} x={l.x} y={H - 5} textAnchor="middle" fontSize="10" fill="#9ca3af">
          {l.label}
        </text>
      ))}
      <polygon
        points={`${PAD.left},${PAD.top + chartH} ${polyline} ${W - PAD.right},${PAD.top + chartH}`}
        fill="rgba(59,130,246,0.08)"
      />
      <polyline points={polyline} fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="4" fill="#3b82f6" stroke="white" strokeWidth="2" />
      ))}
    </svg>
  )
}

export default function WeighInHistoryPage() {
  const supabase = createClient()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [entries, setEntries] = useState<WeighIn[]>([])
  const [unit, setUnit] = useState<'kg' | 'lb'>('kg')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editWeight, setEditWeight] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editShare, setEditShare] = useState(false)

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data } = await supabase
      .from('weigh_ins')
      .select('*')
      .eq('user_id', user.id)
      .order('logged_date', { ascending: false })
      .limit(90)

    setEntries((data ?? []) as WeighIn[])
    setLoading(false)
  }, [supabase, router])

  useEffect(() => { load() }, [load])

  function displayWeight(kg: number) {
    return unit === 'kg' ? `${Math.round(kg * 10) / 10} kg` : `${Math.round(kg * 2.20462 * 10) / 10} lb`
  }

  function startEdit(entry: WeighIn) {
    setEditingId(entry.id)
    const w = unit === 'kg' ? entry.weight_kg : Math.round(entry.weight_kg * 2.20462 * 10) / 10
    setEditWeight(String(w))
    setEditNotes(entry.notes ?? '')
    setEditShare(entry.share_weight)
  }

  async function saveEdit(id: string) {
    const val = parseFloat(editWeight)
    if (isNaN(val) || val <= 0) return
    const kg = unit === 'kg' ? val : val / 2.20462
    await supabase
      .from('weigh_ins')
      .update({ weight_kg: kg, notes: editNotes || null, share_weight: editShare })
      .eq('id', id)
    setEditingId(null)
    load()
  }

  async function deleteEntry(id: string) {
    if (!confirm('Delete this entry?')) return
    await supabase.from('weigh_ins').delete().eq('id', id)
    load()
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-xl text-gray-600">Loading...</div>
      </div>
    )
  }

  const sorted = [...entries].sort((a, b) => a.logged_date.localeCompare(b.logged_date))

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <Link href="/weigh-in" className="text-gray-600 hover:text-gray-900 text-sm">←</Link>
              <h1 className="text-xl font-bold text-gray-900">Weight History</h1>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex bg-gray-100 rounded-lg p-1">
                {(['kg', 'lb'] as const).map(u => (
                  <button
                    key={u}
                    onClick={() => setUnit(u)}
                    className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                      unit === u ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'
                    }`}
                  >
                    {u}
                  </button>
                ))}
              </div>
              <Link href="/weigh-in" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                Log Weight
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        {entries.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-8 border border-gray-200 text-center">
            <div className="text-5xl mb-4">⚖️</div>
            <p className="text-gray-500 mb-4">No weigh-ins yet</p>
            <Link
              href="/weigh-in"
              className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              Log Your First Weight
            </Link>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 mb-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Progress Chart</h2>
              <WeightChart data={sorted} unit={unit} />
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-bold text-gray-900">Log Entries</h2>
              </div>
              <div className="divide-y divide-gray-100">
                {entries.map(entry => (
                  <div key={entry.id} className="px-6 py-4">
                    {editingId === entry.id ? (
                      <div className="space-y-3">
                        <div className="flex gap-2">
                          <input
                            type="number"
                            step="0.1"
                            value={editWeight}
                            onChange={e => setEditWeight(e.target.value)}
                            className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            placeholder={unit}
                          />
                          <input
                            type="text"
                            value={editNotes}
                            onChange={e => setEditNotes(e.target.value)}
                            placeholder="Notes (optional)"
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={editShare}
                              onChange={e => setEditShare(e.target.checked)}
                              className="rounded"
                            />
                            Share with friends
                          </label>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setEditingId(null)}
                              className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => saveEdit(entry.id)}
                              className="px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-gray-900">{displayWeight(entry.weight_kg)}</p>
                          <p className="text-sm text-gray-500">
                            {new Date(entry.logged_date + 'T00:00:00').toLocaleDateString('en-US', {
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric',
                            })}
                            {entry.share_weight && (
                              <span className="ml-2 text-xs text-blue-500">shared</span>
                            )}
                          </p>
                          {entry.notes && <p className="text-sm text-gray-600 mt-0.5">{entry.notes}</p>}
                        </div>
                        <div className="flex gap-3">
                          <button
                            onClick={() => startEdit(entry)}
                            className="text-sm text-blue-600 hover:text-blue-700"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => deleteEntry(entry.id)}
                            className="text-sm text-red-500 hover:text-red-600"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
