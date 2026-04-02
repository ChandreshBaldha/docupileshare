import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Folder, Share2, Users, FileText, TrendingUp, Clock, CheckCircle2, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDate, formatRelative, formatBytes } from '@/lib/utils'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Dashboard' }

async function getDashboardStats(userId: string, isAdmin: boolean) {
  const userFilter = isAdmin ? {} : { createdById: userId }

  const [
    totalFolders,
    totalFiles,
    totalRecipients,
    totalBatches,
    recentBatches,
    pendingBatches,
  ] = await Promise.all([
    prisma.folder.count({ where: { ...userFilter, isArchived: false } }),
    prisma.file.count({ where: { folder: userFilter, isDeleted: false } }),
    prisma.recipient.count({ where: { csvUpload: { folder: userFilter } } }),
    prisma.shareBatch.count({ where: userFilter }),
    prisma.shareBatch.findMany({
      where: userFilter,
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        folder: { select: { name: true } },
        createdBy: { select: { name: true } },
      },
    }),
    prisma.shareBatch.count({ where: { ...userFilter, status: { in: ['PROCESSING', 'PENDING'] } } }),
  ])

  return { totalFolders, totalFiles, totalRecipients, totalBatches, recentBatches, pendingBatches }
}

const statusColors: Record<string, string> = {
  DRAFT: 'warning',
  PENDING: 'warning',
  PROCESSING: 'info',
  COMPLETED: 'success',
  PARTIALLY_FAILED: 'warning',
  FAILED: 'destructive',
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  const isAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(session?.user?.role ?? '')
  const stats = await getDashboardStats(session!.user.id, isAdmin)

  const statCards = [
    { label: 'Total Folders', value: stats.totalFolders, icon: Folder, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Files Uploaded', value: stats.totalFiles.toLocaleString(), icon: FileText, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'Total Recipients', value: stats.totalRecipients.toLocaleString(), icon: Users, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Share Batches', value: stats.totalBatches, icon: Share2, color: 'text-green-600', bg: 'bg-green-50' },
  ]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back, {session?.user?.name?.split(' ')[0]} 👋
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Here's what's happening with your document shares today.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map(card => (
          <Card key={card.label} className="border-0 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">{card.label}</p>
                  <p className="mt-1 text-3xl font-bold text-gray-900">{card.value}</p>
                </div>
                <div className={`rounded-xl p-3 ${card.bg}`}>
                  <card.icon className={`h-6 w-6 ${card.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Processing alert */}
      {stats.pendingBatches > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <Clock className="h-5 w-5 text-blue-600 shrink-0" />
          <p className="text-sm text-blue-800">
            <strong>{stats.pendingBatches}</strong> share batch{stats.pendingBatches > 1 ? 'es are' : ' is'} currently processing.
          </p>
        </div>
      )}

      {/* Recent batches */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Recent Share Batches</CardTitle>
          <CardDescription>Latest bulk share operations</CardDescription>
        </CardHeader>
        <CardContent>
          {stats.recentBatches.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Share2 className="h-12 w-12 text-gray-200 mb-3" />
              <p className="text-gray-500">No share batches yet.</p>
              <p className="text-sm text-gray-400">Create a folder and upload files to get started.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="pb-3 text-left font-medium text-gray-500">Folder</th>
                    <th className="pb-3 text-left font-medium text-gray-500">Status</th>
                    <th className="pb-3 text-right font-medium text-gray-500">Recipients</th>
                    <th className="pb-3 text-right font-medium text-gray-500">Sent</th>
                    <th className="pb-3 text-right font-medium text-gray-500">Failed</th>
                    <th className="pb-3 text-right font-medium text-gray-500">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {stats.recentBatches.map(batch => (
                    <tr key={batch.id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-3 font-medium text-gray-900">{batch.folder.name}</td>
                      <td className="py-3">
                        <Badge variant={(statusColors[batch.status] ?? 'outline') as any}>
                          {batch.status.replace('_', ' ')}
                        </Badge>
                      </td>
                      <td className="py-3 text-right text-gray-600">{batch.totalRecipients}</td>
                      <td className="py-3 text-right text-green-600 font-medium">{batch.sentCount}</td>
                      <td className="py-3 text-right text-red-600 font-medium">{batch.failedCount}</td>
                      <td className="py-3 text-right text-gray-400">{formatRelative(batch.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
