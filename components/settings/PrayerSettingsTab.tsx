'use client'

import { useState } from 'react'
import type { UserSettings } from '@/lib/types'

interface PrayerSettingsTabProps {
  settings: UserSettings
  onSave: (settings: Partial<UserSettings>) => void
}

const calculationMethods = [
  { value: 1, name: 'ISNA (Islamic Society of North America)', region: 'North America' },
  { value: 2, name: 'Muslim World League', region: 'Europe, Far East, America' },
  { value: 3, name: 'Umm Al-Qura', region: 'Saudi Arabia' },
  { value: 4, name: 'Egyptian General Authority', region: 'Egypt, Africa, Syria, Lebanon' },
  { value: 5, name: 'University of Islamic Sciences, Karachi', region: 'Pakistan, Bangladesh, India' },
]

const allPrayers = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']

export function PrayerSettingsTab({ settings, onSave }: PrayerSettingsTabProps) {
  const [selectedPrayers, setSelectedPrayers] = useState<string[]>(
    settings.selectedPrayers || allPrayers.filter(p => p !== 'Sunrise')
  )
  const [calculationMethod, setCalculationMethod] = useState(settings.calculationMethod || 1)
  const [reminderMinutes, setReminderMinutes] = useState<number[]>(
    settings.reminderMinutes || [30, 15, 5]
  )
  const [newReminder, setNewReminder] = useState('')
  const [eventTitleTemplate, setEventTitleTemplate] = useState(
    settings.eventTitleTemplate || '{prayer} Prayer'
  )
  const [templateError, setTemplateError] = useState('')

  const togglePrayer = (prayer: string) => {
    setSelectedPrayers(prev =>
      prev.includes(prayer)
        ? prev.filter(p => p !== prayer)
        : [...prev, prayer]
    )
  }

  const addReminder = () => {
    const minutes = parseInt(newReminder)
    if (minutes > 0 && minutes <= 120 && !reminderMinutes.includes(minutes)) {
      setReminderMinutes([...reminderMinutes, minutes].sort((a, b) => b - a))
      setNewReminder('')
    }
  }

  const removeReminder = (minutes: number) => {
    setReminderMinutes(reminderMinutes.filter(m => m !== minutes))
  }

  const validateTemplate = (template: string) => {
    if (!template.includes('{prayer}')) {
      setTemplateError('Template must include {prayer} placeholder')
      return false
    }
    setTemplateError('')
    return true
  }

  const handleTemplateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setEventTitleTemplate(value)
    validateTemplate(value)
  }

  const handleSave = () => {
    if (!validateTemplate(eventTitleTemplate)) return

    onSave({
      selectedPrayers,
      calculationMethod,
      reminderMinutes,
      eventTitleTemplate,
    })
  }

  const hasChanges =
    JSON.stringify(selectedPrayers) !== JSON.stringify(settings.selectedPrayers) ||
    calculationMethod !== settings.calculationMethod ||
    JSON.stringify(reminderMinutes) !== JSON.stringify(settings.reminderMinutes) ||
    eventTitleTemplate !== settings.eventTitleTemplate

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Prayer Settings</h2>
        <p className="text-white/70">
          Configure prayer time calculations and event preferences
        </p>
      </div>

      {/* Calculation Method */}
      <div>
        <label className="block text-white font-medium mb-3">
          Calculation Method
        </label>
        <div className="space-y-2">
          {calculationMethods.map((method) => (
            <label
              key={method.value}
              className={`flex items-start gap-3 p-4 rounded-lg cursor-pointer transition-all ${
                calculationMethod === method.value
                  ? 'bg-white/20 border border-islamic-green/50'
                  : 'bg-white/10 border border-transparent hover:bg-white/15'
              }`}
            >
              <input
                type="radio"
                value={method.value}
                checked={calculationMethod === method.value}
                onChange={() => setCalculationMethod(method.value)}
                className="mt-1"
              />
              <div>
                <p className="text-white font-medium">{method.name}</p>
                <p className="text-white/60 text-sm">Recommended for: {method.region}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Prayer Selection */}
      <div>
        <label className="block text-white font-medium mb-3">
          Prayers to Sync
        </label>
        <div className="grid grid-cols-3 gap-3">
          {allPrayers.map((prayer) => (
            <label
              key={prayer}
              className={`flex items-center gap-2 p-3 rounded-lg cursor-pointer transition-all ${
                selectedPrayers.includes(prayer)
                  ? 'bg-islamic-green/20 border border-islamic-green/30'
                  : 'bg-white/10 border border-transparent hover:bg-white/15'
              }`}
            >
              <input
                type="checkbox"
                checked={selectedPrayers.includes(prayer)}
                onChange={() => togglePrayer(prayer)}
              />
              <span className="text-white">{prayer}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Event Title Template */}
      <div>
        <label className="block text-white font-medium mb-2">
          Event Title Template
        </label>
        <input
          type="text"
          value={eventTitleTemplate}
          onChange={handleTemplateChange}
          placeholder="e.g., {prayer} Prayer"
          className={`w-full glass-input text-white ${
            templateError ? 'border-red-500' : ''
          }`}
        />
        {templateError && (
          <p className="text-red-400 text-sm mt-1">{templateError}</p>
        )}
        <p className="text-white/60 text-sm mt-2">
          Use {'{prayer}'} as placeholder. Preview: {eventTitleTemplate.replace('{prayer}', 'Fajr')}
        </p>
      </div>

      {/* Reminders */}
      <div>
        <label className="block text-white font-medium mb-3">
          Prayer Reminders (minutes before)
        </label>
        <div className="flex flex-wrap gap-2 mb-3">
          {reminderMinutes.map((minutes) => (
            <div
              key={minutes}
              className="flex items-center gap-2 px-3 py-2 bg-white/10 rounded-lg"
            >
              <span className="text-white">{minutes} min</span>
              <button
                onClick={() => removeReminder(minutes)}
                className="text-white/60 hover:text-white"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="number"
            min="1"
            max="120"
            value={newReminder}
            onChange={(e) => setNewReminder(e.target.value)}
            placeholder="Add reminder (1-120 min)"
            className="flex-1 glass-input text-white"
          />
          <button
            onClick={addReminder}
            disabled={!newReminder || parseInt(newReminder) <= 0 || parseInt(newReminder) > 120}
            className="glass-button px-4 py-2 text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Add
          </button>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={!hasChanges || !!templateError || selectedPrayers.length === 0}
          className="glass-button px-6 py-2 bg-islamic-green/20 text-white hover:bg-islamic-green/30 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Save Prayer Settings
        </button>
      </div>
    </div>
  )
}