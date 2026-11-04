'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSetupWizard } from '@/contexts/SetupWizardContext'
import { useSettings } from '@/hooks/useSettings'
import { GlassCard } from '@/components/ui/GlassCard'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { getCalculationMethodName } from '@/lib/utils'

interface StepProps {
  currentStep: number
  setCurrentStep: (step: number) => void
  steps: any[]
}

export function ReviewStep({ setCurrentStep }: StepProps) {
  const router = useRouter()
  const { data } = useSetupWizard()
  const { updateSettings } = useSettings()
  const [isSync, setIsSyncing] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSync = async () => {
    setIsSyncing(true)
    setError('')

    try {
      // Save settings to database
      await updateSettings({
        city: data.city!,
        country: data.country!,
        latitude: data.latitude!,
        longitude: data.longitude!,
        calculationMethod: data.calculationMethod!,
        reminderMinutes: data.reminderMinutes!,
        selectedPrayers: data.selectedPrayers!,
        targetCalendarId: data.targetCalendarId!,
        eventTitleTemplate: data.eventTitleTemplate!,
        autoSync: data.autoSync!,
        syncFrequency: data.syncFrequency!,
        autoDeleteEvents: data.autoDeleteEvents!,
        deleteEventsAfter: data.deleteEventsAfter!,
        theme: 'auto',
        language: 'en',
      })

      // TODO: Trigger initial calendar sync
      // await syncCalendar()

      setSuccess(true)

      // Redirect to dashboard after 2 seconds
      setTimeout(() => {
        router.push('/dashboard')
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings')
      setIsSyncing(false)
    }
  }

  const handleBack = () => {
    setCurrentStep(7)
  }

  const formatReminders = () => {
    return data.reminderMinutes?.map(m =>
      m < 60 ? `${m} min` : `${m / 60} hr`
    ).join(', ')
  }

  return (
    <GlassCard>
      <div>
        {/* Title */}
        <h2 className="text-2xl font-bold text-white mb-2">
          Review Your Settings
        </h2>
        <p className="text-white/80 mb-6">
          Everything looks great! Let's sync your first prayer times
        </p>

        {/* Settings Summary */}
        <div className="space-y-4 mb-6">
          {/* Location */}
          <div className="bg-white/5 rounded-lg p-4">
            <p className="text-white/70 text-sm mb-1">Location</p>
            <p className="text-white font-medium">
              {data.city}, {data.country}
            </p>
          </div>

          {/* Calculation Method */}
          <div className="bg-white/5 rounded-lg p-4">
            <p className="text-white/70 text-sm mb-1">Calculation Method</p>
            <p className="text-white font-medium">
              {getCalculationMethodName(data.calculationMethod || 1)}
            </p>
          </div>

          {/* Reminders */}
          <div className="bg-white/5 rounded-lg p-4">
            <p className="text-white/70 text-sm mb-1">Reminders</p>
            <p className="text-white font-medium">
              {formatReminders()} before each prayer
            </p>
          </div>

          {/* Event Title */}
          <div className="bg-white/5 rounded-lg p-4">
            <p className="text-white/70 text-sm mb-1">Event Title Format</p>
            <p className="text-white font-medium">
              {data.eventTitleTemplate}
            </p>
            <p className="text-white/60 text-xs mt-1">
              Example: {data.eventTitleTemplate?.replace('{prayer}', 'Fajr')}
            </p>
          </div>

          {/* Auto-Delete */}
          <div className="bg-white/5 rounded-lg p-4">
            <p className="text-white/70 text-sm mb-1">Auto-Delete</p>
            <p className="text-white font-medium">
              {data.autoDeleteEvents ? (
                <>
                  Enabled - Delete {' '}
                  {data.deleteEventsAfter === '30min' && '30 minutes after prayer'}
                  {data.deleteEventsAfter === 'end-of-day' && 'at end of day'}
                  {data.deleteEventsAfter === 'end-of-week' && 'at end of week'}
                  {data.deleteEventsAfter === 'end-of-month' && 'at end of month'}
                </>
              ) : (
                'Disabled'
              )}
            </p>
          </div>

          {/* Calendar & Sync */}
          <div className="bg-white/5 rounded-lg p-4">
            <p className="text-white/70 text-sm mb-1">Calendar & Sync</p>
            <p className="text-white font-medium">
              {data.targetCalendarId === 'primary' ? 'Primary Calendar' : data.targetCalendarId}
              {data.autoSync && ' • Auto-sync enabled'}
            </p>
          </div>
        </div>

        {/* Success Message */}
        {success && (
          <div className="bg-islamic-green/20 border border-islamic-green rounded-lg p-4 mb-6">
            <p className="text-white font-medium">
              ✓ Settings saved! Redirecting to dashboard...
            </p>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-500/20 border border-red-500 rounded-lg p-4 mb-6">
            <p className="text-white">
              Error: {error}
            </p>
          </div>
        )}

        {/* Action Buttons */}
        {!success && (
          <>
            <div className="text-center mb-6">
              <button
                onClick={handleSync}
                disabled={isSync}
                className={`glass-button px-8 py-3 text-white font-semibold ${
                  !isSync
                    ? 'bg-islamic-green/30 hover:bg-islamic-green/40 border-2 border-islamic-green'
                    : 'opacity-50 cursor-not-allowed'
                }`}
              >
                {isSync ? (
                  <span className="flex items-center gap-2">
                    <LoadingSpinner size="sm" />
                    Syncing...
                  </span>
                ) : (
                  'Sync Prayer Times Now 🚀'
                )}
              </button>
            </div>

            {/* Navigation Buttons */}
            <div className="flex justify-between">
              <button
                onClick={handleBack}
                disabled={isSync}
                className="glass-button px-6 py-2 text-white hover:bg-white/20 disabled:opacity-50"
              >
                ← Back
              </button>
              <button
                onClick={() => router.push('/dashboard')}
                disabled={isSync}
                className="glass-button px-6 py-2 text-white/60 hover:bg-white/10 disabled:opacity-50"
              >
                Skip for now
              </button>
            </div>
          </>
        )}
      </div>
    </GlassCard>
  )
}