'use client'

import { useState, useCallback } from 'react'
import { debounce } from '@/lib/utils'
import type { UserSettings, City } from '@/lib/types'

interface LocationTabProps {
  settings: UserSettings
  onSave: (settings: Partial<UserSettings>) => void
}

export function LocationTab({ settings, onSave }: LocationTabProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<City[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [selectedCity, setSelectedCity] = useState<City | null>(null)

  // Debounced search function
  const searchCities = useCallback(
    debounce(async (query: string) => {
      if (!query || query.length < 2) {
        setSearchResults([])
        return
      }

      setIsSearching(true)
      try {
        const response = await fetch(`/api/cities/search?q=${encodeURIComponent(query)}`)
        if (response.ok) {
          const data = await response.json()
          setSearchResults(data.data || [])
        }
      } catch (error) {
        console.error('City search error:', error)
        setSearchResults([])
      } finally {
        setIsSearching(false)
      }
    }, 500),
    []
  )

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value
    setSearchQuery(query)
    searchCities(query)
  }

  const handleCitySelect = (city: City) => {
    setSelectedCity(city)
    setSearchQuery(`${city.name}, ${city.country}`)
    setSearchResults([])
  }

  const handleSave = () => {
    if (selectedCity) {
      onSave({
        city: selectedCity.name,
        country: selectedCity.country,
        latitude: selectedCity.latitude,
        longitude: selectedCity.longitude,
        timezone: selectedCity.timezone,
      })
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Location Settings</h2>
        <p className="text-white/70">
          Set your location for accurate prayer time calculations
        </p>
      </div>

      {/* Current Location */}
      <div className="p-4 bg-white/10 rounded-lg">
        <p className="text-sm text-white/70 mb-2">Current Location</p>
        <p className="text-white font-medium">
          {settings.city}, {settings.country}
        </p>
        <p className="text-white/60 text-sm mt-1">
          Coordinates: {settings.latitude.toFixed(4)}°, {settings.longitude.toFixed(4)}°
        </p>
        {settings.timezone && (
          <p className="text-white/60 text-sm">
            Timezone: {settings.timezone}
          </p>
        )}
      </div>

      {/* Location Search */}
      <div>
        <label className="block text-white font-medium mb-2">
          Search for a new location
        </label>
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder="Enter city name..."
            className="w-full glass-input text-white"
          />

          {/* Search Results Dropdown */}
          {searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 max-h-60 overflow-y-auto glass rounded-lg p-2 z-10">
              {searchResults.map((city) => (
                <button
                  key={`${city.latitude}-${city.longitude}`}
                  onClick={() => handleCitySelect(city)}
                  className="w-full text-left px-4 py-3 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <p className="text-white font-medium">
                    {city.name}, {city.state && `${city.state}, `}{city.country}
                  </p>
                  <p className="text-white/60 text-sm">
                    Lat: {city.latitude.toFixed(4)}°, Lon: {city.longitude.toFixed(4)}°
                  </p>
                </button>
              ))}
            </div>
          )}

          {/* Loading indicator */}
          {isSearching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/20 border-t-white" />
            </div>
          )}
        </div>

        {searchQuery && !isSearching && searchResults.length === 0 && searchQuery.length > 2 && (
          <p className="text-white/60 text-sm mt-2">
            No results found for "{searchQuery}"
          </p>
        )}
      </div>

      {/* Selected City Preview */}
      {selectedCity && (
        <div className="p-4 bg-islamic-green/20 rounded-lg border border-islamic-green/30">
          <p className="text-sm text-islamic-green mb-2">New Location Selected</p>
          <p className="text-white font-medium">
            {selectedCity.name}, {selectedCity.country}
          </p>
          <p className="text-white/60 text-sm mt-1">
            Coordinates: {selectedCity.latitude.toFixed(4)}°, {selectedCity.longitude.toFixed(4)}°
          </p>
          {selectedCity.timezone && (
            <p className="text-white/60 text-sm">
              Timezone: {selectedCity.timezone}
            </p>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3">
        {selectedCity && (
          <>
            <button
              onClick={() => {
                setSelectedCity(null)
                setSearchQuery('')
              }}
              className="glass-button px-6 py-2 text-white hover:bg-white/20"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="glass-button px-6 py-2 bg-islamic-green/20 text-white hover:bg-islamic-green/30"
            >
              Save Location
            </button>
          </>
        )}
      </div>
    </div>
  )
}