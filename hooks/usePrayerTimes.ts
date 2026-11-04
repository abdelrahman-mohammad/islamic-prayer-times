import { useQuery } from '@tanstack/react-query'
import { type PrayerTimes } from '@/lib/types'

interface UsePrayerTimesOptions {
  latitude: number
  longitude: number
  method?: number
  date?: string
  enabled?: boolean
}

export function usePrayerTimes({
  latitude,
  longitude,
  method = 1,
  date,
  enabled = true,
}: UsePrayerTimesOptions) {
  return useQuery({
    queryKey: ['prayerTimes', latitude, longitude, method, date],
    queryFn: async () => {
      const params = new URLSearchParams({
        lat: latitude.toString(),
        lon: longitude.toString(),
        method: method.toString(),
        ...(date && { date }),
      })

      const response = await fetch(`/api/prayers/times?${params}`)

      if (!response.ok) {
        throw new Error('Failed to fetch prayer times')
      }

      const data = await response.json()
      return data.data as {
        timings: PrayerTimes
        date: any
      }
    },
    enabled: enabled && !!latitude && !!longitude,
    staleTime: 1000 * 60 * 60, // 1 hour
    gcTime: 1000 * 60 * 60 * 24, // 24 hours
  })
}