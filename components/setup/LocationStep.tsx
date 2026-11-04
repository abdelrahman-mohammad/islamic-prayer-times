'use client'

import { useState, useEffect } from 'react'
import { useSetupWizard } from '@/contexts/SetupWizardContext'
import { useCitySearch } from '@/hooks/useCitySearch'
import { GlassCard } from '@/components/ui/GlassCard'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { type City } from '@/lib/types'

interface StepProps {
  currentStep: number
  setCurrentStep: (step: number) => void
  steps: any[]
}

export function LocationStep({ setCurrentStep }: StepProps) {
  const { data, updateData, setCanGoNext } = useSetupWizard()
  const { query, setQuery, cities, isLoading } = useCitySearch()
  const [selectedCity, setSelectedCity] = useState<City | null>(null)
  const [showResults, setShowResults] = useState(false)

  useEffect(() => {
    setCanGoNext(!!selectedCity)
  }, [selectedCity, setCanGoNext])

  const handleCitySelect = (city: City) => {
    setSelectedCity(city)
    updateData({
      city: city.city,
      country: city.country,
      latitude: city.latitude,
      longitude: city.longitude,
    })
    setShowResults(false)
    setQuery('')
  }

  const handleNext = () => {
    if (selectedCity) {
      setCurrentStep(3)
    }
  }

  const handleBack = () => {
    setCurrentStep(1)
  }

  return (
    <GlassCard>
      <div>
        {/* Title */}
        <h2 className="text-2xl font-bold text-white mb-2">
          Set Your Location
        </h2>
        <p className="text-white/80 mb-6">
          Search for your city to get accurate prayer times for your area
        </p>

        {/* Selected City Display */}
        {selectedCity && (
          <div className="bg-islamic-green/20 rounded-lg p-4 mb-6 border border-islamic-green/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white font-semibold text-lg">
                  {selectedCity.city}, {selectedCity.country}
                </p>
                <p className="text-white/70 text-sm">
                  Lat: {selectedCity.latitude.toFixed(4)},
                  Lon: {selectedCity.longitude.toFixed(4)}
                </p>
              </div>
              <button
                onClick={() => {
                  setSelectedCity(null)
                  setCanGoNext(false)
                }}
                className="text-white/60 hover:text-white transition-colors"
              >
                Change
              </button>
            </div>
          </div>
        )}

        {/* City Search */}
        {!selectedCity && (
          <div className="relative">
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setShowResults(true)
              }}
              onFocus={() => setShowResults(true)}
              placeholder="Start typing your city name..."
              className="w-full glass-input text-white"
              autoFocus
            />

            {/* Search icon */}
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50">
              {isLoading ? (
                <LoadingSpinner size="sm" />
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              )}
            </div>

            {/* Search Results */}
            {showResults && cities.length > 0 && (
              <div className="absolute top-full mt-2 w-full max-h-64 overflow-y-auto glass rounded-lg border border-white/20 z-10">
                {cities.map((city, index) => (
                  <button
                    key={index}
                    onClick={() => handleCitySelect(city)}
                    className="w-full px-4 py-3 text-left hover:bg-white/10 transition-colors border-b border-white/10 last:border-0"
                  >
                    <p className="text-white font-medium">
                      {city.city}
                    </p>
                    <p className="text-white/60 text-sm">
                      {city.country}
                      {city.population && ` • Population: ${city.population.toLocaleString()}`}
                    </p>
                  </button>
                ))}
              </div>
            )}

            {/* No results message */}
            {showResults && query.length >= 2 && cities.length === 0 && !isLoading && (
              <div className="absolute top-full mt-2 w-full glass rounded-lg p-4">
                <p className="text-white/60 text-center">
                  No cities found. Try a different search term.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Info */}
        <div className="mt-6 p-4 bg-white/5 rounded-lg">
          <p className="text-white/70 text-sm">
            💡 Tip: Start typing at least 2 characters to search for cities.
            Select your city from the dropdown for the most accurate prayer times.
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
            disabled={!selectedCity}
            className={`glass-button px-6 py-2 text-white ${
              selectedCity
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