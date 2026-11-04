import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import { settingsSchema, partialSettingsSchema } from '@/lib/validations'

/**
 * GET /api/settings
 * Fetch user settings
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get user from database
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

    return NextResponse.json({
      success: true,
      data: user.settings,
    })

  } catch (error) {
    console.error('Settings GET error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/settings
 * Update user settings
 */
export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Parse and validate request body
    const body = await req.json()
    const validated = partialSettingsSchema.safeParse(body)

    if (!validated.success) {
      return NextResponse.json(
        { error: 'Invalid settings data', details: validated.error.errors },
        { status: 400 }
      )
    }

    // Update or create settings
    const settings = await prisma.settings.upsert({
      where: { userId: user.id },
      update: validated.data,
      create: {
        ...validated.data,
        userId: user.id,
        // Provide defaults for required fields if not in update
        city: validated.data.city || 'New York',
        country: validated.data.country || 'United States',
        latitude: validated.data.latitude || 40.7128,
        longitude: validated.data.longitude || -74.0060,
      } as any, // Type assertion needed due to Prisma types
    })

    return NextResponse.json({
      success: true,
      data: settings,
    })

  } catch (error) {
    console.error('Settings PUT error:', error)
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/settings
 * Delete all user data
 */
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Delete user and all related data (cascade delete)
    await prisma.user.delete({
      where: { email: session.user.email },
    })

    return NextResponse.json({
      success: true,
      message: 'All user data deleted successfully',
    })

  } catch (error) {
    console.error('Settings DELETE error:', error)
    return NextResponse.json(
      { error: 'Failed to delete user data' },
      { status: 500 }
    )
  }
}