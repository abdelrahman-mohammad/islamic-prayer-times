'use client'

import { useState, useEffect } from 'react'
import { useSetupWizard } from '@/contexts/SetupWizardContext'
import { GlassCard } from '@/components/ui/GlassCard'

interface StepProps {
  currentStep: number
  setCurrentStep: (step: number) => void
  steps: any[]
}

const deleteOptions = [
  {
    value: '30min',
    label: '30 minutes after prayer',
    description: 'Events deleted 30 minutes after prayer time ends',
    icon: '⏱️',
  },
  {
    value: 'end-of-day',
    label: 'End of day',
    description: 'All prayer events deleted at 11:59 PM',
    icon: '🌙',
  },
  {
    value: 'end-of-week',
    label: 'End of week',
    description: 'Events deleted on Sunday at 11:59 PM',
    icon: '📅',
  },
  {
    value: 'end-of-month',
    label: 'End of month',
    description: 'Events deleted on the last day of the month',
    icon: '📆',
  },
]

export function AutoDeleteStep({ setCurrentStep }: StepProps) {
  const { data, updateData } = useSetupWizard()
  const [enabled, setEnabled] = useState(data.autoDeleteEvents || false)
  const [deleteAfter, setDeleteAfter] = useState(
    data.deleteEventsAfter || 'end-of-day'
  )

  useEffect(() => {
    updateData({
      autoDeleteEvents: enabled,
      deleteEventsAfter: deleteAfter,
    })
  }, [enabled, deleteAfter, updateData])

  const handleNext = () => {
    setCurrentStep(7)
  }

  const handleBack = () => {
    setCurrentStep(5)
  }

  return (
    <GlassCard>
      <div>
        {/* Title */}
        <h2 className="text-2xl font-bold text-white mb-2">
          Auto-Delete Past Events
        </h2>
        <p className="text-white/80 mb-6">
          Keep your calendar clean by automatically removing old prayer events
        </p>

        {/* Enable/Disable Toggle */}
        <div className="bg-white/10 rounded-lg p-4 mb-6">
          <label className="flex items-center justify-between cursor-pointer">
            <div className="flex-1">
              <p className="text-white font-medium">
                Enable automatic cleanup
              </p>
              <p className="text-white/70 text-sm mt-1">
                Past prayer events will be deleted automatically
              </p>
            </div>
            <div className="ml-4">
              <button
                onClick={() => setEnabled(!enabled)}
                className={`relative w-14 h-7 rounded-full transition-all duration-300 ${
                  enabled ? 'bg-islamic-green' : 'bg-white/30'
                }`}
              >
                <div
                  className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform duration-300 ${
                    enabled ? 'translate-x-7' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </label>
        </div>

        {/* Delete Options */}
        {enabled && (
          <div className="space-y-3 animate-fade-in">
            <p className="text-white/90 text-sm font-medium mb-3">
              When to delete past events:
            </p>
            {deleteOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setDeleteAfter(option.value as any)}
                className={`w-full p-4 rounded-lg text-left transition-all duration-200 ${
                  deleteAfter === option.value
                    ? 'bg-islamic-green/30 border-2 border-islamic-green'
                    : 'glass hover:bg-white/10 border-2 border-transparent'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{option.icon}</span>
                  <div className="flex-1">
                    <p className="text-white font-medium">{option.label}</p>
                    <p className="text-white/70 text-sm mt-1">
                      {option.description}
                    </p>
                  </div>
                  <div
                    className={`w-5 h-5 rounded-full border-2 transition-all ${
                      deleteAfter === option.value
                        ? 'border-white bg-white'
                        : 'border-white/50'
                    }`}
                  >
                    {deleteAfter === option.value && (
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="w-2 h-2 bg-islamic-green rounded-full" />
                      </div>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Info */}
        <div className="mt-6 p-4 bg-white/5 rounded-lg">
          <p className="text-white/70 text-sm">
            💡 This helps keep your calendar organized by removing past prayer
            events. You can change this setting anytime.
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