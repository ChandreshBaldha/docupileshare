'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ChevronRight, Mail, Shield, Clock, Upload, Image,
  Send, Loader2, AlertCircle, CheckCircle2, Variable, Eye,
} from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { toast } from '@/hooks/use-toast'
import { TEMPLATE_VARIABLES } from '@/types'
import { EXPIRY_PRESETS } from '@/lib/utils'
import { cn } from '@/lib/utils'

function NewShareContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const folderId = searchParams.get('folderId')!
  const csvId = searchParams.get('csvId')!

  const [folder, setFolder] = useState<{ name: string } | null>(null)
  const [recipientCount, setRecipientCount] = useState(0)
  const [branding, setBranding] = useState<{ id: string; name: string; publicUrl: string }[]>([])
  const [templates, setTemplates] = useState<{ id: string; name: string; subject: string; bodyHtml: string }[]>([])

  // Form state
  const [emailSubject, setEmailSubject] = useState('Your certificate is ready — {{name}}')
  const [emailBody, setEmailBody] = useState(`<p>Dear <strong>{{name}}</strong>,</p>

<p>We are pleased to share your certificate with you. Please click the button below to access your document securely.</p>

<div style="text-align:center;margin:28px 0;">
  <a href="{{shareLink}}" style="display:inline-block;background:#1e40af;color:#ffffff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">
    Access My Certificate
  </a>
</div>

<p style="color:#6b7280;font-size:13px;">This link is valid until <strong>{{expiryDate}}</strong>. Do not share this link with anyone.</p>

<p>Best regards,<br/>The Team</p>`)

  const [brandingAssetId, setBrandingAssetId] = useState<string>('')
  const [otpEnabled, setOtpEnabled] = useState(false)
  const [otpChannel, setOtpChannel] = useState<'EMAIL' | 'PHONE'>('EMAIL')
  const [linkExpiryHours, setLinkExpiryHours] = useState<number>(168)
  const [linkExpiryLabel, setLinkExpiryLabel] = useState('1 Week')
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')
  const [showPreview, setShowPreview] = useState(false)
  const [sending, setSending] = useState(false)
  const [brandingUploadLoading, setBrandingUploadLoading] = useState(false)

  useEffect(() => {
    async function load() {
      const [folderRes, recipientRes, brandingRes, templateRes] = await Promise.all([
        fetch(`/api/folders/${folderId}`),
        fetch(`/api/csv/${csvId}/recipients?countOnly=true`),
        fetch('/api/branding'),
        fetch('/api/templates'),
      ])
      const folderData = await folderRes.json()
      const recipientData = await recipientRes.json()
      const brandingData = await brandingRes.json()
      const templateData = await templateRes.json()

      setFolder(folderData.data)
      setRecipientCount(recipientData.data?.count ?? 0)
      setBranding(brandingData.data ?? [])
      setTemplates(templateData.data ?? [])
    }
    load()
  }, [folderId, csvId])

  function insertVariable(varKey: string) {
    const textarea = document.getElementById('email-body') as HTMLTextAreaElement
    if (!textarea) return
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const before = emailBody.substring(0, start)
    const after = emailBody.substring(end)
    setEmailBody(before + `{{${varKey}}}` + after)
    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(start + varKey.length + 4, start + varKey.length + 4)
    }, 0)
  }

  function applyTemplate(templateId: string) {
    const t = templates.find(t => t.id === templateId)
    if (!t) return
    setEmailSubject(t.subject)
    setEmailBody(t.bodyHtml)
    setSelectedTemplateId(templateId)
  }

  async function handleBrandingUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setBrandingUploadLoading(true)
    const formData = new FormData()
    formData.append('file', file)
    formData.append('name', file.name)
    const res = await fetch('/api/branding/upload', { method: 'POST', body: formData })
    const data = await res.json()
    if (res.ok) {
      setBranding(prev => [...prev, data.data])
      setBrandingAssetId(data.data.id)
      toast({ title: 'Logo uploaded' })
    } else {
      toast({ title: 'Upload failed', description: data.error, variant: 'destructive' })
    }
    setBrandingUploadLoading(false)
  }

  async function handleSend() {
    if (!emailSubject.trim() || !emailBody.trim()) {
      toast({ title: 'Missing fields', description: 'Email subject and body are required.', variant: 'destructive' })
      return
    }
    setSending(true)
    try {
      const res = await fetch('/api/share/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folderId,
          csvUploadId: csvId,
          emailSubject,
          emailBodyHtml: emailBody,
          brandingAssetId: brandingAssetId || null,
          otpEnabled,
          otpChannel: otpEnabled ? otpChannel : null,
          linkExpiryHours: linkExpiryHours || null,
          linkExpiryLabel,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast({ title: 'Share batch initiated!', description: `Sending to ${recipientCount} recipients in the background.` })
      router.push(`/shares/${data.data.id}`)
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/folders" className="hover:text-gray-900">Folders</Link>
        <ChevronRight className="h-4 w-4" />
        <Link href={`/folders/${folderId}`} className="hover:text-gray-900">{folder?.name ?? '...'}</Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-gray-900">Configure Share</span>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Configure Bulk Share</h1>
          <p className="text-sm text-gray-500 mt-1">
            Sending to <strong>{recipientCount} recipients</strong> from folder <strong>{folder?.name}</strong>
          </p>
        </div>
        <Button onClick={handleSend} disabled={sending} size="lg" className="gap-2">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Send to {recipientCount} Recipients
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left column — Email template */}
        <div className="lg:col-span-2 space-y-6">

          {/* Template selector */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Mail className="h-4 w-4 text-primary" />
                Email Template
              </CardTitle>
              <CardDescription>Load a saved template or build custom below</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {templates.length > 0 && (
                <div className="space-y-2">
                  <Label>Load Saved Template</Label>
                  <Select value={selectedTemplateId} onValueChange={applyTemplate}>
                    <SelectTrigger><SelectValue placeholder="Select a template..." /></SelectTrigger>
                    <SelectContent>
                      {templates.map(t => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Subject */}
              <div className="space-y-2">
                <Label htmlFor="email-subject">Email Subject *</Label>
                <Input
                  id="email-subject"
                  value={emailSubject}
                  onChange={e => setEmailSubject(e.target.value)}
                  placeholder="Your certificate is ready — {{name}}"
                />
              </div>

              {/* Variable buttons */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <Variable className="h-3.5 w-3.5" />
                  Insert Variables
                </Label>
                <div className="flex flex-wrap gap-2">
                  {TEMPLATE_VARIABLES.map(v => (
                    <button
                      key={v.key}
                      onClick={() => insertVariable(v.key)}
                      className="inline-flex items-center rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
                      title={`Example: ${v.example}`}
                    >
                      {`{{${v.key}}}`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Email body */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="email-body">Email Body (HTML) *</Label>
                  <button
                    onClick={() => setShowPreview(!showPreview)}
                    className="flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <Eye className="h-3 w-3" />
                    {showPreview ? 'Hide' : 'Preview'}
                  </button>
                </div>
                <Textarea
                  id="email-body"
                  value={emailBody}
                  onChange={e => setEmailBody(e.target.value)}
                  rows={14}
                  className="font-mono text-xs"
                />
              </div>

              {/* HTML Preview */}
              {showPreview && (
                <div className="space-y-2">
                  <Label>Email Preview</Label>
                  <div
                    className="rounded-lg border p-4 bg-white text-sm"
                    dangerouslySetInnerHTML={{
                      __html: emailBody
                        .replace(/{{name}}/g, 'John Doe')
                        .replace(/{{shareLink}}/g, '#')
                        .replace(/{{fileName}}/g, 'Certificate_John_Doe.pdf')
                        .replace(/{{expiryDate}}/g, '31 Mar 2025, 23:59')
                        .replace(/{{appName}}/g, 'Docupile Share')
                    }}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column — Settings */}
        <div className="space-y-6">

          {/* Branding */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Image className="h-4 w-4 text-primary" />
                Branding Logo
              </CardTitle>
              <CardDescription>Displayed as header in emails and share page</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {branding.length > 0 && (
                <Select
                  value={brandingAssetId || 'none'}
                  onValueChange={v => setBrandingAssetId(v === 'none' ? '' : v)}
                >
                  <SelectTrigger><SelectValue placeholder="Select a logo..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No logo</SelectItem>
                    {branding.map(b => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <div>
                <label className={cn(
                  'flex items-center gap-2 rounded-lg border-2 border-dashed border-gray-200 p-3 cursor-pointer text-sm text-gray-500 hover:border-primary/50 hover:text-primary transition-colors',
                  brandingUploadLoading && 'opacity-60 pointer-events-none'
                )}>
                  {brandingUploadLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  Upload New Logo
                  <input type="file" accept="image/*" className="sr-only" onChange={handleBrandingUpload} />
                </label>
              </div>
              {brandingAssetId && (
                <div className="rounded-lg bg-gray-50 p-3 text-xs text-center text-gray-500">
                  Logo selected ✓
                </div>
              )}
            </CardContent>
          </Card>

          {/* OTP Settings */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                OTP Verification
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-700">Enable OTP</p>
                  <p className="text-xs text-gray-400">Recipients must verify before viewing</p>
                </div>
                <Switch checked={otpEnabled} onCheckedChange={setOtpEnabled} />
              </div>

              {otpEnabled && (
                <div className="space-y-2 pt-2 border-t">
                  <Label>Send OTP via</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['EMAIL', 'PHONE'] as const).map(ch => (
                      <button
                        key={ch}
                        onClick={() => setOtpChannel(ch)}
                        className={cn(
                          'rounded-lg border p-3 text-sm font-medium transition-all',
                          otpChannel === ch
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-gray-200 text-gray-600 hover:border-primary/50'
                        )}
                      >
                        {ch === 'EMAIL' ? '📧 Email' : '📱 Phone SMS'}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-gray-400">OTP is valid for 10 minutes. Max 5 attempts.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Link Expiry */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                Link Expiry
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                {EXPIRY_PRESETS.map(preset => (
                  <button
                    key={preset.label}
                    onClick={() => {
                      setLinkExpiryHours(preset.hours)
                      setLinkExpiryLabel(preset.label)
                    }}
                    className={cn(
                      'rounded-lg border px-3 py-2 text-xs font-medium transition-all',
                      linkExpiryLabel === preset.label
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-gray-200 text-gray-600 hover:border-primary/50'
                    )}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Summary */}
          <Card className="border-0 shadow-sm bg-gray-50">
            <CardContent className="p-4 space-y-2 text-sm">
              <p className="font-semibold text-gray-700">Share Summary</p>
              <div className="flex justify-between"><span className="text-gray-500">Recipients</span><strong>{recipientCount}</strong></div>
              <div className="flex justify-between"><span className="text-gray-500">OTP</span><strong>{otpEnabled ? `Yes (${otpChannel})` : 'No'}</strong></div>
              <div className="flex justify-between"><span className="text-gray-500">Link Expires</span><strong>{linkExpiryLabel}</strong></div>
              <div className="flex justify-between"><span className="text-gray-500">Branding</span><strong>{brandingAssetId ? 'Custom Logo' : 'None'}</strong></div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default function NewSharePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-32"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>}>
      <NewShareContent />
    </Suspense>
  )
}
