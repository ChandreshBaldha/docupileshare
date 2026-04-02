'use client'

import { useState, useEffect } from 'react'
import { Plus, FileText, Trash2, Loader2, Star, Variable } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogTrigger,
} from '@/components/ui/dialog'
import { toast } from '@/hooks/use-toast'
import { TEMPLATE_VARIABLES } from '@/types'
import { formatDate } from '@/lib/utils'

interface Template {
  id: string; name: string; subject: string; bodyHtml: string
  variablesUsed: string[]; isDefault: boolean; createdAt: string
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', subject: '', bodyHtml: '', isDefault: false })

  async function load() {
    const res = await fetch('/api/templates')
    const data = await res.json()
    setTemplates(data.data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function insertVar(varKey: string) {
    setForm(f => ({ ...f, bodyHtml: f.bodyHtml + `{{${varKey}}}` }))
  }

  async function handleSave() {
    if (!form.name || !form.subject || !form.bodyHtml) return
    setSaving(true)
    const res = await fetch('/api/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    if (res.ok) {
      toast({ title: 'Template saved' })
      setOpen(false)
      setForm({ name: '', subject: '', bodyHtml: '', isDefault: false })
      load()
    } else {
      toast({ title: 'Error', description: data.error, variant: 'destructive' })
    }
    setSaving(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Email Templates</h1>
          <p className="text-sm text-gray-500 mt-1">Save and reuse email templates for bulk shares</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4" />New Template</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Email Template</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Template Name</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Certificate Share Template" />
              </div>
              <div className="space-y-2">
                <Label>Email Subject</Label>
                <Input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} placeholder="Your certificate is ready, {{name}}" />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1"><Variable className="h-3.5 w-3.5" />Insert Variables</Label>
                <div className="flex flex-wrap gap-2">
                  {TEMPLATE_VARIABLES.map(v => (
                    <button key={v.key} onClick={() => insertVar(v.key)}
                      className="rounded-full border border-primary/30 bg-primary/5 px-2.5 py-0.5 text-xs font-medium text-primary hover:bg-primary/10">
                      {`{{${v.key}}}`}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Email Body (HTML)</Label>
                <Textarea value={form.bodyHtml} onChange={e => setForm(f => ({ ...f, bodyHtml: e.target.value }))} rows={10} className="font-mono text-xs" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving || !form.name || !form.subject || !form.bodyHtml}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}Save Template
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed py-20 text-center">
          <FileText className="h-16 w-16 text-gray-200 mb-4" />
          <h3 className="text-lg font-semibold text-gray-600">No templates yet</h3>
          <p className="text-sm text-gray-400 mt-1">Create templates to reuse across share batches.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map(t => (
            <Card key={t.id} className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{t.name}</CardTitle>
                  {t.isDefault && <Star className="h-4 w-4 text-yellow-500 shrink-0" fill="currentColor" />}
                </div>
                <CardDescription className="truncate">{t.subject}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1 mb-3">
                  {t.variablesUsed.map(v => (
                    <Badge key={v} variant="outline" className="text-xs">{`{{${v}}}`}</Badge>
                  ))}
                </div>
                <p className="text-xs text-gray-400">Created {formatDate(t.createdAt)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
