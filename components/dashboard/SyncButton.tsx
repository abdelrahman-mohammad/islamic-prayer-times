'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'

export function SyncButton() {
  const queryClient = useQueryClient()
  const [lastSync, setLastSync] = useState<Date | null>(null)

  const syncMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/calendar/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          date: new Date().toISOString(),
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Sync failed')
      }

      return response.json()
    },
    onSuccess: (data) => {
      setLastSync(new Date())
      // Invalidate logs query to refresh activity log
      queryClient.invalidateQueries({ queryKey: ['logs'] })
    },
  })

  const handleSync = () => {
    syncMutation.mutate()
  }

  const formatLastSync = () => {
    if (!lastSync) return null

    const now = new Date()
    const diff = now.getTime() - lastSync.getTime()
    const minutes = Math.floor(diff / 60000)

    if (minutes < 1) return 'Just now'
    if (minutes === 1) return '1 minute ago'
    if (minutes < 60) return `${minutes} minutes ago`

    const hours = Math.floor(minutes / 60)
    if (hours === 1) return '1 hour ago'
    if (hours < 24) return `${hours} hours ago`

    return lastSync.toLocaleDateString()
  }

  return (
    <div className="flex items-center gap-4">
      <button
        onClick={handleSync}
        disabled={syncMutation.isPending}
        className={`glass-button px-6 py-3 text-white font-medium flex items-center gap-2 ${
          syncMutation.isPending
            ? 'opacity-50 cursor-not-allowed'
            : 'hover:bg-white/20'
        }`}
      >
        {syncMutation.isPending ? (
          <>
            <LoadingSpinner size="sm" />
            <span>Syncing...</span>
          </>
        ) : (
          <>
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            <span>Sync Now</span>
          </>
        )}
      </button>

      {/* Success/Error Messages */}
      {syncMutation.isSuccess && (
        <div className="flex items-center gap-2 text-islamic-green">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
          <span className="text-sm">
            Synced successfully
            {syncMutation.data?.eventsCreated > 0 &&
              ` • ${syncMutation.data.eventsCreated} events created`}
          </span>
        </div>
      )}

      {syncMutation.isError && (
        <div className="flex items-center gap-2 text-red-400">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
          <span className="text-sm">
            {syncMutation.error?.message || 'Sync failed'}
          </span>
        </div>
      )}

      {/* Last Sync Time */}
      {lastSync && !syncMutation.isPending && (
        <p className="text-white/60 text-sm">
          Last sync: {formatLastSync()}
        </p>
      )}
    </div>
  )
}