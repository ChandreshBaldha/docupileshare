import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import Link from 'next/link'
import { Share2, CheckCircle2, XCircle, Eye, Clock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDate, formatRelative } from '@/lib/utils'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Share Batches' }

const STATUS_BADGES: Record<string, string> = {
  DRAFT: 'warning',
  PENDING: 'warning',
  PROCESSING: 'info',
  COMPLETED: 'success',
  PARTIALLY_FAILED: 'warning',
  FAILED: 'destructive',
}

export default async function SharesPage() {
  const session = await getServerSession(authOptions)
  const isAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(session?.user?.role ?? '')

  const batches = await prisma.shareBatch.findMany({
    where: isAdmin ? {} : { createdById: session!.user.id },
    orderBy: { createdAt: 'desc' },
    include: {
      folder: { select: { name: true } },
      createdBy: { select: { name: true } },
      csvUpload: { select: { fileName: true } },
    },
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Share Batches</h1>
        <p className="mt-1 text-sm text-gray-500">All bulk share operations</p>
      </div>

      {batches.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed py-20 text-center">
          <Share2 className="h-16 w-16 text-gray-200 mb-4" />
          <h3 className="text-lg font-semibold text-gray-600">No share batches yet</h3>
          <p className="text-sm text-gray-400 mt-1">Upload files and a CSV to get started.</p>
          <Link href="/folders" className="mt-4"><Button>Go to Folders</Button></Link>
        </div>
      ) : (
        <div className="space-y-3">
          {batches.map(batch => (
            <Card key={batch.id} className="border-0 shadow-sm hover:shadow-md transition-all">
              <CardContent className="p-5">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 shrink-0">
                    <Share2 className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="font-semibold text-gray-900 truncate">{batch.folder.name}</h3>
                      <Badge variant={(STATUS_BADGES[batch.status] ?? 'outline') as any} className="text-xs">
                        {batch.status.replace('_', ' ')}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-400">
                      {batch.csvUpload.fileName} • {batch.totalRecipients} recipients • by {batch.createdBy.name} • {formatRelative(batch.createdAt)}
                    </p>
                  </div>
                  <div className="hidden sm:flex items-center gap-6 text-sm shrink-0">
                    <div className="text-center">
                      <p className="font-bold text-green-600">{batch.sentCount}</p>
                      <p className="text-xs text-gray-400">Sent</p>
                    </div>
                    <div className="text-center">
                      <p className="font-bold text-red-600">{batch.failedCount}</p>
                      <p className="text-xs text-gray-400">Failed</p>
                    </div>
                    <div className="text-center">
                      <p className="font-bold text-purple-600">{batch.accessedCount}</p>
                      <p className="text-xs text-gray-400">Accessed</p>
                    </div>
                  </div>
                  <Link href={`/shares/${batch.id}`}>
                    <Button size="sm" variant="outline">View</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
