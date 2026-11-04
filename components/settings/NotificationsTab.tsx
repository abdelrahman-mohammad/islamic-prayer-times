'use client'

import { useState } from 'react'
import type { UserSettings } from '@/lib/types'

interface NotificationsTabProps {
  settings: UserSettings
  onSave: (settings: Partial<UserSettings>) => void
}

export function NotificationsTab({ settings, onSave }: NotificationsTabProps) {
  const [emailNotifications, setEmailNotifications] = useState(false)
  const [syncStatusEmails, setSyncStatusEmails] = useState(false)
  const [errorAlertEmails, setErrorAlertEmails] = useState(false)
  const [weeklyReportEmails, setWeeklyReportEmails] = useState(false)

  const handleSave = () => {
    // These would be saved to additional notification preferences
    // For now, we'll just show the UI
    console.log({
      emailNotifications,
      syncStatusEmails,
      errorAlertEmails,
      weeklyReportEmails,
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Notification Settings</h2>
        <p className="text-white/70">
          Configure how you want to be notified about prayer times and sync status
        </p>
      </div>

      {/* Google Calendar Reminders */}
      <div className="p-4 bg-white/10 rounded-lg">
        <h3 className="text-lg font-semibold text-white mb-2">
          📅 Google Calendar Reminders
        </h3>
        <p className="text-white/70 text-sm mb-3">
          You currently have {settings.reminderMinutes?.length || 0} reminders set for each prayer
        </p>
        <div className="flex flex-wrap gap-2">
          {settings.reminderMinutes?.map((minutes) => (
            <span
              key={minutes}
              className="px-3 py-1 bg-islamic-green/20 text-white rounded-full text-sm"
            >
              {minutes} minutes before
            </span>
          ))}
        </div>
        <p className="text-white/50 text-xs mt-3">
          * Configure reminders in the Prayer Settings tab
        </p>
      </div>

      {/* Email Notifications */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-4">
          📧 Email Notifications
        </h3>

        <div className="space-y-3">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={emailNotifications}
              onChange={(e) => setEmailNotifications(e.target.checked)}
              className="mt-1"
            />
            <div>
              <p className="text-white font-medium">Enable Email Notifications</p>
              <p className="text-white/60 text-sm">
                Receive important updates about your prayer times sync
              </p>
            </div>
          </label>

          {emailNotifications && (
            <div className="ml-8 space-y-3 pt-2">
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={syncStatusEmails}
                  onChange={(e) => setSyncStatusEmails(e.target.checked)}
                />
                <div>
                  <p className="text-white">Sync Status Updates</p>
                  <p className="text-white/60 text-sm">
                    Get notified when prayer times are synced to your calendar
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={errorAlertEmails}
                  onChange={(e) => setErrorAlertEmails(e.target.checked)}
                />
                <div>
                  <p className="text-white">Error Alerts</p>
                  <p className="text-white/60 text-sm">
                    Receive alerts if sync fails or calendar access is lost
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={weeklyReportEmails}
                  onChange={(e) => setWeeklyReportEmails(e.target.checked)}
                />
                <div>
                  <p className="text-white">Weekly Reports</p>
                  <p className="text-white/60 text-sm">
                    Get a weekly summary of your prayer times and sync activity
                  </p>
                </div>
              </label>
            </div>
          )}
        </div>
      </div>

      {/* Sync Status Indicators */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-4">
          🔄 Sync Status
        </h3>

        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 bg-white/10 rounded-lg">
            <p className="text-white/70 text-sm mb-1">Auto-sync</p>
            <p className="text-white font-medium">
              {settings.autoSync ? (
                <span className="text-islamic-green">✓ Enabled</span>
              ) : (
                <span className="text-white/50">✗ Disabled</span>
              )}
            </p>
          </div>

          <div className="p-3 bg-white/10 rounded-lg">
            <p className="text-white/70 text-sm mb-1">Frequency</p>
            <p className="text-white font-medium capitalize">
              {settings.syncFrequency || 'Not set'}
            </p>
          </div>

          <div className="p-3 bg-white/10 rounded-lg">
            <p className="text-white/70 text-sm mb-1">Auto-delete</p>
            <p className="text-white font-medium">
              {settings.autoDeleteEvents ? (
                <span className="text-islamic-green">✓ Enabled</span>
              ) : (
                <span className="text-white/50">✗ Disabled</span>
              )}
            </p>
          </div>

          <div className="p-3 bg-white/10 rounded-lg">
            <p className="text-white/70 text-sm mb-1">Delete after</p>
            <p className="text-white font-medium">
              {settings.deleteEventsAfter?.replace('-', ' ').replace('min', ' minutes') || 'Not set'}
            </p>
          </div>
        </div>
      </div>

      {/* Test Notification */}
      <div className="border-t border-white/20 pt-6">
        <h3 className="text-lg font-semibold text-white mb-3">
          Test Notifications
        </h3>
        <p className="text-white/70 text-sm mb-4">
          Send a test notification to verify your settings are working correctly
        </p>
        <button
          className="glass-button px-4 py-2 text-white hover:bg-white/20"
          onClick={() => {
            // Mock test notification
            alert('Test notification sent! (Mock - not implemented)')
          }}
        >
          Send Test Notification
        </button>
      </div>

      {/* Actions */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          className="glass-button px-6 py-2 bg-islamic-green/20 text-white hover:bg-islamic-green/30"
        >
          Save Notification Settings
        </button>
      </div>
    </div>
  )
}