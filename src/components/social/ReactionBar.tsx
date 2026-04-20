'use client'
 
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/src/lib/supabase/client'
 
const EMOJIS = ['🔥', '💪', '👏', '❤️'] as const
 
type Reaction = { emoji: string; user_id: string }
 
export function ReactionBar({ sessionId, userId }: { sessionId: string; userId: string }) {
  const supabase = createClient()
  const [reactions, setReactions] = useState<Reaction[]>([])
 
  const load = useCallback(async () => {
    const { data } = await supabase
      .from('session_reactions')
      .select('emoji, user_id')
      .eq('session_id', sessionId)
    setReactions(data ?? [])
  }, [sessionId, supabase])
 
  useEffect(() => { load() }, [load])
 
  async function toggle(emoji: string) {
    const mine = reactions.some(r => r.user_id === userId && r.emoji === emoji)
    if (mine) {
      await supabase
        .from('session_reactions')
        .delete()
        .eq('session_id', sessionId)
        .eq('user_id', userId)
        .eq('emoji', emoji)
    } else {
      await supabase
        .from('session_reactions')
        .insert({ session_id: sessionId, user_id: userId, emoji })
    }
    load()
  }
 
  return (
    <div className="flex flex-wrap gap-2">
      {EMOJIS.map(emoji => {
        const count = reactions.filter(r => r.emoji === emoji).length
        const active = reactions.some(r => r.user_id === userId && r.emoji === emoji)
        return (
          <button
            key={emoji}
            onClick={() => toggle(emoji)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              active
                ? 'bg-blue-50 text-blue-700 border-blue-300'
                : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
            }`}
          >
            <span>{emoji}</span>
            {count > 0 && <span className="tabular-nums">{count}</span>}
          </button>
        )
      })}
    </div>
  )
}