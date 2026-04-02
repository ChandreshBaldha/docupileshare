import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { apiSuccess, apiError } from '@/lib/utils'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Unauthorized', 401)

  const { currentPassword, newPassword } = await req.json()

  if (!currentPassword || !newPassword) {
    return apiError('Both current and new password are required', 400)
  }
  if (newPassword.length < 8) {
    return apiError('New password must be at least 8 characters', 400)
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } })
  if (!user?.passwordHash) return apiError('User not found', 404)

  const valid = await bcrypt.compare(currentPassword, user.passwordHash)
  if (!valid) return apiError('Current password is incorrect', 400)

  const newHash = await bcrypt.hash(newPassword, 12)
  await prisma.user.update({
    where: { id: session.user.id },
    data: { passwordHash: newHash },
  })

  return apiSuccess({ message: 'Password changed successfully' })
}
