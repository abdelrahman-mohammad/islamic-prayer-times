'use client'

import { useState, useEffect } from 'react'
import { useSetupWizard } from '@/contexts/SetupWizardContext'
import { GlassCard } from '@/components/ui/GlassCard'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'

interface StepProps {
  currentStep: number
  setCurrentStep: (step: number) => void
  steps: any[]
}

// Mock calendars for now (will be replaced with actual Google Calendar API call)
const mockCalendars = [
  {
    id: 'primary',
    summary: 'Primary Calendar',
    primary: true,
    backgroundColor: '#4285f4',
  },
  {
    id: 'work',
    summary: 'Work',
    primary: false,
    backgroundColor: '#0f9d58',
  },
  {
    id: 'personal',
    summary: 'Personal',
    primary: false,
    backgroundColor: '#f4b400',
  },
]

export function CalendarStep({ setCurrentStep }: StepProps) {
  const { data, updateData } = useSetupWizard()
  const [selectedCalendar, setSelectedCalendar] = useState(
    data.targetCalendarId || 'primary'
  )
  const [isLoading, setIsLoading] = useState(false)
  const [calendars, setCalendars] = useState(mockCalendars)
  const [createNew, setCreateNew] = useState(false)
  const [newCalendarName, setNewCalendarName] = useState('Prayer Times')

  useEffect(() => {
    updateData({ targetCalendarId: selectedCalendar })
  }, [selectedCalendar, updateData])

  const handleCreateCalendar = async () => {
    setIsLoading(true)
    // TODO: Implement actual calendar creation via API
    setTimeout(() => {
      const newCalendar = {
        id: 'prayer-times',
        summary: newCalendarName,
        primary: false,
        backgroundColor: '#0D9488',
      }
      setCalendars([...calendars, newCalendar])
      setSelectedCalendar('prayer-times')
      setCreateNew(false)
      setIsLoading(false)
    }, 1000)
  }

  const handleNext = () => {
    setCurrentStep(8)
  }

  const handleBack = () => {
    setCurrentStep(6)
  }

  return (
    <GlassCard>
      <div>
        {/* Title */}
        <h2 className="text-2xl font-bold text-white mb-2">
          Select Your Calendar
        </h2>
        <p className="text-white/80 mb-6">
          Choose which calendar to sync your prayer times to
        </p>

        {/* Calendar List */}
        <div className="space-y-3 mb-4">
          {calendars.map((calendar) => (
            <button
              key={calendar.id}
              onClick={() => setSelectedCalendar(calendar.id)}
              className={`w-full p-4 rounded-lg text-left transition-all duration-200 ${
                selectedCalendar === calendar.id
                  ? 'bg-islamic-green/30 border-2 border-islamic-green'
                  : 'glass hover:bg-white/10 border-2 border-transparent'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-4 h-4 rounded"
                    style={{ backgroundColor: calendar.backgroundColor }}
                  />
                  <div>
                    <p className="text-white font-medium">
                      {calendar.summary}
                      {calendar.primary && (
                        <span className="ml-2 text-xs bg-white/20 px-2 py-0.5 rounded">
                          Default
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <div
                  className={`w-5 h-5 rounded-full border-2 transition-all ${
                    selectedCalendar === calendar.id
                      ? 'border-white bg-white'
                      : 'border-white/50'
                  }`}
                >
                  {selectedCalendar === calendar.id && (
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="w-2 h-2 bg-islamic-green rounded-full" />
                    </div>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Create New Calendar */}
        {!createNew ? (
          <button
            onClick={() => setCreateNew(true)}
            className="text-islamic-gold hover:text-islamic-gold-light transition-colors text-sm"
          >
            + Create dedicated "Prayer Times" calendar
          </button>
        ) : (
          <div className="mt-4 p-4 glass rounded-lg">
            <p className="text-white font-medium mb-3">
              Create new calendar:
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={newCalendarName}
                onChange={(e) => setNewCalendarName(e.target.value)}
                placeholder="Calendar name"
                className="flex-1 glass-input text-white"
                autoFocus
              />
              <button
                onClick={handleCreateCalendar}
                disabled={isLoading || !newCalendarName}
                className="glass-button px-4 py-2 text-white hover:bg-white/20 disabled:opacity-50"
              >
                {isLoading ? <LoadingSpinner size="sm" /> : 'Create'}
              </button>
              <button
                onClick={() => {
                  setCreateNew(false)
                  setNewCalendarName('Prayer Times')
                }}
                className="glass-button px-4 py-2 text-white/60 hover:bg-white/10"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Auto-Sync Option */}
        <div className="mt-6 p-4 bg-white/10 rounded-lg">
          <label className="flex items-center justify-between cursor-pointer">
            <div className="flex-1">
              <p className="text-white font-medium">
                Enable automatic daily sync
              </p>
              <p className="text-white/70 text-sm mt-1">
                Prayer times will be updated automatically every day
              </p>
            </div>
            <div className="ml-4">
              <button
                onClick={() => updateData({ autoSync: !data.autoSync })}
                className={`relative w-14 h-7 rounded-full transition-all duration-300 ${
                  data.autoSync ? 'bg-islamic-green' : 'bg-white/30'
                }`}
              >
                <div
                  className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform duration-300 ${
                    data.autoSync ? 'translate-x-7' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </label>
        </div>

        {/* Info */}
        <div className="mt-6 p-4 bg-white/5 rounded-lg">
          <p className="text-white/70 text-sm">
            💡 We recommend using your primary calendar or creating a dedicated
            calendar for prayer times.
          </p>
        </div>

        {/* Navigation Buttons */}
        <div className="flex justify-between mt-8">
          <button
            onClick={handleBack}
            className="glass-button px-6 py-2 text-white hover:bg-white/20"
          >
            ← Back
          </button>
          <button
            onClick={handleNext}
            className="glass-button px-6 py-2 text-white hover:bg-white/20"
          >
            Next →
          </button>
        </div>
      </div>
    </GlassCard>
  )
}