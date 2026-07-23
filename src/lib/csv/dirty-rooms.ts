import Papa from 'papaparse'

// Header aliases accepted for the room-number column, mirroring the backend
// adapter and the provisioning CSV importer.
const ROOM_ALIASES = ['room_number', 'room', 'number', 'room_no']

function normalizeKey(key: string): string {
  return key.trim().toLowerCase().replace(/[\s-]+/g, '_')
}

function parseRows(file: File): Promise<string[][]> {
  return new Promise((resolve, reject) => {
    Papa.parse<string[]>(file, {
      header: false,
      skipEmptyLines: 'greedy',
      complete: (result) => resolve(result.data),
      error: (err: Error) => reject(err),
    })
  })
}

/**
 * Parse a CSV (or plain newline list) of room numbers into a de-duplicated,
 * order-preserving list. Deliberately forgiving so a manager can drop in a bare
 * list or a spreadsheet export:
 *
 * - If the first row names a known room-number column (e.g. `room_number`,
 *   `room`, `number`), that column is used and the header row is dropped.
 * - Otherwise the file is treated as header-less and the first non-empty cell of
 *   each row is taken as the room number.
 *
 * The server stays authoritative — it re-validates every number against the
 * hotel's rooms.
 */
export async function parseDirtyRoomsCsv(file: File): Promise<string[]> {
  const rows = await parseRows(file)
  if (rows.length === 0) return []

  const header = rows[0].map((cell) => normalizeKey(String(cell ?? '')))
  const aliasIndex = header.findIndex((key) => ROOM_ALIASES.includes(key))

  let values: string[]
  if (aliasIndex !== -1) {
    values = rows.slice(1).map((row) => String(row[aliasIndex] ?? ''))
  } else {
    // No recognizable header — take the first non-empty cell of every row.
    values = rows.map(
      (row) => row.map((c) => String(c ?? '').trim()).find(Boolean) ?? '',
    )
  }

  const seen = new Set<string>()
  const result: string[] = []
  for (const raw of values) {
    const num = raw.trim()
    if (num && !seen.has(num)) {
      seen.add(num)
      result.push(num)
    }
  }
  return result
}

export const DIRTY_ROOMS_TEMPLATE = 'room_number\n101\n102\n203\n'

export function downloadText(
  filename: string,
  text: string,
  mime = 'text/csv',
): void {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** Split `count` items as evenly as possible across `n` buckets — the same rule
 * the backend applies to a fresh batch — so the modal can preview the per-person
 * split before submitting. Returns bucket sizes, largest first, differing by ≤1. */
export function evenSplit(count: number, n: number): number[] {
  if (n <= 0) return []
  const base = Math.floor(count / n)
  const remainder = count % n
  return Array.from({ length: n }, (_, i) => base + (i < remainder ? 1 : 0))
}
