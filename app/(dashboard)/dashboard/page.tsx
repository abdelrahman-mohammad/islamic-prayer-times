'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useSettings } from '@/hooks/useSettings'
import { usePrayerTimes } from '@/hooks/usePrayerTimes'
import { GlassCard } from '@/components/ui/GlassCard'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { NextPrayerCountdown } from '@/components/dashboard/NextPrayerCountdown'
import { PrayerTimeCard } from '@/components/dashboard/PrayerTimeCard'
import { SyncButton } from '@/components/dashboard/SyncButton'
import { ActivityLog } from '@/components/dashboard/ActivityLog'
import { formatTime, parseTimeToDate } from '@/lib/utils'

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { settings, isLoading: settingsLoading } = useSettings()
  const [currentTime, setCurrentTime] = useState(new Date())

  // Fetch prayer times if settings are available
  const {
    data: prayerData,
    isLoading: timesLoading,
    error: timesError,
  } = usePrayerTimes({
    latitude: settings?.latitude || 0,
    longitude: settings?.longitude || 0,
    method: settings?.calculationMethod || 1,
    enabled: !!settings?.latitude && !!settings?.longitude,
  })

  // Update current time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 60000)
    return () => clearInterval(interval)
  }, [])

  // Redirect to setup if no settings
  useEffect(() => {
    if (!settingsLoading && !settings) {
      router.push('/setup')
    }
  }, [settingsLoading, settings, router])

  // Check authentication
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/signin')
    }
  }, [status, router])

  if (status === 'loading' || settingsLoading || timesLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!settings || !prayerData) {
    return null
  }

  const prayers = settings.selectedPrayers || ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']

  // Calculate next prayer
  const getNextPrayer = () => {
    const now = currentTime

    for (const prayer of prayers) {
      const prayerTime = parseTimeToDate(prayerData.timings[prayer])
      if (prayerTime > now) {
        return { name: prayer, time: prayerTime }
      }
    }

    // If all prayers passed today, return tomorrow's Fajr
    const tomorrowFajr = parseTimeToDate(prayerData.timings.Fajr)
    tomorrowFajr.setDate(tomorrowFajr.getDate() + 1)
    return { name: 'Fajr', time: tomorrowFajr }
  }

  const nextPrayer = getNextPrayer()

  return (
    <div className="space-y-6">
      {/* Hero Section - Next Prayer Countdown */}
      <NextPrayerCountdown
        prayerName={nextPrayer.name}
        prayerTime={nextPrayer.time}
        location={`${settings.city}, ${settings.country}`}
        hijriDate={prayerData.date.hijri}
      />

      {/* Actions Row */}
      <div className="flex flex-wrap gap-4">
        <SyncButton />
        <button
          onClick={() => router.push('/settings')}
          className="glass-button px-6 py-3 text-white hover:bg-white/20"
        >
          ⚙️ Settings
        </button>
      </div>

      {/* Today's Prayer Times Grid */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-4">
          Today's Prayer Times
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {prayers.map((prayer) => {
            const time = parseTimeToDate(prayerData.timings[prayer])
            const isPassed = time < currentTime
            const isNext = prayer === nextPrayer.name && !isPassed

            return (
              <PrayerTimeCard
                key={prayer}
                name={prayer}
                time={formatTime(time)}
                isPassed={isPassed}
                isNext={isNext}
              />
            )
          })}

          {/* Optional: Include Sunrise */}
          {settings.selectedPrayers?.includes('Sunrise') && (
            <PrayerTimeCard
              name="Sunrise"
              time={formatTime(parseTimeToDate(prayerData.timings.Sunrise))}
              isPassed={parseTimeToDate(prayerData.timings.Sunrise) < currentTime}
              isNext={false}
            />
          )}
        </div>
      </div>

      {/* Activity Log */}
      <ActivityLog />
    </div>
  )
}