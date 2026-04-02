'use client'

import { useState } from 'react'
import Image from 'next/image'
import {
  Shield, FileText, Download, Eye, AlertTriangle,
  CheckCircle2, Loader2, RefreshCw, Lock,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

interface Props {
  token: string
  recipientName: string
  fileName: string
  folderName: string
  logoUrl: string | null
  appName: string
  otpEnabled: boolean
  otpChannel: string
  otpVerifiedAt: string | null
  isExpired: boolean
  isRevoked: boolean
  linkId: string
}

export function ShareAccessClient(props: Props) {
  const [otp, setOtp] = useState('')
  const [otpVerified, setOtpVerified] = useState(!!props.otpVerifiedAt)
  const [verifying, setVerifying] = useState(false)
  const [resending, setResending] = useState(false)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [loadingDownload, setLoadingDownload] = useState(false)
  const [otpError, setOtpError] = useState<string>()

  const canAccess = !props.otpEnabled || otpVerified

  async function verifyOtp() {
    if (otp.length !== 6) return
    setVerifying(true)
    setOtpError(undefined)
    try {
      const res = await fetch('/api/share/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: props.token, otp }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setOtpVerified(true)
        toast({ title: 'Verified!', description: 'You can now access your document.' })
      } else {
        setOtpError(data.error ?? 'Invalid OTP. Please try again.')
      }
    } finally {
      setVerifying(false)
    }
  }

  async function resendOtp() {
    setResending(true)
    const res = await fetch('/api/share/otp/resend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: props.token }),
    })
    const data = await res.json()
    if (res.ok) {
      toast({ title: 'OTP resent', description: `A new OTP has been sent to your ${props.otpChannel === 'PHONE' ? 'phone' : 'email'}.` })
    } else {
      toast({ title: 'Error', description: data.error, variant: 'destructive' })
    }
    setResending(false)
  }

  async function getDownloadUrl() {
    setLoadingDownload(true)
    const res = await fetch(`/api/share/link/${props.token}/download`)
    const data = await res.json()
    if (res.ok) {
      window.open(data.data.url, '_blank')
    } else {
      toast({ title: 'Error', description: data.error, variant: 'destructive' })
    }
    setLoadingDownload(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 flex flex-col">
      {/* Branded header */}
      <header className="bg-white border-b shadow-sm">
        <div className="mx-auto max-w-4xl px-6 py-4 flex items-center gap-4">
          {props.logoUrl ? (
            <img src={props.logoUrl} alt={props.appName} className="h-10 max-w-[180px] object-contain" />
          ) : (
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
                <FileText className="h-5 w-5 text-white" />
              </div>
              <span className="text-lg font-bold text-gray-900">{props.appName}</span>
            </div>
          )}
          <div className="ml-auto flex items-center gap-2 text-xs text-gray-400">
            <Shield className="h-3.5 w-3.5" />
            Secured Document
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-6">

          {/* Expired / Revoked */}
          {(props.isExpired || props.isRevoked) && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
              <AlertTriangle className="h-14 w-14 text-red-400 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-red-800 mb-2">
                {props.isRevoked ? 'Link Revoked' : 'Link Expired'}
              </h2>
              <p className="text-sm text-red-600">
                {props.isRevoked
                  ? 'This share link has been revoked. Please contact the sender.'
                  : 'This share link has expired. Please contact the sender for a new link.'}
              </p>
            </div>
          )}

          {/* Document card */}
          {!props.isExpired && !props.isRevoked && (
            <div className="rounded-2xl border bg-white shadow-lg overflow-hidden">
              {/* Document info header */}
              <div className="bg-gradient-to-r from-primary to-blue-700 p-6 text-white">
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20">
                    <FileText className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-blue-100">{props.folderName}</p>
                    <p className="font-semibold text-lg leading-tight">{props.fileName}</p>
                  </div>
                </div>
                <p className="text-sm text-blue-100">
                  Shared securely with <strong className="text-white">{props.recipientName}</strong>
                </p>
              </div>

              <div className="p-6">
                {/* OTP verification */}
                {props.otpEnabled && !otpVerified && (
                  <div className="space-y-5">
                    <div className="flex items-start gap-3 rounded-lg bg-amber-50 border border-amber-200 p-4">
                      <Lock className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-amber-800">OTP Verification Required</p>
                        <p className="text-xs text-amber-600 mt-0.5">
                          Enter the 6-digit OTP sent to your {props.otpChannel === 'PHONE' ? 'phone number' : 'email address'}.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="otp-input">Enter OTP</Label>
                      <Input
                        id="otp-input"
                        value={otp}
                        onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="000000"
                        maxLength={6}
                        className={cn(
                          'text-center text-2xl font-bold tracking-widest h-14',
                          otpError && 'border-red-400 focus-visible:ring-red-400'
                        )}
                        onKeyDown={e => e.key === 'Enter' && verifyOtp()}
                      />
                      {otpError && <p className="text-xs text-red-600">{otpError}</p>}
                    </div>

                    <Button onClick={verifyOtp} disabled={verifying || otp.length !== 6} className="w-full">
                      {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
                      Verify & Access Document
                    </Button>

                    <div className="text-center">
                      <button
                        onClick={resendOtp}
                        disabled={resending}
                        className="text-xs text-primary hover:underline disabled:opacity-60 flex items-center gap-1 mx-auto"
                      >
                        {resending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                        Resend OTP
                      </button>
                    </div>
                  </div>
                )}

                {/* Access granted */}
                {canAccess && (
                  <div className="space-y-4">
                    {otpVerified && (
                      <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 p-3">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <p className="text-sm text-green-800 font-medium">Identity verified successfully</p>
                      </div>
                    )}

                    <div className="rounded-lg bg-gray-50 border p-4 flex items-center gap-3">
                      <FileText className="h-10 w-10 text-red-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{props.fileName}</p>
                        <p className="text-xs text-gray-500">PDF Document</p>
                      </div>
                    </div>

                    <Button onClick={getDownloadUrl} disabled={loadingDownload} className="w-full" size="lg">
                      {loadingDownload ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                      Download Document
                    </Button>

                    <p className="text-center text-xs text-gray-400">
                      This link is private and intended for {props.recipientName} only.
                      Do not share this link.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          <p className="text-center text-xs text-gray-400">
            Secured by {props.appName}
          </p>
        </div>
      </main>
    </div>
  )
}
