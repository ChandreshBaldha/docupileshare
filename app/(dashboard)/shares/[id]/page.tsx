import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import {
  ChevronRight, Share2, CheckCircle2,
  XCircle, Clock, Eye, Shield, MailCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDate, formatRelative } from '@/lib/utils'
import { ShareBatchPoller } from '@/components/shares/share-batch-poller'
import { ExportLogButton } from '@/components/shares/export-log-button'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Share Batch Detail' }

const STATUS_MAP: Record<string, { variant: string; label: string }> = {
  DRAFT: { variant: 'warning', label: 'Draft' },
  PENDING: { variant: 'warning', label: 'Pending' },
  PROCESSING: { variant: 'info', label: 'Processing' },
  COMPLETED: { variant: 'success', label: 'Completed' },
  PARTIALLY_FAILED: { variant: 'warning', label: 'Partial Fail' },
  FAILED: { variant: 'destructive', label: 'Failed' },
}

export default async function ShareBatchPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)

  const batch = await prisma.shareBatch.findUnique({
    where: { id: params.id },
    include: {
      folder: { select: { id: true, name: true } },
      csvUpload: { select: { fileName: true, rowCount: true } },
      createdBy: { select: { name: true } },
      brandingAsset: { select: { name: true, publicUrl: true } },
      shareLinks: {
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: {
          recipient: { select: { name: true, email: true, phone: true } },
          file: { select: { originalName: true } },
        },
      },
    },
  })

  if (!batch) notFound()

  const stat = STATUS_MAP[batch.status] ?? { variant: 'outline', label: batch.status }
  const isProcessing = ['PROCESSING', 'PENDING'].includes(batch.status)

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/shares" className="hover:text-gray-900">Share Batches</Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-gray-900">Batch Detail</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-gray-900">{batch.folder.name}</h1>
            <Badge variant={stat.variant as any}>{stat.label}</Badge>
          </div>
          <p className="text-sm text-gray-500">
            Sent by {batch.createdBy.name} • {formatRelative(batch.createdAt)}
          </p>
        </div>
        <ExportLogButton batchId={batch.id} batchName={batch.folder.name} />
      </div>

      {/* Processing indicator */}
      {isProcessing && <ShareBatchPoller batchId={batch.id} />}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Total', value: batch.totalRecipients, icon: Share2, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Sent', value: batch.sentCount, icon: MailCheck, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Failed', value: batch.failedCount, icon: XCircle, color: 'text-red-600', bg: 'bg-red-50' },
          { label: 'Accessed', value: batch.accessedCount, icon: Eye, color: 'text-purple-600', bg: 'bg-purple-50' },
        ].map(s => (
          <Card key={s.label} className="border-0 shadow-sm">
            <CardContent className="p-5 flex items-center gap-3">
              <div className={`rounded-xl p-2.5 ${s.bg}`}>
                <s.icon className={`h-5 w-5 ${s.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{s.value}</p>
                <p className="text-xs text-gray-500">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Configuration summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 space-y-1.5">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">OTP</p>
            <div className="flex items-center gap-2">
              <Shield className={`h-4 w-4 ${batch.otpEnabled ? 'text-green-600' : 'text-gray-300'}`} />
              <p className="text-sm font-medium">
                {batch.otpEnabled ? `Enabled — ${batch.otpChannel}` : 'Disabled'}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 space-y-1.5">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Link Expiry</p>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-gray-400" />
              <p className="text-sm font-medium">{batch.linkExpiryLabel ?? 'Never'}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 space-y-1.5">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Branding</p>
            <p className="text-sm font-medium">{batch.brandingAsset?.name ?? 'No custom logo'}</p>
          </CardContent>
        </Card>
      </div>

      {/* Share links table */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Share Links</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Recipient</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">File</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-500">Email Sent</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-500">OTP Verified</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-500">Access Count</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-500">Status</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-500">Expires</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {batch.shareLinks.map(link => (
                  <tr key={link.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{link.recipient.name}</p>
                      <p className="text-xs text-gray-400">{link.recipient.email}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600 max-w-[200px] truncate">{link.file.originalName}</td>
                    <td className="px-4 py-3 text-center">
                      {link.emailSent
                        ? <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />
                        : link.emailError
                          ? <XCircle className="h-4 w-4 text-red-500 mx-auto" />
                          : <Clock className="h-4 w-4 text-gray-300 mx-auto" />
                      }
                    </td>
                    <td className="px-4 py-3 text-center">
                      {!batch.otpEnabled ? <span className="text-xs text-gray-300">N/A</span> :
                        link.otpVerifiedAt
                          ? <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />
                          : <XCircle className="h-4 w-4 text-gray-300 mx-auto" />
                      }
                    </td>
                    <td className="px-4 py-3 text-center font-medium">{link.accessCount}</td>
                    <td className="px-4 py-3 text-center">
                      {(() => {
                        const v = link.status === 'ACTIVE' ? 'success' : link.status === 'ACCESSED' ? 'info' : link.status === 'EXPIRED' ? 'destructive' : 'muted'
                        return <Badge variant={v as any} className="text-xs">{link.status}</Badge>
                      })()}
                    </td>
                    <td className="px-4 py-3 text-center text-xs text-gray-400">
                      {link.expiresAt ? formatDate(link.expiresAt) : 'Never'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
