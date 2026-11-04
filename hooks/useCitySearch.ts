import { useState, useCallback, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { type City } from '@/lib/types'

export function useCitySearch(initialQuery: string = '') {
  const [query, setQuery] = useState(initialQuery)
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery)

  // Debounce the query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query)
    }, 300)

    return () => clearTimeout(timer)
  }, [query])

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['citySearch', debouncedQuery],
    queryFn: async () => {
      if (debouncedQuery.length < 2) {
        return []
      }

      const response = await fetch(
        `/api/cities/search?q=${encodeURIComponent(debouncedQuery)}`
      )

      if (!response.ok) {
        throw new Error('Failed to search cities')
      }

      const result = await response.json()
      return result.data as City[]
    },
    enabled: debouncedQuery.length >= 2,
    staleTime: 1000 * 60 * 5, // 5 minutes
  })

  const search = useCallback((newQuery: string) => {
    setQuery(newQuery)
  }, [])

  return {
    query,
    setQuery: search,
    cities: data || [],
    isLoading,
    error,
    refetch,
  }
}