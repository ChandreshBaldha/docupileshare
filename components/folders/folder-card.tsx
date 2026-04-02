'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Folder, MoreVertical, Trash2, Archive, Pencil,
  Loader2, AlertTriangle,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { toast } from '@/hooks/use-toast'
import { formatBytes, formatRelative } from '@/lib/utils'

interface FolderCardProps {
  folder: {
    id: string
    name: string
    description: string | null
    totalSizeBytes: number | bigint
    fileCount: number | bigint
    updatedAt: Date | string
    createdBy: { name: string }
    _count: { csvUploads: number; shareBatches: number }
  }
}

export function FolderCard({ folder }: FolderCardProps) {
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    try {
      const res = await fetch(`/api/folders/${folder.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to delete folder')
      toast({ title: 'Folder deleted', description: `"${folder.name}" has been removed.` })
      setDeleteOpen(false)
      router.refresh()
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally {
      setDeleting(false)
    }
  }

  async function handleArchive() {
    setMenuOpen(false)
    try {
      const res = await fetch(`/api/folders/${folder.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isArchived: true }),
      })
      if (!res.ok) throw new Error('Failed to archive')
      toast({ title: 'Folder archived', description: `"${folder.name}" has been archived.` })
      router.refresh()
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    }
  }

  return (
    <>
      <Card className="group border-0 shadow-sm hover:shadow-md transition-all border relative">
        {/* 3-dot menu button — sits top-right, above the Link */}
        <div className="absolute top-3 right-3 z-10">
          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-gray-700 hover:bg-gray-100"
              onClick={e => { e.preventDefault(); e.stopPropagation(); setMenuOpen(v => !v) }}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>

            {menuOpen && (
              <>
                {/* Backdrop to close menu */}
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-8 z-20 w-44 rounded-lg border bg-white shadow-lg py-1">
                  <button
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    onClick={e => { e.stopPropagation(); setMenuOpen(false); handleArchive() }}
                  >
                    <Archive className="h-4 w-4 text-gray-400" />
                    Archive Folder
                  </button>
                  <div className="my-1 border-t" />
                  <button
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                    onClick={e => { e.stopPropagation(); setMenuOpen(false); setDeleteOpen(true) }}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete Folder
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Card content — entire card is a link */}
        <Link href={`/folders/${folder.id}`}>
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 group-hover:bg-primary/10 transition-colors">
                <Folder className="h-6 w-6 text-blue-600 group-hover:text-primary" />
              </div>
              <Badge variant="outline" className="text-xs mr-8">
                {formatBytes(Number(folder.totalSizeBytes))}
              </Badge>
            </div>

            <h3 className="font-semibold text-gray-900 truncate mb-1">{folder.name}</h3>
            {folder.description && (
              <p className="text-xs text-gray-500 truncate mb-3">{folder.description}</p>
            )}

            <div className="grid grid-cols-3 gap-2 text-center mt-4">
              <div className="rounded-lg bg-gray-50 p-2">
                <p className="text-lg font-bold text-gray-900">{Number(folder.fileCount)}</p>
                <p className="text-xs text-gray-500">Files</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-2">
                <p className="text-lg font-bold text-gray-900">{folder._count.csvUploads}</p>
                <p className="text-xs text-gray-500">CSV</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-2">
                <p className="text-lg font-bold text-gray-900">{folder._count.shareBatches}</p>
                <p className="text-xs text-gray-500">Shares</p>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between text-xs text-gray-400">
              <span>By {folder.createdBy.name}</span>
              <span>{formatRelative(folder.updatedAt)}</span>
            </div>
          </CardContent>
        </Link>
      </Card>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Delete Folder
            </DialogTitle>
            <DialogDescription className="pt-1">
              Are you sure you want to delete{' '}
              <span className="font-semibold text-gray-900">"{folder.name}"</span>?
              <br />
              <br />
              {Number(folder.fileCount) > 0 ? (
                <span className="text-amber-600 font-medium">
                  ⚠️ This folder contains {Number(folder.fileCount)} file(s). The folder will be
                  archived and hidden — files will not be permanently deleted.
                </span>
              ) : (
                <span>This folder will be archived and hidden from your list. This action cannot be undone easily.</span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Deleting…</>
              ) : (
                <><Trash2 className="h-4 w-4 mr-2" /> Delete Folder</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
