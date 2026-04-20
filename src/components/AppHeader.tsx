'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/src/lib/supabase/client'

interface NavLink {
  href: string
  label: string
}

interface Props {
  title: string
  links: NavLink[]
  onLogout?: () => void
}

export function AppHeader({ title, links, onLogout }: Props) {
  const [open, setOpen] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    const supabase = createClient()
    async function fetchPending() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { count } = await supabase
        .from('friendships')
        .select('id', { count: 'exact', head: true })
        .eq('friend_id', user.id)
        .eq('status', 'pending')
      setPendingCount(count ?? 0)
    }
    fetchPending()
  }, [])

  function renderLink(l: NavLink, mobile = false) {
    const isFriends = l.href === '/friends'
    return (
      <Link
        key={l.href}
        href={l.href}
        onClick={() => mobile && setOpen(false)}
        className={
          mobile
            ? 'px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg transition-colors flex items-center gap-2'
            : 'text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors whitespace-nowrap flex items-center gap-1.5'
        }
      >
        {l.label}
        {isFriends && pendingCount > 0 && (
          <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full">
            {pendingCount > 9 ? '9+' : pendingCount}
          </span>
        )}
      </Link>
    )
  }

  return (
    <header className="bg-white shadow-sm border-b sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-3xl flex-shrink-0">💪</span>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">{title}</h1>
          </div>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-4 flex-shrink-0 ml-4">
            {links.map(l => renderLink(l))}
            {onLogout && (
              <button
                onClick={onLogout}
                className="text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
              >
                Logout
              </button>
            )}
          </nav>

          {/* Mobile hamburger — shows badge dot if pending */}
          <button
            className="md:hidden flex-shrink-0 ml-3 p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors relative"
            onClick={() => setOpen(o => !o)}
            aria-label="Toggle menu"
          >
            {pendingCount > 0 && !open && (
              <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full" />
            )}
            {open ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>

        {/* Mobile dropdown */}
        {open && (
          <nav className="md:hidden mt-3 pt-3 border-t border-gray-100 flex flex-col">
            {links.map(l => renderLink(l, true))}
            {onLogout && (
              <button
                onClick={() => { setOpen(false); onLogout() }}
                className="text-left px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
              >
                Logout
              </button>
            )}
          </nav>
        )}
      </div>
    </header>
  )
}
