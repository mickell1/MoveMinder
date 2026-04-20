'use client'

import { useState } from 'react'
import Link from 'next/link'

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
            {links.map(l => (
              <Link
                key={l.href}
                href={l.href}
                className="text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors whitespace-nowrap"
              >
                {l.label}
              </Link>
            ))}
            {onLogout && (
              <button
                onClick={onLogout}
                className="text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
              >
                Logout
              </button>
            )}
          </nav>

          {/* Mobile hamburger */}
          <button
            className="md:hidden flex-shrink-0 ml-3 p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
            onClick={() => setOpen(o => !o)}
            aria-label="Toggle menu"
          >
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
            {links.map(l => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
              >
                {l.label}
              </Link>
            ))}
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
