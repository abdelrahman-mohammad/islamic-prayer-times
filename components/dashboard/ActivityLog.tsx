'use client'

import { useQuery } from '@tanstack/react-query'
import { GlassCard } from '@/components/ui/GlassCard'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { formatDate } from '@/lib/utils'
import { type SyncLog } from '@/lib/types'

export function ActivityLog() {
  const { data: logs, isLoading } = useQuery({
    queryKey: ['logs'],
    queryFn: async () => {
      const response = await fetch('/api/logs?limit=10')
      if (!response.ok) {
        throw new Error('Failed to fetch logs')
      }
      const result = await response.json()
      return result.data as SyncLog[]
    },
  })

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return '✅'
      case 'failure':
        return '❌'
      case 'cleanup':
        return '🧹'
      default:
        return '📝'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'text-islamic-green'
      case 'failure':
        return 'text-red-400'
      case 'cleanup':
        return 'text-blue-400'
      default:
        return 'text-white/70'
    }
  }

  const getStatusMessage = (log: SyncLog) => {
    if (log.status === 'success') {
      return `Created ${log.eventsCreated} events`
    }
    if (log.status === 'cleanup') {
      return `Deleted ${log.eventsDeleted} old events`
    }
    if (log.status === 'failure') {
      return log.errorMessage || 'Sync failed'
    }
    return 'Unknown status'
  }

  return (
    <GlassCard>
      <div>
        <h3 className="text-xl font-bold text-white mb-4">
          Recent Activity
        </h3>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner size="md" />
          </div>
        ) : logs && logs.length > 0 ? (
          <div className="space-y-3">
            {logs.map((log) => (
              <div
                key={log.id}
                className="flex items-start gap-3 p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
              >
                <span className="text-xl mt-1">{getStatusIcon(log.status)}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`font-medium ${getStatusColor(log.status)}`}>
                      {log.status === 'success' && 'Sync Successful'}
                      {log.status === 'failure' && 'Sync Failed'}
                      {log.status === 'cleanup' && 'Cleanup Completed'}
                    </span>
                  </div>
                  <p className="text-white/70 text-sm">
                    {getStatusMessage(log)}
                  </p>
                  <p className="text-white/50 text-xs mt-1">
                    {formatDate(new Date(log.timestamp))}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-white/60">No activity yet</p>
            <p className="text-white/40 text-sm mt-2">
              Sync your prayer times to see activity here
            </p>
          </div>
        )}

        {logs && logs.length >= 10 && (
          <div className="mt-4 text-center">
            <button className="text-islamic-gold hover:text-islamic-gold-light transition-colors text-sm">
              View all activity →
            </button>
          </div>
        )}
      </div>
    </GlassCard>
  )
}