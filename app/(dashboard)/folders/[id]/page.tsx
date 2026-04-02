import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import {
  Folder, Upload, FileText, Share2, ArrowRight,
  ChevronRight, CheckCircle2, Clock,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatBytes, formatDate } from '@/lib/utils'
import { FileUploadZone } from '@/components/files/file-upload-zone'
import { CsvUploadZone } from '@/components/csv/csv-upload-zone'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Folder Detail' }

export default async function FolderDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)

  const folder = await prisma.folder.findUnique({
    where: { id: params.id },
    include: {
      createdBy: { select: { name: true } },
      files: {
        where: { isDeleted: false },
        orderBy: { uploadedAt: 'desc' },
        take: 10,
      },
      csvUploads: {
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          _count: { select: { recipients: true } },
        },
      },
      shareBatches: {
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          createdBy: { select: { name: true } },
        },
      },
    },
  })

  if (!folder) notFound()

  const csvMapped = folder.csvUploads.find(c => c.mappingStatus === 'MAPPED')

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/folders" className="hover:text-gray-900">Folders</Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-gray-900 font-medium truncate max-w-xs">{folder.name}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50">
            <Folder className="h-7 w-7 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{folder.name}</h1>
            {folder.description && <p className="text-sm text-gray-500 mt-0.5">{folder.description}</p>}
            <div className="flex items-center gap-3 mt-1">
              <span className="text-xs text-gray-400">{folder.fileCount} files • {formatBytes(Number(folder.totalSizeBytes))}</span>
              <span className="text-xs text-gray-400">Created by {folder.createdBy.name}</span>
            </div>
          </div>
        </div>
        {csvMapped && (
          <Link href={`/shares/new?folderId=${folder.id}&csvId=${csvMapped.id}`}>
            <Button className="gap-2">
              <Share2 className="h-4 w-4" />
              Bulk Share
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        )}
      </div>

      {/* Progress steps */}
      <div className="flex items-center gap-0">
        {[
          { step: 1, label: 'Upload Files', done: folder.fileCount > 0, active: folder.fileCount === 0 },
          { step: 2, label: 'Upload CSV', done: folder.csvUploads.length > 0, active: folder.fileCount > 0 && folder.csvUploads.length === 0 },
          { step: 3, label: 'Map CSV → Files', done: !!csvMapped, active: folder.csvUploads.length > 0 && !csvMapped },
          { step: 4, label: 'Bulk Share', done: folder.shareBatches.length > 0, active: !!csvMapped },
        ].map((s, i, arr) => (
          <div key={s.step} className="flex items-center">
            <div className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium ${
              s.done ? 'text-green-700 bg-green-50' :
              s.active ? 'text-primary bg-primary/10' :
              'text-gray-400 bg-gray-50'
            }`}>
              {s.done
                ? <CheckCircle2 className="h-4 w-4" />
                : <span className="flex h-5 w-5 items-center justify-center rounded-full border-2 text-xs">{s.step}</span>
              }
              {s.label}
            </div>
            {i < arr.length - 1 && <ChevronRight className="h-4 w-4 text-gray-300 mx-1" />}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* File Upload */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Upload className="h-4 w-4 text-primary" />
              Upload Certificates
              <Badge variant="outline" className="ml-auto">{folder.fileCount} files</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <FileUploadZone folderId={folder.id} />
            {/* Recent files */}
            {folder.files.length > 0 && (
              <div className="mt-4 space-y-1.5">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Recent Files</p>
                {folder.files.slice(0, 5).map(file => (
                  <div key={file.id} className="flex items-center gap-2 text-sm py-1.5 border-b last:border-0">
                    <FileText className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                    <span className="truncate text-gray-700">{file.originalName}</span>
                    <span className="ml-auto text-xs text-gray-400 shrink-0">{formatBytes(Number(file.sizeBytes))}</span>
                  </div>
                ))}
                {folder.fileCount > 5 && (
                  <p className="text-xs text-gray-400 pt-1">+{folder.fileCount - 5} more files</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* CSV Upload */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4 text-primary" />
              Upload Recipients CSV
              <Badge variant="outline" className="ml-auto">{folder.csvUploads.length} uploaded</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CsvUploadZone folderId={folder.id} />
            {folder.csvUploads.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">CSV Files</p>
                {folder.csvUploads.map(csv => (
                  <div key={csv.id} className="flex items-center gap-3 rounded-lg border p-3">
                    <FileText className="h-4 w-4 text-gray-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-700 truncate">{csv.fileName}</p>
                      <p className="text-xs text-gray-400">{csv._count.recipients} recipients</p>
                    </div>
                    <Badge
                      variant={csv.mappingStatus === 'MAPPED' ? 'success' : 'warning' as any}
                      className="text-xs shrink-0"
                    >
                      {csv.mappingStatus}
                    </Badge>
                    {csv.mappingStatus !== 'MAPPED' && (
                      <Link href={`/folders/${folder.id}/map?csvId=${csv.id}`}>
                        <Button size="sm" variant="outline" className="text-xs h-7">Map</Button>
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Share batches */}
      {folder.shareBatches.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Share2 className="h-4 w-4 text-primary" />
              Share History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="pb-3 text-left font-medium text-gray-500">Status</th>
                    <th className="pb-3 text-right font-medium text-gray-500">Recipients</th>
                    <th className="pb-3 text-right font-medium text-gray-500">Sent</th>
                    <th className="pb-3 text-right font-medium text-gray-500">Failed</th>
                    <th className="pb-3 text-left font-medium text-gray-500">Created</th>
                    <th className="pb-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {folder.shareBatches.map(batch => (
                    <tr key={batch.id} className="hover:bg-gray-50">
                      <td className="py-3">
                        <Badge variant={batch.status === 'COMPLETED' ? 'success' : batch.status === 'FAILED' ? 'destructive' : 'outline' as any}>
                          {batch.status}
                        </Badge>
                      </td>
                      <td className="py-3 text-right">{batch.totalRecipients}</td>
                      <td className="py-3 text-right text-green-600">{batch.sentCount}</td>
                      <td className="py-3 text-right text-red-600">{batch.failedCount}</td>
                      <td className="py-3 text-gray-500">{formatDate(batch.createdAt)}</td>
                      <td className="py-3 text-right">
                        <Link href={`/shares/${batch.id}`}>
                          <Button size="sm" variant="ghost" className="h-7 text-xs">View</Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
