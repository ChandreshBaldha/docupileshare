'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChevronDown, ChevronUp, Archive, RotateCcw,
  Trash2, Loader2, FolderOpen,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/hooks/use-toast'
import { formatRelative, formatBytes } from '@/lib/utils'

interface ArchivedFolder {
  id: string
  name: string
  description: string | null
  totalSizeBytes: number | bigint
  fileCount: number | bigint
  updatedAt: Date | string
  createdBy: { name: string }
  _count: { csvUploads: number; shareBatches: number }
}

interface Props {
  folders: ArchivedFolder[]
}

export function ArchivedFolders({ folders }: Props) {
  const router = useRouter()
  const [expanded, setExpanded] = useState(false)
  const [loadingId, setLoadingId] = useState<string | null>(null)

  async function handleRestore(folder: ArchivedFolder) {
    setLoadingId(folder.id)
    try {
      const res = await fetch(`/api/folders/${folder.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isArchived: false }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to restore')
      toast({ title: 'Folder restored', description: `"${folder.name}" is active again.` })
      router.refresh()
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally {
      setLoadingId(null)
    }
  }

  return (
    <div className="mt-2">
      {/* Toggle header */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="flex w-full items-center gap-3 rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-600 hover:bg-gray-100 transition-colors"
      >
        <Archive className="h-4 w-4 text-gray-400" />
        <span className="font-medium">Archived Folders</span>
        <Badge variant="outline" className="ml-1 text-xs">{folders.length}</Badge>
        <span className="ml-auto text-xs text-gray-400">
          {expanded ? 'Hide' : 'Show'} archived
        </span>
        {expanded
          ? <ChevronUp className="h-4 w-4 text-gray-400" />
          : <ChevronDown className="h-4 w-4 text-gray-400" />
        }
      </button>

      {/* Archived list */}
      {expanded && (
        <div className="mt-3 space-y-2">
          {folders.map(folder => (
            <div
              key={folder.id}
              className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white px-4 py-3 opacity-75"
            >
              {/* Icon */}
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100">
                <FolderOpen className="h-5 w-5 text-gray-400" />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-700 truncate">{folder.name}</p>
                <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
                  <span>{Number(folder.fileCount)} files</span>
                  <span>·</span>
                  <span>{formatBytes(Number(folder.totalSizeBytes))}</span>
                  <span>·</span>
                  <span>By {folder.createdBy.name}</span>
                  <span>·</span>
                  <span>Archived {formatRelative(folder.updatedAt)}</span>
                </div>
              </div>

              {/* Restore button */}
              <Button
                size="sm"
                variant="outline"
                className="shrink-0 text-green-700 border-green-200 hover:bg-green-50 hover:border-green-400"
                disabled={loadingId === folder.id}
                onClick={() => handleRestore(folder)}
              >
                {loadingId === folder.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                ) : (
                  <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                )}
                Restore
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
