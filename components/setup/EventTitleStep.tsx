'use client'

import { useState, useEffect } from 'react'
import { useSetupWizard } from '@/contexts/SetupWizardContext'
import { GlassCard } from '@/components/ui/GlassCard'

interface StepProps {
  currentStep: number
  setCurrentStep: (step: number) => void
  steps: any[]
}

const titleTemplates = [
  { template: '{prayer} Prayer', preview: 'Fajr Prayer' },
  { template: '🕌 {prayer}', preview: '🕌 Fajr' },
  { template: 'Time for {prayer}', preview: 'Time for Fajr' },
  { template: '{prayer} - صلاة', preview: 'Fajr - صلاة' },
  { template: '📿 {prayer} Prayer', preview: '📿 Fajr Prayer' },
]

export function EventTitleStep({ setCurrentStep }: StepProps) {
  const { data, updateData } = useSetupWizard()
  const [template, setTemplate] = useState(data.eventTitleTemplate || '{prayer} Prayer')
  const [isCustom, setIsCustom] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    // Validate template
    if (!template.includes('{prayer}')) {
      setError('Template must include {prayer} placeholder')
    } else {
      setError('')
      updateData({ eventTitleTemplate: template })
    }
  }, [template, updateData])

  const getPreview = (prayerName: string) => {
    return template.replace('{prayer}', prayerName)
  }

  const handleNext = () => {
    if (!error && template) {
      setCurrentStep(6)
    }
  }

  const handleBack = () => {
    setCurrentStep(4)
  }

  return (
    <GlassCard>
      <div>
        {/* Title */}
        <h2 className="text-2xl font-bold text-white mb-2">
          Customize Event Titles
        </h2>
        <p className="text-white/80 mb-6">
          Choose how prayer events will appear in your calendar
        </p>

        {/* Template Selection */}
        <div className="space-y-2 mb-4">
          <p className="text-white/90 text-sm font-medium mb-3">
            Select a template:
          </p>
          <div className="space-y-2">
            {titleTemplates.map((option, index) => (
              <button
                key={index}
                onClick={() => {
                  setTemplate(option.template)
                  setIsCustom(false)
                }}
                className={`w-full p-3 rounded-lg text-left transition-all duration-200 ${
                  template === option.template && !isCustom
                    ? 'bg-islamic-green/30 border-2 border-islamic-green'
                    : 'glass hover:bg-white/10 border-2 border-transparent'
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="text-white/90">{option.template}</span>
                  <span className="text-white/60 text-sm">→ {option.preview}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Custom Template */}
        <div className="mt-4">
          <p className="text-white/90 text-sm font-medium mb-2">
            Or create your own:
          </p>
          <input
            type="text"
            value={isCustom ? template : ''}
            onChange={(e) => {
              setTemplate(e.target.value)
              setIsCustom(true)
            }}
            onFocus={() => {
              if (!isCustom) {
                setTemplate('{prayer} ')
                setIsCustom(true)
              }
            }}
            placeholder="Enter custom template with {prayer}"
            className="w-full glass-input text-white"
          />
          {error && isCustom && (
            <p className="text-red-400 text-sm mt-2">{error}</p>
          )}
        </div>

        {/* Preview */}
        <div className="mt-6 p-4 bg-white/10 rounded-lg">
          <p className="text-white/90 text-sm font-medium mb-3">
            Preview how your events will look:
          </p>
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="text-white/60">Fajr:</span>
              <span className="text-white font-medium">{getPreview('Fajr')}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-white/60">Dhuhr:</span>
              <span className="text-white font-medium">{getPreview('Dhuhr')}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-white/60">Maghrib:</span>
              <span className="text-white font-medium">{getPreview('Maghrib')}</span>
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="mt-6 p-4 bg-white/5 rounded-lg">
          <p className="text-white/70 text-sm">
            💡 The {'{prayer}'} placeholder will be replaced with the actual
            prayer name (Fajr, Dhuhr, Asr, Maghrib, Isha).
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
            disabled={!!error}
            className={`glass-button px-6 py-2 text-white ${
              !error
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