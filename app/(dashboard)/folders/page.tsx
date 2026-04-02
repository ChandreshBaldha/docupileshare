import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Folder } from 'lucide-react'
import { CreateFolderDialog } from '@/components/folders/create-folder-dialog'
import { FolderCard } from '@/components/folders/folder-card'
import { ArchivedFolders } from '@/components/folders/archived-folders'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Folders' }

export default async function FoldersPage() {
  const session = await getServerSession(authOptions)
  const isAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(session?.user?.role ?? '')

  const [folders, archivedFolders] = await Promise.all([
    prisma.folder.findMany({
      where: isAdmin ? { isArchived: false } : { createdById: session!.user.id, isArchived: false },
      orderBy: { updatedAt: 'desc' },
      include: {
        createdBy: { select: { name: true } },
        _count: { select: { csvUploads: true, shareBatches: true } },
      },
    }),
    prisma.folder.findMany({
      where: isAdmin ? { isArchived: true } : { createdById: session!.user.id, isArchived: true },
      orderBy: { updatedAt: 'desc' },
      include: {
        createdBy: { select: { name: true } },
        _count: { select: { csvUploads: true, shareBatches: true } },
      },
    }),
  ])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Folders</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage your certificate folders
            {archivedFolders.length > 0 && (
              <span className="ml-2 text-amber-600 font-medium">
                · {archivedFolders.length} archived
              </span>
            )}
          </p>
        </div>
        <CreateFolderDialog />
      </div>

      {/* Active folders */}
      {folders.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 py-20 text-center">
          <Folder className="h-16 w-16 text-gray-200 mb-4" />
          <h3 className="text-lg font-semibold text-gray-600">No folders yet</h3>
          <p className="text-sm text-gray-400 mt-1 mb-6">Create your first folder to start uploading certificates.</p>
          <CreateFolderDialog />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {folders.map(folder => (
            <FolderCard key={folder.id} folder={folder} />
          ))}
        </div>
      )}

      {/* Archived folders section */}
      {archivedFolders.length > 0 && (
        <ArchivedFolders folders={archivedFolders} />
      )}
    </div>
  )
}
