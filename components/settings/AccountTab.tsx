'use client'

import { signOut } from 'next-auth/react'
import { useState } from 'react'
import type { UserSettings } from '@/lib/types'

interface AccountTabProps {
  user?: {
    name?: string | null
    email?: string | null
    image?: string | null
  }
  settings: UserSettings
}

export function AccountTab({ user, settings }: AccountTabProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const handleSignOut = async () => {
    await signOut({ callbackUrl: '/signin' })
  }

  const handleDeleteAccount = async () => {
    // This would implement actual account deletion
    console.log('Delete account - not implemented')
    setShowDeleteConfirm(false)
  }

  const handleExportData = () => {
    // Create a data export
    const exportData = {
      user: {
        email: user?.email,
        name: user?.name,
      },
      settings: settings,
      exportDate: new Date().toISOString(),
    }

    // Create and download JSON file
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `prayer-times-settings-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Account Settings</h2>
        <p className="text-white/70">
          Manage your account and privacy preferences
        </p>
      </div>

      {/* Profile Information */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-3">Profile Information</h3>
        <div className="space-y-3">
          {user?.image && (
            <div className="flex items-center gap-4">
              <img
                src={user.image}
                alt="Profile"
                className="w-16 h-16 rounded-full"
              />
              <div>
                <p className="text-white font-medium">{user.name}</p>
                <p className="text-white/60 text-sm">{user.email}</p>
              </div>
            </div>
          )}

          {!user?.image && (
            <>
              <div>
                <p className="text-white/70 text-sm mb-1">Name</p>
                <p className="text-white">{user?.name || 'Not set'}</p>
              </div>

              <div>
                <p className="text-white/70 text-sm mb-1">Email</p>
                <p className="text-white">{user?.email}</p>
              </div>
            </>
          )}

          <div>
            <p className="text-white/70 text-sm mb-1">Account Type</p>
            <p className="text-white">Google Account</p>
          </div>
        </div>
      </div>

      {/* Data & Privacy */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-3">Data & Privacy</h3>

        <div className="space-y-4">
          <div className="p-4 bg-white/10 rounded-lg">
            <h4 className="text-white font-medium mb-2">Your Data</h4>
            <p className="text-white/70 text-sm mb-3">
              We only store your location, prayer preferences, and calendar settings.
              Prayer times are calculated on-demand and not stored.
            </p>
            <button
              onClick={handleExportData}
              className="glass-button px-4 py-2 text-sm text-white hover:bg-white/20"
            >
              📥 Export My Data
            </button>
          </div>

          <div className="p-4 bg-white/10 rounded-lg">
            <h4 className="text-white font-medium mb-2">Connected Services</h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">📅</span>
                  <span className="text-white">Google Calendar</span>
                </div>
                <span className="text-islamic-green text-sm">✓ Connected</span>
              </div>
              <p className="text-white/60 text-xs ml-7">
                Access granted to create and manage prayer time events
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Session Management */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-3">Session</h3>
        <button
          onClick={handleSignOut}
          className="glass-button px-6 py-2 text-white hover:bg-white/20"
        >
          Sign Out
        </button>
      </div>

      {/* Danger Zone */}
      <div className="border-t border-white/20 pt-6">
        <h3 className="text-lg font-semibold text-red-400 mb-3">Danger Zone</h3>

        {!showDeleteConfirm ? (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
            <h4 className="text-white font-medium mb-2">Delete Account</h4>
            <p className="text-white/70 text-sm mb-3">
              Permanently delete your account and all associated data. This action cannot be undone.
            </p>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
            >
              Delete My Account
            </button>
          </div>
        ) : (
          <div className="p-4 bg-red-500/20 border border-red-500/40 rounded-lg">
            <h4 className="text-white font-medium mb-2">⚠️ Are you absolutely sure?</h4>
            <p className="text-white/70 text-sm mb-4">
              This will permanently delete your account, remove all your settings,
              and disconnect from Google Calendar. This action cannot be reversed.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="glass-button px-4 py-2 text-white hover:bg-white/20"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                Yes, Delete My Account
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}