import { getDeviceId } from './device'

export interface Watch { term: string; maxPrice?: number | null }

const KEY = 'deal-radar-watches-v1'

function syncServer(method: 'POST' | 'DELETE', term: string, maxPrice?: number | null) {
  // fire-and-forget: server copy powers push alerts, local copy powers the UI
  fetch('/api/watches', {
    method, headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId: getDeviceId(), term, maxPrice: maxPrice ?? null }),
  }).catch(() => {})
}

export function loadWatches(): Watch[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') } catch { return [] }
}

export function saveWatches(watches: Watch[]): void {
  localStorage.setItem(KEY, JSON.stringify(watches))
}

export function addWatch(term: string, maxPrice?: number | null): Watch[] {
  const t = term.trim().toLowerCase()
  const cur = loadWatches()
  if (!t || cur.some(w => w.term === t)) return cur
  const next = [...cur, { term: t, maxPrice: maxPrice ?? null }]
  saveWatches(next)
  syncServer('POST', t, maxPrice)
  return next
}

export function removeWatch(term: string): Watch[] {
  const next = loadWatches().filter(w => w.term !== term)
  saveWatches(next)
  syncServer('DELETE', term)
  return next
}
