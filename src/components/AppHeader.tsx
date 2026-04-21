'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
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
  const pathname = usePathname()

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

  // Close menu on route change
  useEffect(() => { setOpen(false) }, [pathname])

  function renderLink(l: NavLink, mobile = false) {
    const isSocial = l.href === '/feed' || l.href === '/friends'
    const isActive = pathname === l.href || (l.href !== '/dashboard' && pathname?.startsWith(l.href + '/'))
    return (
      <Link
        key={l.href}
        href={l.href}
        className={
          mobile
            ? `px-3 py-3 text-sm font-medium rounded-xl transition-colors flex items-center justify-between ${
                isActive ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-50'
              }`
            : `text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-1.5 px-2 py-1 rounded-lg ${
                isActive ? 'text-blue-600 bg-blue-50' : 'text-gray-600 hover:text-blue-600 hover:bg-gray-50'
              }`
        }
      >
        <span>{l.label}</span>
        {isSocial && pendingCount > 0 && (
          <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full flex-shrink-0">
            {pendingCount > 9 ? '9+' : pendingCount}
          </span>
        )}
      </Link>
    )
  }

  return (
    <header className="bg-white border-b sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-16">
          {/* Logo — always navigates home */}
          <Link href="/dashboard" className="flex items-center gap-2 flex-shrink-0" aria-label="Home">
            <span className="text-2xl">💪</span>
            <span className="text-base sm:text-lg font-bold text-gray-900 truncate max-w-[140px] sm:max-w-none">{title}</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1 flex-shrink-0">
            {links.map(l => renderLink(l))}
            {onLogout && (
              <button
                onClick={onLogout}
                className="ml-2 px-3 py-1.5 text-sm font-medium text-gray-500 hover:text-gray-800 transition-colors rounded-lg hover:bg-gray-50"
              >
                Logout
              </button>
            )}
          </nav>

          {/* Mobile hamburger */}
          <button
            className="md:hidden flex-shrink-0 p-2 rounded-xl text-gray-600 hover:bg-gray-100 transition-colors relative"
            onClick={() => setOpen(o => !o)}
            aria-label="Toggle menu"
          >
            {pendingCount > 0 && !open && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
            )}
            {open ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>

        {/* Mobile dropdown */}
        {open && (
          <nav className="md:hidden pb-3 pt-2 border-t border-gray-100 flex flex-col gap-1">
            {links.map(l => renderLink(l, true))}
            {onLogout && (
              <button
                onClick={() => { setOpen(false); onLogout() }}
                className="text-left px-3 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-xl transition-colors"
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
