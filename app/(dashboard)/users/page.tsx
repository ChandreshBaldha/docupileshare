import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { redirect } from 'next/navigation'
import { UserManagement } from '@/components/users/user-management'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'User Management' }

export default async function UsersPage() {
  const session = await getServerSession(authOptions)
  if (!['SUPER_ADMIN', 'ADMIN'].includes(session?.user?.role ?? '')) redirect('/dashboard')

  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, email: true, role: true, isActive: true, lastLoginAt: true, createdAt: true },
  })

  return <UserManagement initialUsers={users as any} />
}
