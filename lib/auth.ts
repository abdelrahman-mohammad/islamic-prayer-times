import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { redirect } from 'next/navigation'

/**
 * Get the current user session
 */
export async function getCurrentUser() {
  const session = await getServerSession(authOptions)
  return session?.user
}

/**
 * Require authentication for a page/route
 * Redirects to sign in if not authenticated
 */
export async function requireAuth() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/signin')
  }

  return user
}

/**
 * Check if user has completed setup
 */
export async function checkUserSetup(userId: string) {
  const { prisma } = await import('@/lib/prisma')

  const settings = await prisma.settings.findUnique({
    where: { userId },
  })

  return !!settings
}