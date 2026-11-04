import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { type UserSettings } from '@/lib/types'

export function useSettings() {
  const queryClient = useQueryClient()

  // Fetch settings
  const {
    data: settings,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const response = await fetch('/api/settings')

      if (!response.ok) {
        if (response.status === 404) {
          return null // No settings yet
        }
        throw new Error('Failed to fetch settings')
      }

      const result = await response.json()
      return result.data as UserSettings
    },
  })

  // Update settings mutation
  const updateSettings = useMutation({
    mutationFn: async (updates: Partial<UserSettings>) => {
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update settings')
      }

      const result = await response.json()
      return result.data as UserSettings
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['settings'], data)
      queryClient.invalidateQueries({ queryKey: ['settings'] })
    },
  })

  // Delete all data mutation
  const deleteAllData = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/settings', {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete user data')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.clear()
      // Redirect to home or handle logout
      window.location.href = '/'
    },
  })

  return {
    settings,
    isLoading,
    error,
    updateSettings: updateSettings.mutate,
    isUpdating: updateSettings.isPending,
    updateError: updateSettings.error,
    deleteAllData: deleteAllData.mutate,
    isDeleting: deleteAllData.isPending,
  }
}