import { GlassCard } from '@/components/ui/GlassCard'
import { cn } from '@/lib/utils'

interface PrayerTimeCardProps {
  name: string
  time: string
  isPassed: boolean
  isNext: boolean
}

const prayerIcons: Record<string, string> = {
  Fajr: '🌅',
  Sunrise: '☀️',
  Dhuhr: '🌞',
  Asr: '🌤️',
  Maghrib: '🌇',
  Isha: '🌙',
}

export function PrayerTimeCard({ name, time, isPassed, isNext }: PrayerTimeCardProps) {
  return (
    <GlassCard
      className={cn(
        'transition-all duration-300',
        isPassed && 'opacity-50',
        isNext && 'ring-2 ring-islamic-green shadow-lg shadow-islamic-green/20'
      )}
      hover
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{prayerIcons[name] || '🕌'}</span>
          <div>
            <h3 className={cn(
              'font-semibold',
              isPassed ? 'text-white/60' : 'text-white'
            )}>
              {name}
            </h3>
            {isNext && (
              <span className="text-xs text-islamic-green">Next Prayer</span>
            )}
            {isPassed && (
              <span className="text-xs text-white/40">Completed</span>
            )}
          </div>
        </div>

        <div className="text-right">
          <p className={cn(
            'text-2xl font-bold',
            isPassed ? 'text-white/40' : 'text-white'
          )}>
            {time}
          </p>
        </div>
      </div>

      {isNext && (
        <div className="mt-3 pt-3 border-t border-white/20">
          <div className="flex items-center gap-2 text-islamic-green text-sm">
            <span className="animate-pulse">●</span>
            <span>Upcoming</span>
          </div>
        </div>
      )}

      {isPassed && (
        <div className="mt-3 pt-3 border-t border-white/20">
          <div className="flex items-center gap-2 text-white/40 text-sm">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
            <span>Completed</span>
          </div>
        </div>
      )}
    </GlassCard>
  )
}