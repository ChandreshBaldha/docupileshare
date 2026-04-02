'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, FileText, X, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { toast } from '@/hooks/use-toast'
import { cn, formatBytes } from '@/lib/utils'
import type { UploadProgress } from '@/types'

interface Props { folderId: string; onComplete?: () => void }

export function FileUploadZone({ folderId, onComplete }: Props) {
  const [uploads, setUploads] = useState<UploadProgress[]>([])
  const [isUploading, setIsUploading] = useState(false)

  const updateUpload = (fileName: string, patch: Partial<UploadProgress>) => {
    setUploads(prev => prev.map(u => u.fileName === fileName ? { ...u, ...patch } : u))
  }

  async function uploadFile(file: File) {
    updateUpload(file.name, { status: 'uploading', progress: 10 })
    try {
      // Step 1 — get upload info (S3 presigned URL or local mode)
      const presignRes = await fetch('/api/upload/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folderId,
          fileName: file.name,
          contentType: file.type || 'application/pdf',
        }),
      })
      const presignData = await presignRes.json()
      if (!presignRes.ok) throw new Error(presignData.error)

      const { mode, uploadUrl, storageKey } = presignData.data
      updateUpload(file.name, { progress: 30 })

      if (mode === 's3') {
        // Step 2a — upload directly to S3 via presigned URL
        const xhr = new XMLHttpRequest()
        await new Promise<void>((resolve, reject) => {
          xhr.upload.addEventListener('progress', e => {
            if (e.lengthComputable)
              updateUpload(file.name, { progress: 30 + Math.round((e.loaded / e.total) * 60) })
          })
          xhr.addEventListener('load', () =>
            xhr.status < 300 ? resolve() : reject(new Error(`S3 upload failed: ${xhr.status}`))
          )
          xhr.addEventListener('error', () => reject(new Error('Network error during upload')))
          xhr.open('PUT', uploadUrl)
          xhr.setRequestHeader('Content-Type', file.type || 'application/pdf')
          xhr.send(file)
        })
      } else {
        // Step 2b — local mode: POST file to our server
        const form = new FormData()
        form.append('file', file)
        form.append('storageKey', storageKey)
        const localRes = await fetch('/api/upload/local', { method: 'POST', body: form })
        const localData = await localRes.json()
        if (!localRes.ok) throw new Error(localData.error || 'Local upload failed')
      }

      updateUpload(file.name, { progress: 90 })

      // Step 3 — confirm in DB
      const confirmRes = await fetch('/api/upload/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folderId,
          fileName: file.name,
          storageKey,
          sizeBytes: file.size,
          contentType: file.type || 'application/pdf',
        }),
      })
      const confirmData = await confirmRes.json()
      if (!confirmRes.ok) throw new Error(confirmData.error)

      updateUpload(file.name, { status: 'done', progress: 100 })
    } catch (err: any) {
      updateUpload(file.name, { status: 'error', error: err.message })
    }
  }

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const newUploads: UploadProgress[] = acceptedFiles.map(f => ({
      fileName: f.name,
      progress: 0,
      status: 'pending',
    }))
    setUploads(prev => [...prev, ...newUploads])
    setIsUploading(true)

    // Upload in batches of 5 to avoid overwhelming the server
    const batchSize = 5
    for (let i = 0; i < acceptedFiles.length; i += batchSize) {
      await Promise.all(acceptedFiles.slice(i, i + batchSize).map(uploadFile))
    }

    setIsUploading(false)
    const done = newUploads.filter(u => u.status !== 'error').length
    if (done > 0) {
      toast({ title: 'Upload complete', description: `${done} of ${acceptedFiles.length} files uploaded successfully.` })
      onComplete?.()
    }
  }, [folderId])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    multiple: true,
    disabled: isUploading,
  })

  const doneCount = uploads.filter(u => u.status === 'done').length
  const errorCount = uploads.filter(u => u.status === 'error').length

  return (
    <div className="space-y-3">
      <div
        {...getRootProps()}
        className={cn(
          'flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition-colors cursor-pointer',
          isDragActive ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-primary/50 hover:bg-gray-50',
          isUploading && 'pointer-events-none opacity-60'
        )}
      >
        <input {...getInputProps()} />
        <Upload className={cn('h-10 w-10 mb-3', isDragActive ? 'text-primary' : 'text-gray-300')} />
        <p className="text-sm font-medium text-gray-700">
          {isDragActive ? 'Drop your PDFs here' : 'Drag & drop PDF files here'}
        </p>
        <p className="text-xs text-gray-400 mt-1">or click to browse · Supports bulk upload (1000+ files)</p>
      </div>

      {uploads.length > 0 && (
        <div className="space-y-1.5 max-h-56 overflow-y-auto rounded-lg border p-2 bg-gray-50">
          <div className="flex items-center justify-between text-xs text-gray-500 px-1 pb-1 border-b">
            <span>{doneCount}/{uploads.length} uploaded</span>
            {errorCount > 0 && <span className="text-red-500">{errorCount} failed</span>}
          </div>
          {uploads.map((u, i) => (
            <div key={i} className="flex items-center gap-2 rounded-md bg-white border px-2 py-1.5 text-xs">
              {u.status === 'done'     && <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />}
              {u.status === 'error'    && <AlertCircle  className="h-3.5 w-3.5 text-red-500 shrink-0" />}
              {u.status === 'uploading'&& <Loader2      className="h-3.5 w-3.5 animate-spin text-primary shrink-0" />}
              {u.status === 'pending'  && <FileText     className="h-3.5 w-3.5 text-gray-400 shrink-0" />}
              <span className="truncate flex-1 text-gray-700">{u.fileName}</span>
              {u.status === 'uploading' && (
                <div className="w-20 shrink-0">
                  <Progress value={u.progress} className="h-1" />
                </div>
              )}
              {u.status === 'done'  && <span className="text-green-600 font-medium shrink-0">Done</span>}
              {u.status === 'error' && (
                <span className="text-red-500 shrink-0 max-w-[100px] truncate" title={u.error}>
                  {u.error ?? 'Failed'}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
