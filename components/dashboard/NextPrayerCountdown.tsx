'use client'

import { useState, useEffect } from 'react'
import { GlassCard } from '@/components/ui/GlassCard'

interface NextPrayerCountdownProps {
  prayerName: string
  prayerTime: Date
  location: string
  hijriDate?: any
}

export function NextPrayerCountdown({
  prayerName,
  prayerTime,
  location,
  hijriDate,
}: NextPrayerCountdownProps) {
  const [timeLeft, setTimeLeft] = useState('')

  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date()
      const diff = prayerTime.getTime() - now.getTime()

      if (diff <= 0) {
        setTimeLeft('Now!')
        return
      }

      const hours = Math.floor(diff / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((diff % (1000 * 60)) / 1000)

      if (hours > 0) {
        setTimeLeft(`${hours}h ${minutes}m ${seconds}s`)
      } else if (minutes > 0) {
        setTimeLeft(`${minutes}m ${seconds}s`)
      } else {
        setTimeLeft(`${seconds}s`)
      }
    }

    updateCountdown()
    const interval = setInterval(updateCountdown, 1000)

    return () => clearInterval(interval)
  }, [prayerTime])

  const formatPrayerTime = () => {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(prayerTime)
  }

  const getHijriDisplay = () => {
    if (!hijriDate) return ''
    return `${hijriDate.day} ${hijriDate.month.en} ${hijriDate.year}`
  }

  return (
    <GlassCard className="relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0 islamic-pattern" />
      </div>

      <div className="relative z-10">
        <div className="text-center">
          {/* Location and Date */}
          <div className="mb-4">
            <p className="text-white/70 text-sm">
              📍 {location}
            </p>
            {hijriDate && (
              <p className="text-islamic-gold text-sm mt-1">
                {getHijriDisplay()}
              </p>
            )}
          </div>

          {/* Next Prayer Label */}
          <p className="text-white/90 text-lg mb-2">Next Prayer</p>

          {/* Prayer Name */}
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-2">
            {prayerName}
          </h2>

          {/* Prayer Time */}
          <p className="text-2xl text-white/90 mb-6">
            {formatPrayerTime()}
          </p>

          {/* Countdown */}
          <div className="bg-islamic-green/20 rounded-2xl p-6 border border-islamic-green/30">
            <p className="text-white/70 text-sm mb-2">Time Remaining</p>
            <p className="text-4xl md:text-5xl font-bold text-islamic-green-light animate-pulse-slow">
              {timeLeft}
            </p>
          </div>

          {/* Motivational Quote */}
          <div className="mt-6 p-4 bg-white/5 rounded-lg">
            <p className="text-white/70 text-sm italic">
              "Indeed, prayer has been decreed upon the believers a decree of specified times."
            </p>
            <p className="text-white/50 text-xs mt-1">
              — Quran 4:103
            </p>
          </div>
        </div>
      </div>
    </GlassCard>
  )
}