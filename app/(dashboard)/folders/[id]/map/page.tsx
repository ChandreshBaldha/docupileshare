'use client'

import { Suspense, useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  ChevronRight, RefreshCw, CheckCircle2, AlertCircle,
  Search, Save, Loader2, Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

interface RecipientRow {
  id: string
  name: string
  email: string
  phone: string | null
  matchedFileId: string | null
  matchedFileName: string | null
  matchScore: number | null
  matchStatus: string
}

interface FileOption { id: string; originalName: string }

function MapCsvContent() {
  const params = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()
  const csvId = searchParams.get('csvId')!

  const [recipients, setRecipients] = useState<RecipientRow[]>([])
  const [files, setFiles] = useState<FileOption[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [overrides, setOverrides] = useState<Record<string, string>>({})

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [rRes, fRes] = await Promise.all([
        fetch(`/api/csv/${csvId}/recipients`),
        fetch(`/api/folders/${params.id}/files`),
      ])
      const rData = await rRes.json()
      const fData = await fRes.json()
      setRecipients(rData.data ?? [])
      setFiles(fData.data ?? [])
      setLoading(false)
    }
    load()
  }, [csvId, params.id])

  async function autoMatch() {
    setLoading(true)
    const res = await fetch(`/api/csv/${csvId}/match`, { method: 'POST' })
    const data = await res.json()
    if (res.ok) {
      setRecipients(data.data)
      toast({ title: 'Auto-match complete', description: `${data.data.filter((r: RecipientRow) => r.matchStatus === 'MATCHED').length} recipients matched.` })
    }
    setLoading(false)
  }

  async function saveMapping() {
    setSaving(true)
    // Apply manual overrides
    const manualOverrides = Object.entries(overrides).map(([recipientId, fileId]) => ({ recipientId, fileId }))
    const res = await fetch(`/api/csv/${csvId}/save-mapping`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ manualOverrides }),
    })
    const data = await res.json()
    if (res.ok) {
      toast({ title: 'Mapping saved', description: 'You can now proceed to bulk share.' })
      router.push(`/folders/${params.id}`)
    } else {
      toast({ title: 'Error', description: data.error, variant: 'destructive' })
    }
    setSaving(false)
  }

  const matched = recipients.filter(r => overrides[r.id] ?? r.matchedFileId)
  const unmatched = recipients.filter(r => !(overrides[r.id] ?? r.matchedFileId))

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/folders" className="hover:text-gray-900">Folders</Link>
        <ChevronRight className="h-4 w-4" />
        <Link href={`/folders/${params.id}`} className="hover:text-gray-900">Folder</Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-gray-900">Map CSV to Files</span>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Map Recipients to Files</h1>
          <p className="text-sm text-gray-500 mt-1">
            Match each recipient to their certificate file. Use auto-match or assign manually.
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={autoMatch}>
            <RefreshCw className="h-4 w-4" />
            Auto-Match
          </Button>
          <Button onClick={saveMapping} disabled={saving || unmatched.length > 0}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Mapping
          </Button>
        </div>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-green-50 p-2"><CheckCircle2 className="h-5 w-5 text-green-600" /></div>
            <div><p className="text-2xl font-bold text-gray-900">{matched.length}</p><p className="text-xs text-gray-500">Matched</p></div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-red-50 p-2"><AlertCircle className="h-5 w-5 text-red-600" /></div>
            <div><p className="text-2xl font-bold text-gray-900">{unmatched.length}</p><p className="text-xs text-gray-500">Unmatched</p></div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-blue-50 p-2"><Users className="h-5 w-5 text-blue-600" /></div>
            <div><p className="text-2xl font-bold text-gray-900">{recipients.length}</p><p className="text-xs text-gray-500">Total</p></div>
          </CardContent>
        </Card>
      </div>

      {unmatched.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {unmatched.length} recipients have no matched file. Please assign files manually before saving.
        </div>
      )}

      {/* Mapping table */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Recipient</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Email</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Assigned File</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-500">Score</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {recipients.map(r => {
                  const assignedId = overrides[r.id] ?? r.matchedFileId
                  const assignedFile = files.find(f => f.id === assignedId)
                  const score = r.matchScore

                  return (
                    <tr key={r.id} className={cn('hover:bg-gray-50', !assignedId && 'bg-red-50/30')}>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-gray-900">{r.name}</p>
                          {r.phone && <p className="text-xs text-gray-400">{r.phone}</p>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{r.email}</td>
                      <td className="px-4 py-3 min-w-[300px]">
                        <Select
                          value={assignedId ?? ''}
                          onValueChange={val => setOverrides(prev => ({ ...prev, [r.id]: val }))}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Select a file..." />
                          </SelectTrigger>
                          <SelectContent>
                            {files.map(f => (
                              <SelectItem key={f.id} value={f.id} className="text-xs">
                                {f.originalName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {score !== null ? (
                          <span className={cn('font-medium text-xs', score >= 80 ? 'text-green-600' : score >= 60 ? 'text-yellow-600' : 'text-red-600')}>
                            {score}%
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {overrides[r.id] ? (
                          <Badge variant="info" className="text-xs">Manual</Badge>
                        ) : assignedId ? (
                          <Badge variant="success" className="text-xs">
                            {r.matchStatus === 'MATCHED' ? 'Auto' : r.matchStatus}
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="text-xs">Unmatched</Badge>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function MapCsvPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-32"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>}>
      <MapCsvContent />
    </Suspense>
  )
}
