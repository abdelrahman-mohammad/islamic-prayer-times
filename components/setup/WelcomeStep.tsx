'use client'

import { useSetupWizard } from '@/contexts/SetupWizardContext'
import { GlassCard } from '@/components/ui/GlassCard'

interface StepProps {
  currentStep: number
  setCurrentStep: (step: number) => void
  steps: any[]
}

export function WelcomeStep({ setCurrentStep }: StepProps) {
  const { nextStep } = useSetupWizard()

  const handleNext = () => {
    setCurrentStep(2)
  }

  return (
    <GlassCard>
      <div className="text-center">
        {/* Icon */}
        <div className="text-6xl mb-6">🕌</div>

        {/* Title */}
        <h1 className="text-3xl font-bold text-white mb-4">
          Welcome to Prayer Times Calendar
        </h1>

        {/* Description */}
        <p className="text-white/90 mb-8 max-w-md mx-auto">
          Let's set up your prayer times in just a few simple steps.
          This will only take about 2 minutes.
        </p>

        {/* What we'll set up */}
        <div className="bg-white/10 rounded-lg p-6 mb-8 text-left">
          <h3 className="text-white font-semibold mb-4">We'll help you:</h3>
          <ul className="space-y-3 text-white/80">
            <li className="flex items-start gap-2">
              <span className="text-islamic-gold mt-1">✓</span>
              <span>Set your location for accurate prayer times</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-islamic-gold mt-1">✓</span>
              <span>Choose your preferred calculation method</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-islamic-gold mt-1">✓</span>
              <span>Configure reminders to never miss a prayer</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-islamic-gold mt-1">✓</span>
              <span>Customize how events appear in your calendar</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-islamic-gold mt-1">✓</span>
              <span>Set up automatic sync to keep everything updated</span>
            </li>
          </ul>
        </div>

        {/* Privacy Notice */}
        <p className="text-white/60 text-sm mb-6">
          Your privacy is important to us. We only store your settings
          and never share your data with third parties.
        </p>

        {/* Get Started Button */}
        <button
          onClick={handleNext}
          className="glass-button px-8 py-3 text-white font-semibold hover:bg-white/25 transition-all duration-300"
        >
          Let's Get Started →
        </button>
      </div>
    </GlassCard>
  )
}