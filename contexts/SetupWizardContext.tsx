'use client'

import { createContext, useContext, useState, ReactNode } from 'react'
import { type City } from '@/lib/types'

interface SetupWizardData {
  // Step 2: Location
  city?: string
  country?: string
  latitude?: number
  longitude?: number

  // Step 3: Calculation Method
  calculationMethod?: number

  // Step 4: Reminders
  reminderMinutes?: number[]

  // Step 5: Event Title
  eventTitleTemplate?: string

  // Step 6: Auto-Delete
  autoDeleteEvents?: boolean
  deleteEventsAfter?: '30min' | 'end-of-day' | 'end-of-week' | 'end-of-month'

  // Step 7: Calendar
  targetCalendarId?: string

  // Step 8: Auto-Sync
  autoSync?: boolean
  syncFrequency?: 'daily' | 'weekly' | 'monthly'

  // Selected prayers (default all)
  selectedPrayers?: string[]
}

interface SetupWizardContextType {
  currentStep: number
  setCurrentStep: (step: number) => void
  data: SetupWizardData
  updateData: (updates: Partial<SetupWizardData>) => void
  nextStep: () => void
  prevStep: () => void
  canGoNext: boolean
  setCanGoNext: (can: boolean) => void
}

const SetupWizardContext = createContext<SetupWizardContextType | undefined>(undefined)

export function SetupWizardProvider({ children }: { children: ReactNode }) {
  const [currentStep, setCurrentStep] = useState(1)
  const [canGoNext, setCanGoNext] = useState(false)
  const [data, setData] = useState<SetupWizardData>({
    calculationMethod: 1,
    reminderMinutes: [30],
    eventTitleTemplate: '{prayer} Prayer',
    autoDeleteEvents: false,
    deleteEventsAfter: 'end-of-day',
    targetCalendarId: 'primary',
    autoSync: false,
    syncFrequency: 'daily',
    selectedPrayers: ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'],
  })

  const updateData = (updates: Partial<SetupWizardData>) => {
    setData(prev => ({ ...prev, ...updates }))
  }

  const nextStep = () => {
    if (currentStep < 8) {
      setCurrentStep(currentStep + 1)
      setCanGoNext(false) // Reset for next step
    }
  }

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
      setCanGoNext(true) // Previous steps are already completed
    }
  }

  return (
    <SetupWizardContext.Provider
      value={{
        currentStep,
        setCurrentStep,
        data,
        updateData,
        nextStep,
        prevStep,
        canGoNext,
        setCanGoNext,
      }}
    >
      {children}
    </SetupWizardContext.Provider>
  )
}

export function useSetupWizard() {
  const context = useContext(SetupWizardContext)
  if (!context) {
    throw new Error('useSetupWizard must be used within SetupWizardProvider')
  }
  return context
}