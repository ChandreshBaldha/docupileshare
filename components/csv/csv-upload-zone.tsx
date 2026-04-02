'use client'

import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { FileText, Upload, CheckCircle2, Loader2, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from '@/hooks/use-toast'
import { useRouter } from 'next/navigation'

interface Props { folderId: string }

export function CsvUploadZone({ folderId }: Props) {
  const router = useRouter()
  const [status, setStatus] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle')
  const [fileName, setFileName] = useState<string>()
  const [error, setError] = useState<string>()

  const onDrop = useCallback(async (files: File[]) => {
    const file = files[0]
    if (!file) return
    setFileName(file.name)
    setStatus('uploading')
    setError(undefined)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('folderId', folderId)

      const res = await fetch('/api/csv/upload', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      setStatus('done')
      toast({ title: 'CSV uploaded', description: `${data.data.rowCount} recipients found. You can now map files.` })
      router.refresh()
    } catch (err: any) {
      setStatus('error')
      setError(err.message)
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' })
    }
  }, [folderId])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'], 'application/vnd.ms-excel': ['.csv'] },
    maxFiles: 1,
    disabled: status === 'uploading',
  })

  return (
    <div
      {...getRootProps()}
      className={cn(
        'flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center cursor-pointer transition-colors',
        isDragActive ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-primary/50 hover:bg-gray-50',
        status === 'uploading' && 'pointer-events-none opacity-60'
      )}
    >
      <input {...getInputProps()} />
      {status === 'uploading' ? (
        <>
          <Loader2 className="h-8 w-8 text-primary animate-spin mb-2" />
          <p className="text-sm text-gray-600">Uploading & parsing {fileName}...</p>
        </>
      ) : status === 'done' ? (
        <>
          <CheckCircle2 className="h-8 w-8 text-green-500 mb-2" />
          <p className="text-sm font-medium text-gray-700">{fileName}</p>
          <p className="text-xs text-gray-400 mt-1">Uploaded successfully • Drop another to replace</p>
        </>
      ) : status === 'error' ? (
        <>
          <AlertCircle className="h-8 w-8 text-red-400 mb-2" />
          <p className="text-sm font-medium text-red-600">Upload failed</p>
          <p className="text-xs text-red-400 mt-1">{error}</p>
        </>
      ) : (
        <>
          <FileText className={cn('h-8 w-8 mb-2', isDragActive ? 'text-primary' : 'text-gray-300')} />
          <p className="text-sm font-medium text-gray-700">Drop your CSV file here</p>
          <p className="text-xs text-gray-400 mt-1">Must include: name, email columns • phone optional</p>
        </>
      )}
    </div>
  )
}
