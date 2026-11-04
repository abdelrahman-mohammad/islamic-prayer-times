'use client'

import { useState, useEffect } from 'react'
import { useSetupWizard } from '@/contexts/SetupWizardContext'
import { GlassCard } from '@/components/ui/GlassCard'
import { getCalculationMethodName } from '@/lib/utils'

interface StepProps {
  currentStep: number
  setCurrentStep: (step: number) => void
  steps: any[]
}

const methods = [
  {
    id: 1,
    name: 'ISNA',
    full: 'Islamic Society of North America',
    description: 'Used in North America, parts of Europe',
    fajr: '15°',
    isha: '15°',
  },
  {
    id: 2,
    name: 'MWL',
    full: 'Muslim World League',
    description: 'Standard for Europe, Far East, parts of America',
    fajr: '18°',
    isha: '17°',
  },
  {
    id: 3,
    name: 'Umm Al-Qura',
    full: 'Umm Al-Qura University, Makkah',
    description: 'Used in Saudi Arabia and Gulf region',
    fajr: '18.5°',
    isha: '90 min after Maghrib',
  },
  {
    id: 4,
    name: 'Egyptian',
    full: 'Egyptian General Authority of Survey',
    description: 'Used in Egypt, Lebanon, Syria',
    fajr: '19.5°',
    isha: '17.5°',
  },
  {
    id: 5,
    name: 'Karachi',
    full: 'University of Islamic Sciences, Karachi',
    description: 'Used in Pakistan, India, Bangladesh',
    fajr: '18°',
    isha: '18°',
  },
]

export function MethodStep({ setCurrentStep }: StepProps) {
  const { data, updateData } = useSetupWizard()
  const [selectedMethod, setSelectedMethod] = useState(data.calculationMethod || 1)

  useEffect(() => {
    updateData({ calculationMethod: selectedMethod })
  }, [selectedMethod, updateData])

  const handleNext = () => {
    setCurrentStep(4)
  }

  const handleBack = () => {
    setCurrentStep(2)
  }

  return (
    <GlassCard>
      <div>
        {/* Title */}
        <h2 className="text-2xl font-bold text-white mb-2">
          Choose Calculation Method
        </h2>
        <p className="text-white/80 mb-6">
          Select the method that matches your location or preference
        </p>

        {/* Method Selection */}
        <div className="space-y-3">
          {methods.map((method) => (
            <button
              key={method.id}
              onClick={() => setSelectedMethod(method.id)}
              className={`w-full text-left p-4 rounded-lg transition-all duration-200 ${
                selectedMethod === method.id
                  ? 'bg-islamic-green/30 border-2 border-islamic-green'
                  : 'glass hover:bg-white/10 border-2 border-transparent'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-white font-semibold text-lg">
                    {method.name}
                  </h3>
                  <p className="text-white/90 text-sm mt-1">
                    {method.full}
                  </p>
                  <p className="text-white/70 text-xs mt-2">
                    {method.description}
                  </p>
                  <div className="flex gap-4 mt-2">
                    <span className="text-white/60 text-xs">
                      Fajr: {method.fajr}
                    </span>
                    <span className="text-white/60 text-xs">
                      Isha: {method.isha}
                    </span>
                  </div>
                </div>
                <div className="ml-4">
                  <div
                    className={`w-5 h-5 rounded-full border-2 transition-all ${
                      selectedMethod === method.id
                        ? 'border-white bg-white'
                        : 'border-white/50'
                    }`}
                  >
                    {selectedMethod === method.id && (
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="w-2 h-2 bg-islamic-green rounded-full" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Info */}
        <div className="mt-6 p-4 bg-white/5 rounded-lg">
          <p className="text-white/70 text-sm">
            💡 Not sure which to choose? ISNA is commonly used in North America,
            while MWL is widely accepted internationally.
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