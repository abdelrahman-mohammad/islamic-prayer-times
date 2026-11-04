import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { google } from 'googleapis'
import { prisma } from '@/lib/prisma'
import { syncPrayerTimesForDate } from '@/lib/calendar-sync'
import { syncRequestSchema } from '@/lib/validations'

/**
 * POST /api/calendar/sync
 * Manually sync prayer times to Google Calendar
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get user and settings from database
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { settings: true },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    if (!user.settings) {
      return NextResponse.json(
        { error: 'Please complete setup first' },
        { status: 400 }
      )
    }

    // Parse request body
    const body = await req.json()
    const { date, force } = syncRequestSchema.parse(body)

    // Create Google Calendar client
    // Note: In production, you'll need to get the access token from the session
    // or store it securely in the database
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.NEXTAUTH_URL}/api/auth/callback/google`
    )

    // TODO: Get actual access token from session or database
    // For now, we'll return a mock success response
    // In production, you'd set the credentials like:
    // oauth2Client.setCredentials({
    //   access_token: session.accessToken,
    //   refresh_token: session.refreshToken,
    // })

    // Mock implementation for development
    const mockResponse = {
      success: true,
      message: 'Prayer times synced successfully (mock)',
      eventsCreated: 5,
      eventsUpdated: 0,
      eventsSkipped: 0,
    }

    // Log the sync operation
    await prisma.syncLog.create({
      data: {
        userId: user.id,
        status: 'success',
        eventsCreated: mockResponse.eventsCreated,
        eventsDeleted: 0,
      },
    })

    return NextResponse.json(mockResponse)

    /* Production implementation:

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client })

    // Fetch prayer times from Aladhan API
    const prayerTimesResponse = await fetch(
      `http://api.aladhan.com/v1/timings/${Date.now()}?latitude=${user.settings.latitude}&longitude=${user.settings.longitude}&method=${user.settings.calculationMethod}`
    )

    if (!prayerTimesResponse.ok) {
      throw new Error('Failed to fetch prayer times')
    }

    const prayerData = await prayerTimesResponse.json()
    const prayerTimes = prayerData.data.timings

    // Sync prayer times
    const syncDate = date ? new Date(date) : new Date()
    const results = await syncPrayerTimesForDate(
      calendar,
      user.settings,
      prayerTimes,
      syncDate
    )

    // Log the sync operation
    await prisma.syncLog.create({
      data: {
        userId: user.id,
        status: 'success',
        eventsCreated: results.created,
        eventsDeleted: 0,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Prayer times synced successfully',
      ...results,
    })
    */

  } catch (error) {
    console.error('Sync error:', error)

    // Try to log the error
    try {
      const session = await getServerSession(authOptions)
      if (session?.user?.email) {
        const user = await prisma.user.findUnique({
          where: { email: session.user.email },
        })

        if (user) {
          await prisma.syncLog.create({
            data: {
              userId: user.id,
              status: 'failure',
              eventsCreated: 0,
              eventsDeleted: 0,
              errorMessage: error instanceof Error ? error.message : 'Unknown error',
            },
          })
        }
      }
    } catch (logError) {
      console.error('Failed to log error:', logError)
    }

    return NextResponse.json(
      {
        error: 'Failed to sync prayer times',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}