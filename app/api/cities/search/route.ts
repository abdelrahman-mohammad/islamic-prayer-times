import { NextRequest, NextResponse } from 'next/server'
import { citySearchQuerySchema } from '@/lib/validations'
import { type City, type GeoapifyResponse } from '@/lib/types'

/**
 * GET /api/cities/search
 * Search for cities using Geoapify API
 */
export async function GET(req: NextRequest) {
  try {
    // Check if Geoapify API key is configured
    if (!process.env.GEOAPIFY_API_KEY) {
      return NextResponse.json(
        { error: 'Geoapify API key not configured' },
        { status: 500 }
      )
    }

    // Parse and validate query parameters
    const query = req.nextUrl.searchParams.get('q')
    const validated = citySearchQuerySchema.safeParse({ q: query })

    if (!validated.success) {
      return NextResponse.json(
        { error: 'Invalid query', details: validated.error.errors },
        { status: 400 }
      )
    }

    // Construct Geoapify API URL
    const url = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(
      validated.data.q
    )}&type=city&limit=10&apiKey=${process.env.GEOAPIFY_API_KEY}`

    // Fetch from Geoapify API
    const response = await fetch(url, {
      next: { revalidate: 300 }, // Cache for 5 minutes
    })

    if (!response.ok) {
      throw new Error(`Geoapify API error: ${response.status}`)
    }

    const data: GeoapifyResponse = await response.json()

    // Transform Geoapify response to our City format
    const cities: City[] = data.features
      .filter((feature) => feature.properties.city) // Only include results with city names
      .map((feature) => ({
        city: feature.properties.city || '',
        country: feature.properties.country || '',
        latitude: feature.properties.lat,
        longitude: feature.properties.lon,
        population: feature.properties.population,
      }))
      // Sort by population (if available) for better results
      .sort((a, b) => (b.population || 0) - (a.population || 0))

    return NextResponse.json({
      success: true,
      data: cities,
    })

  } catch (error) {
    console.error('City search API error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to search cities',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}