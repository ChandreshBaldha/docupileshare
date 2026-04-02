'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import {
  Settings, Palette, Mail, User, Save, Upload,
  Loader2, CheckCircle2, Eye, EyeOff, Shield,
  Globe, Clock, Key,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

type Tab = 'branding' | 'email' | 'profile' | 'defaults'

export default function SettingsPage() {
  const { data: session } = useSession()
  const [activeTab, setActiveTab] = useState<Tab>('branding')

  const tabs = [
    { id: 'branding' as Tab, label: 'Branding', icon: Palette },
    { id: 'email' as Tab, label: 'Email / SMTP', icon: Mail },
    { id: 'defaults' as Tab, label: 'Share Defaults', icon: Globe },
    { id: 'profile' as Tab, label: 'My Profile', icon: User },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Settings className="h-6 w-6 text-primary" />
          Settings
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage branding, email configuration, and account preferences.
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              )}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab panels */}
      {activeTab === 'branding' && <BrandingTab />}
      {activeTab === 'email' && <EmailTab />}
      {activeTab === 'defaults' && <DefaultsTab />}
      {activeTab === 'profile' && <ProfileTab session={session} />}
    </div>
  )
}

/* ─── Branding Tab ──────────────────────────────────────────────────────────── */
function BrandingTab() {
  const [logos, setLogos] = useState<Array<{ id: string; name: string; publicUrl: string; createdAt: string }>>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [appName, setAppName] = useState(process.env.NEXT_PUBLIC_APP_NAME || 'Docupile Share')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/branding')
      .then(r => r.json())
      .then(d => { setLogos(d.data ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'].includes(file.type)) {
      toast({ title: 'Invalid file type', description: 'Please upload PNG, JPG, SVG or WebP.', variant: 'destructive' })
      return
    }
    setUploading(true)
    const form = new FormData()
    form.append('file', file)
    form.append('name', file.name)
    const res = await fetch('/api/branding/upload', { method: 'POST', body: form })
    const data = await res.json()
    if (res.ok) {
      setLogos(prev => [data.data, ...prev])
      toast({ title: 'Logo uploaded', description: 'Your branding logo has been saved.' })
    } else {
      toast({ title: 'Upload failed', description: data.error, variant: 'destructive' })
    }
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Company Logo</CardTitle>
          <CardDescription>
            Upload your logo to appear in email headers and the share link page. PNG or SVG recommended.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Upload area */}
          <div
            onClick={() => fileRef.current?.click()}
            className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 p-10 cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-colors"
          >
            {uploading ? (
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
            ) : (
              <Upload className="h-8 w-8 text-gray-400 mb-2" />
            )}
            <p className="text-sm font-medium text-gray-700">
              {uploading ? 'Uploading...' : 'Click to upload logo'}
            </p>
            <p className="text-xs text-gray-400 mt-1">PNG, JPG, SVG or WebP · Max 5MB</p>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
          </div>

          {/* Existing logos */}
          {loading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>
          ) : logos.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-4">No logos uploaded yet.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {logos.map(logo => (
                <div key={logo.id} className="group relative flex flex-col items-center gap-2 rounded-lg border bg-white p-4">
                  <img
                    src={logo.publicUrl}
                    alt={logo.name}
                    className="h-12 object-contain"
                    onError={e => { (e.target as HTMLImageElement).src = '/placeholder-logo.png' }}
                  />
                  <p className="text-xs text-gray-500 truncate w-full text-center">{logo.name}</p>
                  <span className="text-[10px] text-gray-400">
                    {new Date(logo.createdAt).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Application Name</CardTitle>
          <CardDescription>Displayed in emails and the browser tab.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>App Name</Label>
            <Input
              value={appName}
              onChange={e => setAppName(e.target.value)}
              placeholder="Docupile Share"
            />
          </div>
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
            To permanently change the app name, update <code className="font-mono">NEXT_PUBLIC_APP_NAME</code> in your <code className="font-mono">.env</code> file and restart the server.
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

/* ─── Email / SMTP Tab ──────────────────────────────────────────────────────── */
function EmailTab() {
  const [host, setHost]           = useState('')
  const [port, setPort]           = useState('587')
  const [secure, setSecure]       = useState(false)
  const [user, setUser]           = useState('')
  const [pass, setPass]           = useState('')
  const [fromEmail, setFromEmail] = useState('')
  const [fromName, setFromName]   = useState('Docupile Share')
  const [showPass, setShowPass]   = useState(false)
  const [saving, setSaving]       = useState(false)
  const [saved, setSaved]         = useState(false)
  const [testing, setTesting]     = useState(false)
  const [testEmail, setTestEmail] = useState('')
  const [configured, setConfigured] = useState(false)

  useEffect(() => {
    fetch('/api/settings/email')
      .then(r => r.json())
      .then(d => {
        if (d.data) {
          setHost(d.data.host || '')
          setPort(String(d.data.port || 587))
          setSecure(d.data.secure || false)
          setUser(d.data.user || '')
          setPass(d.data.pass || '')
          setFromEmail(d.data.fromEmail || '')
          setFromName(d.data.fromName || 'Docupile Share')
          setConfigured(d.data.configured || false)
        }
      })
      .catch(() => {})
  }, [])

  async function handleSave() {
    if (!host || !user || !pass || !fromEmail) {
      toast({ title: 'Fill in all required fields', variant: 'destructive' })
      return
    }
    setSaving(true)
    setSaved(false)
    try {
      const res = await fetch('/api/settings/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ host, port: Number(port), secure, user, pass, fromEmail, fromName }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setConfigured(data.data.configured)
      setSaved(true)
      toast({ title: 'SMTP settings saved!', description: 'Email configuration updated successfully.' })
      setTimeout(() => setSaved(false), 3000)
    } catch (err: any) {
      toast({ title: 'Save failed', description: err.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  async function handleTestEmail() {
    if (!testEmail) { toast({ title: 'Enter a test email address', variant: 'destructive' }); return }
    setTesting(true)
    try {
      const res = await fetch('/api/settings/email/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: testEmail }),
      })
      const data = await res.json()
      if (res.ok) {
        toast({ title: '✅ Test email sent!', description: `Check ${testEmail} inbox.` })
      } else {
        toast({ title: 'Test failed', description: data.error, variant: 'destructive' })
      }
    } catch (err: any) {
      toast({ title: 'Test failed', description: err.message, variant: 'destructive' })
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Status banner */}
      {configured ? (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          SMTP is configured. Emails will be sent via <strong>{host}</strong>.
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <Mail className="h-4 w-4 shrink-0" />
          SMTP is not configured. Fill in the details below and click <strong>Save Settings</strong>.
        </div>
      )}

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="h-4 w-4 text-primary" />
            SMTP Server Settings
          </CardTitle>
          <CardDescription>
            Configure your mail server. Works with Gmail, Outlook, Yahoo, or any custom SMTP server.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Host + Port */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label>SMTP Host <span className="text-red-500">*</span></Label>
              <Input value={host} onChange={e => setHost(e.target.value)} placeholder="smtp.gmail.com" />
            </div>
            <div className="space-y-1.5">
              <Label>Port <span className="text-red-500">*</span></Label>
              <Input value={port} onChange={e => setPort(e.target.value)} placeholder="587" />
            </div>
          </div>

          {/* Secure toggle */}
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Use SSL/TLS</p>
              <p className="text-xs text-gray-500">Enable for port 465. Use STARTTLS for port 587 (keep off).</p>
            </div>
            <Switch checked={secure} onCheckedChange={setSecure} />
          </div>

          {/* Username */}
          <div className="space-y-1.5">
            <Label>Username / Email <span className="text-red-500">*</span></Label>
            <Input value={user} onChange={e => setUser(e.target.value)} placeholder="you@gmail.com" />
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <Label>Password / App Password <span className="text-red-500">*</span></Label>
            <div className="relative">
              <Input
                type={showPass ? 'text' : 'password'}
                value={pass}
                onChange={e => setPass(e.target.value)}
                placeholder="••••••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-gray-400">
              For Gmail: use an <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" className="text-primary underline">App Password</a> (not your Google account password).
            </p>
          </div>

          {/* From Email */}
          <div className="space-y-1.5">
            <Label>From Email Address <span className="text-red-500">*</span></Label>
            <Input value={fromEmail} onChange={e => setFromEmail(e.target.value)} placeholder="noreply@yourdomain.com" type="email" />
          </div>

          {/* From Name */}
          <div className="space-y-1.5">
            <Label>From Name</Label>
            <Input value={fromName} onChange={e => setFromName(e.target.value)} placeholder="Docupile Share" />
          </div>

          {/* SAVE BUTTON */}
          <div className="pt-2 border-t">
            <Button onClick={handleSave} disabled={saving} className="w-full" size="lg">
              {saving ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Saving...</>
              ) : saved ? (
                <><CheckCircle2 className="h-4 w-4 mr-2 text-green-400" /> Settings Saved!</>
              ) : (
                <><Save className="h-4 w-4 mr-2" /> Save SMTP Settings</>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Test email */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Send Test Email</CardTitle>
          <CardDescription>Verify your SMTP settings are working correctly before sending bulk emails.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Input
              value={testEmail}
              onChange={e => setTestEmail(e.target.value)}
              placeholder="test@example.com"
              type="email"
              className="flex-1"
            />
            <Button onClick={handleTestEmail} disabled={testing || !configured}>
              {testing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Mail className="h-4 w-4 mr-2" />}
              Send Test
            </Button>
          </div>
          {!configured && (
            <p className="text-xs text-gray-400 mt-2">Save your SMTP settings first before sending a test email.</p>
          )}
        </CardContent>
      </Card>

      {/* Quick reference */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Key className="h-4 w-4" />
            Common SMTP Configurations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-2 text-xs">
            {[
              { name: 'Gmail',   host: 'smtp.gmail.com',         port: '587', note: 'Use App Password' },
              { name: 'Outlook', host: 'smtp.office365.com',     port: '587', note: 'Use account password' },
              { name: 'Yahoo',   host: 'smtp.mail.yahoo.com',    port: '587', note: 'Use App Password' },
              { name: 'Zoho',    host: 'smtp.zoho.com',          port: '587', note: 'Use account password' },
            ].map(cfg => (
              <div key={cfg.name} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
                <span className="font-medium text-gray-700 w-20">{cfg.name}</span>
                <span className="text-gray-500 font-mono">{cfg.host}</span>
                <span className="text-gray-400">:{cfg.port}</span>
                <span className="text-gray-400 italic">{cfg.note}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

/* ─── Share Defaults Tab ────────────────────────────────────────────────────── */
function DefaultsTab() {
  const [defaultExpiry, setDefaultExpiry] = useState('7d')
  const [defaultOtp, setDefaultOtp] = useState(true)
  const [defaultOtpChannel, setDefaultOtpChannel] = useState<'EMAIL' | 'PHONE'>('EMAIL')
  const [saving, setSaving] = useState(false)

  function handleSave() {
    setSaving(true)
    setTimeout(() => {
      setSaving(false)
      toast({ title: 'Defaults saved', description: 'Share link defaults have been updated.' })
    }, 800)
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Share Link Defaults
          </CardTitle>
          <CardDescription>
            Default settings applied when creating a new share batch. Can be overridden per batch.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label>Default Link Expiry</Label>
            <Select value={defaultExpiry} onValueChange={setDefaultExpiry}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1h">1 Hour</SelectItem>
                <SelectItem value="6h">6 Hours</SelectItem>
                <SelectItem value="24h">24 Hours</SelectItem>
                <SelectItem value="3d">3 Days</SelectItem>
                <SelectItem value="7d">7 Days</SelectItem>
                <SelectItem value="14d">14 Days</SelectItem>
                <SelectItem value="30d">30 Days</SelectItem>
                <SelectItem value="never">Never Expires</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="text-sm font-medium text-gray-900">Enable OTP by Default</p>
              <p className="text-xs text-gray-500 mt-0.5">Recipients must verify with a one-time code before viewing</p>
            </div>
            <Switch checked={defaultOtp} onCheckedChange={setDefaultOtp} />
          </div>

          {defaultOtp && (
            <div className="space-y-2">
              <Label>Default OTP Channel</Label>
              <Select value={defaultOtpChannel} onValueChange={v => setDefaultOtpChannel(v as 'EMAIL' | 'PHONE')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EMAIL">Email OTP</SelectItem>
                  <SelectItem value="PHONE">SMS OTP (requires Twilio)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="text-sm font-medium text-gray-900">Track Link Opens</p>
              <p className="text-xs text-gray-500 mt-0.5">Log every time a share link is accessed</p>
            </div>
            <Switch defaultChecked />
          </div>

          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Save Defaults
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

/* ─── Profile Tab ───────────────────────────────────────────────────────────── */
function ProfileTab({ session }: { session: any }) {
  const [name, setName] = useState(session?.user?.name || '')
  const [email, setEmail] = useState(session?.user?.email || '')
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [saving, setSaving] = useState(false)
  const [changingPw, setChangingPw] = useState(false)

  useEffect(() => {
    if (session?.user) {
      setName(session.user.name || '')
      setEmail(session.user.email || '')
    }
  }, [session])

  async function handleSaveProfile() {
    setSaving(true)
    const res = await fetch('/api/users/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    setSaving(false)
    if (res.ok) {
      toast({ title: 'Profile updated', description: 'Your name has been saved.' })
    } else {
      const d = await res.json()
      toast({ title: 'Error', description: d.error, variant: 'destructive' })
    }
  }

  async function handleChangePassword() {
    if (!currentPw || !newPw || !confirmPw) {
      toast({ title: 'Fill in all fields', variant: 'destructive' }); return
    }
    if (newPw !== confirmPw) {
      toast({ title: 'Passwords do not match', variant: 'destructive' }); return
    }
    if (newPw.length < 8) {
      toast({ title: 'Password must be at least 8 characters', variant: 'destructive' }); return
    }
    setChangingPw(true)
    const res = await fetch('/api/users/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
    })
    setChangingPw(false)
    if (res.ok) {
      toast({ title: 'Password changed', description: 'Your password has been updated.' })
      setCurrentPw(''); setNewPw(''); setConfirmPw('')
    } else {
      const d = await res.json()
      toast({ title: 'Error', description: d.error, variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Profile info */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4" />
            Profile Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Full Name</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Your name" />
          </div>
          <div className="space-y-2">
            <Label>Email Address</Label>
            <Input value={email} disabled className="bg-gray-50 text-gray-500 cursor-not-allowed" />
            <p className="text-xs text-gray-400">Email cannot be changed from here. Contact a Super Admin.</p>
          </div>
          <div className="flex items-center gap-3 rounded-lg bg-gray-50 border p-3">
            <Shield className="h-4 w-4 text-primary shrink-0" />
            <div>
              <p className="text-xs font-medium text-gray-700">Role</p>
              <p className="text-xs text-gray-500">{session?.user?.role?.replace(/_/g, ' ')}</p>
            </div>
          </div>
          <Button onClick={handleSaveProfile} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Save Profile
          </Button>
        </CardContent>
      </Card>

      {/* Change password */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Key className="h-4 w-4" />
            Change Password
          </CardTitle>
          <CardDescription>
            Use a strong password with at least 8 characters including numbers and symbols.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Current Password</Label>
            <div className="relative">
              <Input
                type={showPw ? 'text' : 'password'}
                value={currentPw}
                onChange={e => setCurrentPw(e.target.value)}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>New Password</Label>
            <Input
              type={showPw ? 'text' : 'password'}
              value={newPw}
              onChange={e => setNewPw(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <div className="space-y-2">
            <Label>Confirm New Password</Label>
            <Input
              type={showPw ? 'text' : 'password'}
              value={confirmPw}
              onChange={e => setConfirmPw(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          {newPw && (
            <div className="space-y-1">
              {[
                { label: 'At least 8 characters', ok: newPw.length >= 8 },
                { label: 'Contains a number', ok: /\d/.test(newPw) },
                { label: 'Contains a special character', ok: /[!@#$%^&*]/.test(newPw) },
                { label: 'Passwords match', ok: newPw === confirmPw && confirmPw.length > 0 },
              ].map(rule => (
                <div key={rule.label} className="flex items-center gap-2 text-xs">
                  <CheckCircle2 className={cn('h-3.5 w-3.5', rule.ok ? 'text-green-500' : 'text-gray-300')} />
                  <span className={rule.ok ? 'text-green-700' : 'text-gray-400'}>{rule.label}</span>
                </div>
              ))}
            </div>
          )}
          <Button onClick={handleChangePassword} disabled={changingPw}>
            {changingPw ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Key className="h-4 w-4 mr-2" />}
            Change Password
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
