'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { SetupWizardProvider } from '@/contexts/SetupWizardContext'
import { WelcomeStep } from '@/components/setup/WelcomeStep'
import { LocationStep } from '@/components/setup/LocationStep'
import { MethodStep } from '@/components/setup/MethodStep'
import { RemindersStep } from '@/components/setup/RemindersStep'
import { EventTitleStep } from '@/components/setup/EventTitleStep'
import { AutoDeleteStep } from '@/components/setup/AutoDeleteStep'
import { CalendarStep } from '@/components/setup/CalendarStep'
import { ReviewStep } from '@/components/setup/ReviewStep'
import { SetupProgress } from '@/components/setup/SetupProgress'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'

const steps = [
  { id: 1, title: 'Welcome', component: WelcomeStep },
  { id: 2, title: 'Location', component: LocationStep },
  { id: 3, title: 'Method', component: MethodStep },
  { id: 4, title: 'Reminders', component: RemindersStep },
  { id: 5, title: 'Event Title', component: EventTitleStep },
  { id: 6, title: 'Auto-Delete', component: AutoDeleteStep },
  { id: 7, title: 'Calendar', component: CalendarStep },
  { id: 8, title: 'Review', component: ReviewStep },
]

export default function SetupPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  // Redirect if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/signin')
    }
  }, [status, router])

  if (!isClient || status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (status === 'unauthenticated') {
    return null
  }

  return (
    <SetupWizardProvider>
      <SetupContent />
    </SetupWizardProvider>
  )
}

function SetupContent() {
  const [currentStep, setCurrentStep] = useState(1)
  const CurrentStepComponent = steps.find(s => s.id === currentStep)?.component || WelcomeStep

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-2xl">
        {/* Progress Indicator */}
        <SetupProgress currentStep={currentStep} totalSteps={steps.length} />

        {/* Step Content */}
        <div className="mt-8">
          <CurrentStepComponent
            currentStep={currentStep}
            setCurrentStep={setCurrentStep}
            steps={steps}
          />
        </div>
      </div>
    </div>
  )
}