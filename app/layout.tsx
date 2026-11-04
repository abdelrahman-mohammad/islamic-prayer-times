import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { Providers } from '@/components/providers/SessionProvider'
import { QueryProvider } from '@/components/providers/QueryProvider'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: 'Prayer Times Calendar - Sync Islamic Prayer Times to Google Calendar',
  description: 'Automatically sync Islamic prayer times to your Google Calendar with customizable reminders and beautiful glassmorphism UI',
  keywords: ['Islamic prayer times', 'Google Calendar', 'prayer reminders', 'Muslim app', 'salah times'],
  authors: [{ name: 'Prayer Times Calendar' }],
  openGraph: {
    title: 'Prayer Times Calendar',
    description: 'Sync Islamic prayer times to Google Calendar automatically',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Prayer Times Calendar',
    description: 'Sync Islamic prayer times to Google Calendar automatically',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0D9488',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased bg-gradient-to-br from-purple-900 via-purple-700 to-indigo-800 min-h-screen`}>
        <Providers>
          <QueryProvider>
            {/* Background with gradient and pattern */}
            <div className="fixed inset-0 -z-10">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-900 via-purple-700 to-indigo-800" />
              <div className="absolute inset-0 islamic-pattern opacity-10" />
            </div>

            {/* Main content */}
            <div className="relative min-h-screen">
              {children}
            </div>
          </QueryProvider>
        </Providers>
      </body>
    </html>
  )
}