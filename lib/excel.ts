import ExcelJS from 'exceljs'
import { format } from 'date-fns'

export interface ShareLogRow {
  recipientName: string
  recipientEmail: string
  recipientPhone: string | null
  fileName: string
  shareUrl: string
  linkStatus: string
  emailSent: boolean
  emailSentAt: Date | null
  emailError: string | null
  otpEnabled: boolean
  otpChannel: string | null
  otpVerifiedAt: Date | null
  expiresAt: Date | null
  expiryStatus: string
  accessCount: number
  firstAccessedAt: Date | null
  lastAccessedAt: Date | null
  sharedAt: Date
  sentBy: string
}

export async function buildShareLogExcel(
  rows: ShareLogRow[],
  batchName: string
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Docupile Share'
  wb.created = new Date()

  const ws = wb.addWorksheet('Share Log', {
    pageSetup: { orientation: 'landscape', fitToPage: true },
  })

  // ─── Column definitions ─────────────────────────────────────
  ws.columns = [
    { header: '#', key: 'idx', width: 6 },
    { header: 'Recipient Name', key: 'recipientName', width: 25 },
    { header: 'Email', key: 'recipientEmail', width: 30 },
    { header: 'Phone', key: 'recipientPhone', width: 18 },
    { header: 'File Name', key: 'fileName', width: 35 },
    { header: 'Share Link', key: 'shareUrl', width: 55 },
    { header: 'Link Status', key: 'linkStatus', width: 14 },
    { header: 'Email Sent', key: 'emailSent', width: 12 },
    { header: 'Email Sent At', key: 'emailSentAt', width: 22 },
    { header: 'Email Error', key: 'emailError', width: 30 },
    { header: 'OTP Enabled', key: 'otpEnabled', width: 13 },
    { header: 'OTP Channel', key: 'otpChannel', width: 13 },
    { header: 'OTP Verified At', key: 'otpVerifiedAt', width: 22 },
    { header: 'Link Expiry', key: 'expiresAt', width: 22 },
    { header: 'Expiry Status', key: 'expiryStatus', width: 14 },
    { header: 'Access Count', key: 'accessCount', width: 14 },
    { header: 'First Accessed', key: 'firstAccessedAt', width: 22 },
    { header: 'Last Accessed', key: 'lastAccessedAt', width: 22 },
    { header: 'Shared At', key: 'sharedAt', width: 22 },
    { header: 'Sent By', key: 'sentBy', width: 20 },
  ]

  // ─── Header row styling ─────────────────────────────────────
  const headerRow = ws.getRow(1)
  headerRow.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } }
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    cell.border = {
      bottom: { style: 'medium', color: { argb: 'FF1E3A8A' } },
    }
  })
  headerRow.height = 32

  // ─── Data rows ──────────────────────────────────────────────
  const dateStr = (d: Date | null) =>
    d ? format(d, 'dd MMM yyyy, HH:mm:ss') : '—'
  const boolStr = (b: boolean) => (b ? 'Yes' : 'No')

  rows.forEach((row, i) => {
    const dataRow = ws.addRow({
      idx: i + 1,
      recipientName: row.recipientName,
      recipientEmail: row.recipientEmail,
      recipientPhone: row.recipientPhone ?? '—',
      fileName: row.fileName,
      shareUrl: row.shareUrl,
      linkStatus: row.linkStatus,
      emailSent: boolStr(row.emailSent),
      emailSentAt: dateStr(row.emailSentAt),
      emailError: row.emailError ?? '—',
      otpEnabled: boolStr(row.otpEnabled),
      otpChannel: row.otpChannel ?? '—',
      otpVerifiedAt: dateStr(row.otpVerifiedAt),
      expiresAt: dateStr(row.expiresAt),
      expiryStatus: row.expiryStatus,
      accessCount: row.accessCount,
      firstAccessedAt: dateStr(row.firstAccessedAt),
      lastAccessedAt: dateStr(row.lastAccessedAt),
      sharedAt: dateStr(row.sharedAt),
      sentBy: row.sentBy,
    })

    // Alternating row background
    const bg = i % 2 === 0 ? 'FFF8FAFF' : 'FFFFFFFF'
    dataRow.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }
      cell.alignment = { vertical: 'middle', wrapText: false }
      cell.border = {
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      }
    })

    // Colour-code link status
    const statusCell = dataRow.getCell('linkStatus')
    const statusColors: Record<string, string> = {
      ACTIVE: 'FF16A34A',
      ACCESSED: 'FF2563EB',
      EXPIRED: 'FFDC2626',
      REVOKED: 'FF6B7280',
    }
    const color = statusColors[row.linkStatus] ?? 'FF374151'
    statusCell.font = { bold: true, color: { argb: color } }

    // Hyperlink for share URL
    const urlCell = dataRow.getCell('shareUrl')
    urlCell.value = { text: row.shareUrl, hyperlink: row.shareUrl }
    urlCell.font = { color: { argb: 'FF2563EB' }, underline: true }
  })

  // ─── Summary sheet ──────────────────────────────────────────
  const summary = wb.addWorksheet('Summary')
  const totalSent = rows.filter(r => r.emailSent).length
  const totalAccessed = rows.filter(r => r.accessCount > 0).length
  const totalOtpVerified = rows.filter(r => r.otpVerifiedAt !== null).length
  const totalExpired = rows.filter(r => r.expiryStatus === 'Expired').length

  const summaryData = [
    ['Batch', batchName],
    ['Generated At', format(new Date(), 'dd MMM yyyy, HH:mm:ss')],
    ['Total Recipients', rows.length],
    ['Emails Sent', totalSent],
    ['Failed Sends', rows.length - totalSent],
    ['Links Accessed', totalAccessed],
    ['OTP Verified', totalOtpVerified],
    ['Expired Links', totalExpired],
  ]

  summaryData.forEach(([label, value]) => {
    const r = summary.addRow([label, value])
    r.getCell(1).font = { bold: true }
    r.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }
  })
  summary.getColumn(1).width = 22
  summary.getColumn(2).width = 30

  // ─── Freeze header row ──────────────────────────────────────
  ws.views = [{ state: 'frozen', ySplit: 1 }]

  // ─── Auto-filter ────────────────────────────────────────────
  ws.autoFilter = { from: 'A1', to: `T1` }

  const buffer = await wb.xlsx.writeBuffer()
  return Buffer.from(buffer)
}
