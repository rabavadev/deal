export interface ListItem { text: string }

const KEY = 'deal-radar-list-v1'

export function loadList(): ListItem[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') } catch { return [] }
}

export function saveList(items: ListItem[]): void {
  localStorage.setItem(KEY, JSON.stringify(items))
}

export function addListItem(text: string): ListItem[] {
  const t = text.trim()
  const cur = loadList()
  if (!t || cur.some(i => i.text.toLowerCase() === t.toLowerCase())) return cur
  const next = [...cur, { text: t }]
  saveList(next)
  return next
}

export function removeListItem(text: string): ListItem[] {
  const next = loadList().filter(i => i.text !== text)
  saveList(next)
  return next
}
