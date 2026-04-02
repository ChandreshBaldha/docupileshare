'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { Progress } from '@/components/ui/progress'

interface Props { batchId: string }

export function ShareBatchPoller({ batchId }: Props) {
  const router = useRouter()
  const [progress, setProgress] = useState({ sent: 0, total: 0, failed: 0 })

  useEffect(() => {
    const interval = setInterval(async () => {
      const res = await fetch(`/api/share/${batchId}/status`)
      const data = await res.json()
      if (data.data) {
        const { sentCount, totalRecipients, failedCount, status } = data.data
        setProgress({ sent: sentCount, total: totalRecipients, failed: failedCount })
        if (!['PROCESSING', 'PENDING'].includes(status)) {
          clearInterval(interval)
          router.refresh()
        }
      }
    }, 3000)
    return () => clearInterval(interval)
  }, [batchId, router])

  const pct = progress.total > 0 ? Math.round(((progress.sent + progress.failed) / progress.total) * 100) : 0

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-3">
      <div className="flex items-center gap-3">
        <Loader2 className="h-5 w-5 text-blue-600 animate-spin shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-medium text-blue-900">
            Sending emails... {progress.sent + progress.failed} / {progress.total}
          </p>
          <p className="text-xs text-blue-600 mt-0.5">
            {progress.sent} sent, {progress.failed} failed. Page will refresh automatically.
          </p>
        </div>
        <span className="text-sm font-bold text-blue-700">{pct}%</span>
      </div>
      <Progress value={pct} className="h-2" />
    </div>
  )
}
