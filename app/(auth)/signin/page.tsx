'use client'

import { signIn } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function SignInContent() {
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard'

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4">
      <div className="glass-card max-w-md w-full text-center">
        {/* Logo/Title */}
        <div className="mb-8">
          <div className="text-6xl mb-4">🕌</div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Welcome Back
          </h1>
          <p className="text-white/80">
            Sign in to sync your prayer times with Google Calendar
          </p>
        </div>

        {/* Sign In Button */}
        <button
          onClick={() => signIn('google', { callbackUrl })}
          className="glass-button w-full py-3 px-6 flex items-center justify-center gap-3 text-white font-medium hover:bg-white/25 transition-all duration-300"
        >
          <svg
            className="w-5 h-5"
            viewBox="0 0 24 24"
            fill="currentColor"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Continue with Google
        </button>

        {/* Privacy Notice */}
        <p className="mt-6 text-xs text-white/60">
          By signing in, you agree to our{' '}
          <a href="/privacy" className="underline hover:text-white/80">
            Privacy Policy
          </a>{' '}
          and{' '}
          <a href="/terms" className="underline hover:text-white/80">
            Terms of Service
          </a>
        </p>
      </div>

      {/* Features reminder */}
      <div className="mt-8 text-center text-white/70">
        <p className="text-sm mb-2">Sign in to access:</p>
        <div className="flex flex-wrap justify-center gap-4 text-xs">
          <span className="glass px-3 py-1 rounded-full">
            ✓ Automatic sync
          </span>
          <span className="glass px-3 py-1 rounded-full">
            ✓ Multiple reminders
          </span>
          <span className="glass px-3 py-1 rounded-full">
            ✓ Custom settings
          </span>
        </div>
      </div>
    </div>
  )
}

export default function SignInPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-white">Loading...</div>
      </div>
    }>
      <SignInContent />
    </Suspense>
  )
}