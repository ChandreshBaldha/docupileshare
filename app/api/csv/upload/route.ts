import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { buildStorageKey, uploadToS3, S3_BUCKET } from '@/lib/s3'
import { S3_CONFIGURED } from '@/lib/storage'
import { normalizeName } from '@/lib/matching'
import { apiSuccess, apiError } from '@/lib/utils'
import Papa from 'papaparse'
import { Prisma } from '@prisma/client'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Unauthorized', 401)

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const folderId = formData.get('folderId') as string | null

    if (!file || !folderId) return apiError('Missing file or folderId', 400)
    if (!file.name.toLowerCase().endsWith('.csv')) return apiError('Only CSV files allowed', 400)

    const text = await file.text()

    // ── Parse CSV ────────────────────────────────────────────────
    const parsed = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true,
      transformHeader: h => h.trim().toLowerCase(),
    })

    if (parsed.errors.length > 0 && parsed.data.length === 0) {
      return apiError('Invalid CSV: ' + parsed.errors[0].message, 400)
    }

    // ── Detect columns ───────────────────────────────────────────
    const headers = parsed.meta.fields ?? []
    const nameCol  = headers.find(h => ['name', 'full_name', 'fullname', 'recipient_name', 'student_name'].includes(h))
    const emailCol = headers.find(h => ['email', 'email_address', 'emailaddress', 'mail'].includes(h))
    const phoneCol = headers.find(h => ['phone', 'phone_number', 'mobile', 'contact', 'cell'].includes(h))

    if (!nameCol)  return apiError('CSV must have a "name" column (found: ' + headers.join(', ') + ')', 400)
    if (!emailCol) return apiError('CSV must have an "email" column (found: ' + headers.join(', ') + ')', 400)

    // ── Store CSV file ───────────────────────────────────────────
    const storageKey = buildStorageKey(`folders/${folderId}/csv`, file.name)
    let storageBucket: string

    if (S3_CONFIGURED) {
      await uploadToS3({ key: storageKey, body: text, contentType: 'text/csv' })
      storageBucket = S3_BUCKET
    } else {
      // Local fallback — save to public/uploads/csv/
      const csvDir = path.join(process.cwd(), 'public', 'uploads', 'csv', folderId)
      await mkdir(csvDir, { recursive: true })
      await writeFile(path.join(csvDir, path.basename(storageKey)), text, 'utf8')
      storageBucket = 'local'
    }

    // ── Save CSV upload record ───────────────────────────────────
    const csvUpload = await prisma.csvUpload.create({
      data: {
        folderId,
        fileName: file.name,
        storageKey,
        storageBucket,
        sizeBytes: file.size,
        rowCount: parsed.data.length,
        parsedAt: new Date(),
        uploadedById: session.user.id,
      },
    })

    // ── Save recipients ──────────────────────────────────────────
    const extraCols = headers.filter(h => h !== nameCol && h !== emailCol && h !== phoneCol)

    const recipients = parsed.data
      .filter(row => row[nameCol!]?.trim() && row[emailCol!]?.trim())
      .map(row => ({
        csvUploadId: csvUpload.id,
        name: row[nameCol!].trim(),
        normalizedName: normalizeName(row[nameCol!].trim()),
        email: row[emailCol!].trim().toLowerCase(),
        phone: phoneCol ? row[phoneCol]?.trim() || null : null,
        extraData: extraCols.length > 0
          ? Object.fromEntries(extraCols.map(c => [c, row[c] ?? '']))
          : Prisma.DbNull,
      }))

    if (recipients.length === 0) {
      // Clean up the empty CSV upload
      await prisma.csvUpload.delete({ where: { id: csvUpload.id } })
      return apiError('No valid rows found in CSV. Ensure "name" and "email" columns have data.', 400)
    }

    await prisma.recipient.createMany({ data: recipients })

    return apiSuccess({
      csvUploadId: csvUpload.id,
      rowCount: recipients.length,
      columns: { name: nameCol, email: emailCol, phone: phoneCol ?? null },
    }, 201)

  } catch (err: any) {
    console.error('[POST /api/csv/upload]', err)
    return apiError(err.message ?? 'CSV upload failed', 500)
  }
}
