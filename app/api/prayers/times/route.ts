import { NextRequest, NextResponse } from 'next/server'
import { prayerTimesQuerySchema } from '@/lib/validations'
import { type PrayerTimesApiResponse } from '@/lib/types'

/**
 * GET /api/prayers/times
 * Fetch prayer times from Aladhan API
 */
export async function GET(req: NextRequest) {
  try {
    // Parse and validate query parameters
    const searchParams = Object.fromEntries(req.nextUrl.searchParams)
    const validatedParams = prayerTimesQuerySchema.safeParse(searchParams)

    if (!validatedParams.success) {
      return NextResponse.json(
        { error: 'Invalid parameters', details: validatedParams.error.errors },
        { status: 400 }
      )
    }

    const { lat, lon, method, date } = validatedParams.data

    // Construct Aladhan API URL
    const dateParam = date || new Date().getTime() / 1000 // Unix timestamp if no date provided
    const url = `http://api.aladhan.com/v1/timings/${dateParam}?latitude=${lat}&longitude=${lon}&method=${method}`

    // Fetch from Aladhan API
    const response = await fetch(url, {
      next: { revalidate: 3600 }, // Cache for 1 hour
    })

    if (!response.ok) {
      throw new Error(`Aladhan API error: ${response.status}`)
    }

    const data: PrayerTimesApiResponse = await response.json()

    if (data.code !== 200) {
      throw new Error('Failed to fetch prayer times')
    }

    // Return prayer times data
    return NextResponse.json({
      success: true,
      data: {
        timings: data.data.timings,
        date: data.data.date,
      },
    })

  } catch (error) {
    console.error('Prayer times API error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch prayer times',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}