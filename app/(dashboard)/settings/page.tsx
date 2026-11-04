'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { GlassCard } from '@/components/ui/GlassCard'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { LocationTab } from '@/components/settings/LocationTab'
import { PrayerSettingsTab } from '@/components/settings/PrayerSettingsTab'
import { CalendarTab } from '@/components/settings/CalendarTab'
import { NotificationsTab } from '@/components/settings/NotificationsTab'
import { AccountTab } from '@/components/settings/AccountTab'
import type { UserSettings } from '@/lib/types'

const tabs = [
  { id: 'location', label: 'Location', icon: '📍' },
  { id: 'prayers', label: 'Prayer Settings', icon: '🕌' },
  { id: 'calendar', label: 'Calendar', icon: '📅' },
  { id: 'notifications', label: 'Notifications', icon: '🔔' },
  { id: 'account', label: 'Account', icon: '👤' },
] as const

type TabId = typeof tabs[number]['id']

export default function SettingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<TabId>('location')
  const [isSaving, setIsSaving] = useState(false)

  // Fetch settings
  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const response = await fetch('/api/settings')
      if (!response.ok) {
        throw new Error('Failed to fetch settings')
      }
      const result = await response.json()
      return result.data as UserSettings
    },
    enabled: status === 'authenticated',
  })

  // Save settings mutation
  const saveSettingsMutation = useMutation({
    mutationFn: async (updatedSettings: Partial<UserSettings>) => {
      setIsSaving(true)
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedSettings),
      })

      if (!response.ok) {
        throw new Error('Failed to save settings')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      setIsSaving(false)
    },
    onError: (error) => {
      console.error('Error saving settings:', error)
      setIsSaving(false)
    },
  })

  const handleSaveSettings = (updatedSettings: Partial<UserSettings>) => {
    saveSettingsMutation.mutate(updatedSettings)
  }

  if (status === 'loading' || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (status === 'unauthenticated') {
    router.push('/signin')
    return null
  }

  if (!settings) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <GlassCard>
          <p className="text-white">Failed to load settings</p>
        </GlassCard>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white mb-2">Settings</h1>
        <p className="text-white/80">
          Manage your prayer times and calendar preferences
        </p>
      </div>

      <div className="grid lg:grid-cols-4 gap-8">
        {/* Tabs Navigation */}
        <div className="lg:col-span-1">
          <GlassCard className="p-2">
            <nav className="space-y-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                    activeTab === tab.id
                      ? 'bg-white/20 text-white'
                      : 'text-white/70 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <span className="text-xl">{tab.icon}</span>
                  <span className="font-medium">{tab.label}</span>
                </button>
              ))}
            </nav>
          </GlassCard>
        </div>

        {/* Tab Content */}
        <div className="lg:col-span-3">
          <GlassCard className="min-h-[500px]">
            {isSaving && (
              <div className="absolute inset-0 bg-black/20 backdrop-blur-sm rounded-2xl flex items-center justify-center z-10">
                <div className="flex items-center gap-3 text-white">
                  <LoadingSpinner size="sm" />
                  <span>Saving...</span>
                </div>
              </div>
            )}

            {activeTab === 'location' && (
              <LocationTab
                settings={settings}
                onSave={handleSaveSettings}
              />
            )}

            {activeTab === 'prayers' && (
              <PrayerSettingsTab
                settings={settings}
                onSave={handleSaveSettings}
              />
            )}

            {activeTab === 'calendar' && (
              <CalendarTab
                settings={settings}
                onSave={handleSaveSettings}
              />
            )}

            {activeTab === 'notifications' && (
              <NotificationsTab
                settings={settings}
                onSave={handleSaveSettings}
              />
            )}

            {activeTab === 'account' && (
              <AccountTab
                user={session?.user}
                settings={settings}
              />
            )}
          </GlassCard>
        </div>
      </div>
    </div>
  )
}