'use client'

import { useState, useEffect } from 'react'
import { useSetupWizard } from '@/contexts/SetupWizardContext'
import { GlassCard } from '@/components/ui/GlassCard'

interface StepProps {
  currentStep: number
  setCurrentStep: (step: number) => void
  steps: any[]
}

const presetReminders = [
  { value: 5, label: '5 minutes' },
  { value: 10, label: '10 minutes' },
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 60, label: '1 hour' },
]

export function RemindersStep({ setCurrentStep }: StepProps) {
  const { data, updateData } = useSetupWizard()
  const [selectedReminders, setSelectedReminders] = useState<number[]>(
    data.reminderMinutes || [30]
  )
  const [customMinutes, setCustomMinutes] = useState('')
  const [showCustom, setShowCustom] = useState(false)

  useEffect(() => {
    updateData({ reminderMinutes: selectedReminders })
  }, [selectedReminders, updateData])

  const toggleReminder = (minutes: number) => {
    setSelectedReminders(prev => {
      if (prev.includes(minutes)) {
        return prev.filter(m => m !== minutes)
      } else {
        return [...prev, minutes].sort((a, b) => b - a)
      }
    })
  }

  const addCustomReminder = () => {
    const minutes = parseInt(customMinutes)
    if (minutes > 0 && minutes <= 1440 && !selectedReminders.includes(minutes)) {
      setSelectedReminders(prev => [...prev, minutes].sort((a, b) => b - a))
      setCustomMinutes('')
      setShowCustom(false)
    }
  }

  const handleNext = () => {
    if (selectedReminders.length > 0) {
      setCurrentStep(5)
    }
  }

  const handleBack = () => {
    setCurrentStep(3)
  }

  return (
    <GlassCard>
      <div>
        {/* Title */}
        <h2 className="text-2xl font-bold text-white mb-2">
          Set Prayer Reminders
        </h2>
        <p className="text-white/80 mb-6">
          Choose when you want to be reminded before each prayer
        </p>

        {/* Selected Reminders Display */}
        {selectedReminders.length > 0 && (
          <div className="bg-islamic-green/20 rounded-lg p-4 mb-6 border border-islamic-green/30">
            <p className="text-white/90 text-sm mb-2">Active reminders:</p>
            <div className="flex flex-wrap gap-2">
              {selectedReminders.map(minutes => (
                <span
                  key={minutes}
                  className="bg-islamic-green/40 text-white px-3 py-1 rounded-full text-sm"
                >
                  {minutes < 60 ? `${minutes} min` : `${minutes / 60} hr`} before
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Preset Reminders */}
        <div className="space-y-2 mb-4">
          <p className="text-white/90 text-sm font-medium mb-3">
            Quick select (tap to toggle):
          </p>
          <div className="grid grid-cols-2 gap-3">
            {presetReminders.map(reminder => (
              <button
                key={reminder.value}
                onClick={() => toggleReminder(reminder.value)}
                className={`p-3 rounded-lg transition-all duration-200 ${
                  selectedReminders.includes(reminder.value)
                    ? 'bg-islamic-green/30 border-2 border-islamic-green text-white'
                    : 'glass hover:bg-white/10 border-2 border-transparent text-white/80'
                }`}
              >
                <span className="text-lg">⏰</span>
                <span className="ml-2">{reminder.label}</span>
                {selectedReminders.includes(reminder.value) && (
                  <span className="ml-2">✓</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Reminder */}
        <div className="mt-4">
          {!showCustom ? (
            <button
              onClick={() => setShowCustom(true)}
              className="text-islamic-gold hover:text-islamic-gold-light transition-colors text-sm"
            >
              + Add custom reminder time
            </button>
          ) : (
            <div className="flex gap-2">
              <input
                type="number"
                value={customMinutes}
                onChange={(e) => setCustomMinutes(e.target.value)}
                placeholder="Minutes (1-1440)"
                className="flex-1 glass-input text-white text-sm"
                min="1"
                max="1440"
                autoFocus
              />
              <button
                onClick={addCustomReminder}
                className="glass-button px-4 py-2 text-white text-sm hover:bg-white/20"
              >
                Add
              </button>
              <button
                onClick={() => {
                  setShowCustom(false)
                  setCustomMinutes('')
                }}
                className="glass-button px-4 py-2 text-white/60 text-sm hover:bg-white/10"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="mt-6 p-4 bg-white/5 rounded-lg">
          <p className="text-white/70 text-sm">
            💡 You can set multiple reminders for each prayer. These will create
            popup notifications in Google Calendar.
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
            disabled={selectedReminders.length === 0}
            className={`glass-button px-6 py-2 text-white ${
              selectedReminders.length > 0
                ? 'hover:bg-white/20'
                : 'opacity-50 cursor-not-allowed'
            }`}
          >
            Next →
          </button>
        </div>
      </div>
    </GlassCard>
  )
}