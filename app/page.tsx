import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 py-16">
      <div className="glass-card max-w-4xl w-full text-center">
        {/* Hero Section */}
        <div className="mb-12">
          <h1 className="text-5xl font-bold text-white mb-4 animate-fade-in">
            Prayer Times Calendar
          </h1>
          <p className="text-xl text-white/90 mb-8">
            Automatically sync Islamic prayer times to your Google Calendar
          </p>

          {/* Features Grid */}
          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <div className="glass-card">
              <div className="text-islamic-gold text-3xl mb-3">🕌</div>
              <h3 className="text-lg font-semibold text-white mb-2">
                Accurate Prayer Times
              </h3>
              <p className="text-white/80 text-sm">
                Calculate prayer times based on your exact location and preferred method
              </p>
            </div>

            <div className="glass-card">
              <div className="text-islamic-gold text-3xl mb-3">📅</div>
              <h3 className="text-lg font-semibold text-white mb-2">
                Google Calendar Sync
              </h3>
              <p className="text-white/80 text-sm">
                Automatically add prayer times to your calendar with customizable reminders
              </p>
            </div>

            <div className="glass-card">
              <div className="text-islamic-gold text-3xl mb-3">✨</div>
              <h3 className="text-lg font-semibold text-white mb-2">
                Beautiful Design
              </h3>
              <p className="text-white/80 text-sm">
                Stunning glassmorphism UI with Islamic-themed design elements
              </p>
            </div>
          </div>

          {/* CTA Button */}
          <Link href="/signin" className="inline-block">
            <button className="glass-button px-8 py-3 text-lg font-semibold text-white hover:bg-white/25 transition-all duration-300">
              Get Started with Google
            </button>
          </Link>
        </div>

        {/* Additional Features */}
        <div className="border-t border-white/20 pt-8">
          <h2 className="text-2xl font-bold text-white mb-6">
            Everything You Need
          </h2>

          <div className="grid md:grid-cols-2 gap-4 text-left">
            <div className="flex items-start gap-3">
              <span className="text-islamic-gold">✓</span>
              <p className="text-white/90 text-sm">
                Multiple calculation methods (ISNA, MWL, Umm Al-Qura, and more)
              </p>
            </div>

            <div className="flex items-start gap-3">
              <span className="text-islamic-gold">✓</span>
              <p className="text-white/90 text-sm">
                Customizable reminders (5, 10, 15, 30 minutes before)
              </p>
            </div>

            <div className="flex items-start gap-3">
              <span className="text-islamic-gold">✓</span>
              <p className="text-white/90 text-sm">
                Auto-delete old prayer events to keep calendar clean
              </p>
            </div>

            <div className="flex items-start gap-3">
              <span className="text-islamic-gold">✓</span>
              <p className="text-white/90 text-sm">
                Custom event titles with your preferred format
              </p>
            </div>

            <div className="flex items-start gap-3">
              <span className="text-islamic-gold">✓</span>
              <p className="text-white/90 text-sm">
                Daily, weekly, or monthly automatic sync
              </p>
            </div>

            <div className="flex items-start gap-3">
              <span className="text-islamic-gold">✓</span>
              <p className="text-white/90 text-sm">
                Privacy-focused: minimal data collection
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-12 text-center text-white/60 text-sm">
        <p>© 2025 Prayer Times Calendar. All rights reserved.</p>
        <p className="mt-2">
          <Link href="/privacy" className="hover:text-white/80 transition-colors">
            Privacy Policy
          </Link>
          {' • '}
          <Link href="/terms" className="hover:text-white/80 transition-colors">
            Terms of Service
          </Link>
        </p>
      </footer>
    </div>
  )
}