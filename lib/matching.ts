import Fuse from 'fuse.js'

// ─── Normalize a name for matching ───────────────────────────

export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\.(pdf|docx?|xlsx?|pptx?|txt|jpg|png)$/i, '') // strip extension
    .replace(/[^a-z0-9\s]/g, ' ')  // replace special chars with space
    .replace(/\s+/g, ' ')          // collapse whitespace
    .trim()
}

// ─── Match result type ────────────────────────────────────────

export interface MatchResult {
  recipientId: string
  fileId: string
  fileName: string
  recipientName: string
  score: number          // 0-100, higher = better match
  method: 'EXACT' | 'FUZZY' | 'NONE'
}

export interface RecipientInput {
  id: string
  name: string
  normalizedName: string
}

export interface FileInput {
  id: string
  originalName: string
  normalizedName: string
}

// ─── Run name matching ────────────────────────────────────────

export function matchRecipientsToFiles(
  recipients: RecipientInput[],
  files: FileInput[]
): MatchResult[] {
  const results: MatchResult[] = []

  // Build Fuse.js index on normalized file names
  const fuse = new Fuse(files, {
    keys: ['normalizedName'],
    threshold: 0.35,      // 0 = exact, 1 = anything
    includeScore: true,
    minMatchCharLength: 3,
    ignoreLocation: true,
    useExtendedSearch: false,
  })

  for (const recipient of recipients) {
    const rNorm = recipient.normalizedName

    // 1. Exact match
    const exact = files.find(f => f.normalizedName === rNorm)
    if (exact) {
      results.push({
        recipientId: recipient.id,
        fileId: exact.id,
        fileName: exact.originalName,
        recipientName: recipient.name,
        score: 100,
        method: 'EXACT',
      })
      continue
    }

    // 2. Fuzzy match
    const fuzzyResults = fuse.search(rNorm)
    if (fuzzyResults.length > 0 && fuzzyResults[0].score !== undefined) {
      const best = fuzzyResults[0]
      // Fuse score: 0 = perfect, 1 = no match — invert to 0-100
      const score = Math.round((1 - best.score!) * 100)
      results.push({
        recipientId: recipient.id,
        fileId: best.item.id,
        fileName: best.item.originalName,
        recipientName: recipient.name,
        score,
        method: 'FUZZY',
      })
      continue
    }

    // 3. No match
    results.push({
      recipientId: recipient.id,
      fileId: '',
      fileName: '',
      recipientName: recipient.name,
      score: 0,
      method: 'NONE',
    })
  }

  return results
}

// ─── Minimum score to consider a match valid ─────────────────

export const MIN_MATCH_SCORE = 60
