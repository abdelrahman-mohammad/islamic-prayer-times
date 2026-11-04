'use client'

import { signOut } from 'next-auth/react'
import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'

interface DashboardHeaderProps {
  user: any
}

export function DashboardHeader({ user }: DashboardHeaderProps) {
  const [showMenu, setShowMenu] = useState(false)

  return (
    <header className="glass border-b border-white/20">
      <div className="container mx-auto px-4 py-4 max-w-7xl">
        <div className="flex items-center justify-between">
          {/* Logo/Title */}
          <Link href="/dashboard" className="flex items-center gap-3">
            <span className="text-2xl">🕌</span>
            <h1 className="text-xl font-bold text-white">
              Prayer Times Calendar
            </h1>
          </Link>

          {/* User Menu */}
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="flex items-center gap-3 glass-button px-4 py-2 hover:bg-white/20"
            >
              {user.picture ? (
                <Image
                  src={user.picture}
                  alt={user.name || 'User'}
                  width={32}
                  height={32}
                  className="rounded-full"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-islamic-green flex items-center justify-center text-white font-bold">
                  {user.name?.[0] || user.email?.[0] || 'U'}
                </div>
              )}
              <span className="text-white hidden sm:block">
                {user.name || user.email}
              </span>
              <svg
                className="w-4 h-4 text-white/60"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>

            {/* Dropdown Menu */}
            {showMenu && (
              <div className="absolute right-0 top-full mt-2 w-56 glass rounded-lg overflow-hidden z-50">
                <Link
                  href="/dashboard"
                  className="block px-4 py-3 text-white hover:bg-white/10 transition-colors"
                  onClick={() => setShowMenu(false)}
                >
                  <span className="mr-2">📊</span> Dashboard
                </Link>
                <Link
                  href="/settings"
                  className="block px-4 py-3 text-white hover:bg-white/10 transition-colors"
                  onClick={() => setShowMenu(false)}
                >
                  <span className="mr-2">⚙️</span> Settings
                </Link>
                <Link
                  href="/logs"
                  className="block px-4 py-3 text-white hover:bg-white/10 transition-colors"
                  onClick={() => setShowMenu(false)}
                >
                  <span className="mr-2">📝</span> Activity Logs
                </Link>
                <hr className="border-white/20" />
                <button
                  onClick={() => signOut({ callbackUrl: '/' })}
                  className="block w-full text-left px-4 py-3 text-white hover:bg-white/10 transition-colors"
                >
                  <span className="mr-2">🚪</span> Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}