import { cn } from '@/lib/utils'

interface SetupProgressProps {
  currentStep: number
  totalSteps: number
}

export function SetupProgress({ currentStep, totalSteps }: SetupProgressProps) {
  const progress = (currentStep / totalSteps) * 100

  return (
    <div className="glass-card">
      {/* Step Indicators */}
      <div className="flex justify-between mb-4">
        {Array.from({ length: totalSteps }, (_, i) => {
          const stepNumber = i + 1
          const isActive = stepNumber === currentStep
          const isCompleted = stepNumber < currentStep

          return (
            <div
              key={stepNumber}
              className="flex flex-col items-center flex-1"
            >
              <div
                className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300',
                  isActive && 'bg-islamic-green text-white shadow-lg scale-110',
                  isCompleted && 'bg-islamic-green/80 text-white',
                  !isActive && !isCompleted && 'bg-white/20 text-white/60'
                )}
              >
                {isCompleted ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : (
                  stepNumber
                )}
              </div>
              <span className="text-xs text-white/70 mt-1">
                {getStepLabel(stepNumber)}
              </span>
            </div>
          )
        })}
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-white/20 rounded-full h-2 overflow-hidden">
        <div
          className="bg-islamic-green h-full transition-all duration-500 ease-out rounded-full"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Step Title */}
      <div className="text-center mt-4">
        <h2 className="text-xl font-semibold text-white">
          Step {currentStep} of {totalSteps}
        </h2>
        <p className="text-white/70 text-sm mt-1">
          {getStepDescription(currentStep)}
        </p>
      </div>
    </div>
  )
}

function getStepLabel(step: number): string {
  const labels: Record<number, string> = {
    1: 'Welcome',
    2: 'Location',
    3: 'Method',
    4: 'Reminders',
    5: 'Title',
    6: 'Cleanup',
    7: 'Calendar',
    8: 'Review',
  }
  return labels[step] || ''
}

function getStepDescription(step: number): string {
  const descriptions: Record<number, string> = {
    1: 'Get started with Prayer Times Calendar',
    2: 'Set your location for accurate prayer times',
    3: 'Choose calculation method',
    4: 'Configure prayer reminders',
    5: 'Customize event titles',
    6: 'Set up automatic cleanup',
    7: 'Select your calendar',
    8: 'Review and sync',
  }
  return descriptions[step] || ''
}