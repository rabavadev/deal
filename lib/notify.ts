import { getServiceClient } from '@/lib/db'
import { matchesForItem, type CompareDeal } from '@/lib/compare'

interface WatchRow { device_id: string; term: string; max_price: number | null }
type AlertDeal = CompareDeal & { source: string; external_id: string }

export interface Alert { deviceId: string; term: string; dedupeKey: string; deal: AlertDeal }

export function dedupeKey(term: string, deal: { source: string; external_id: string }): string {
  return `${term}:${deal.source}:${deal.external_id}`
}

/** Pure: compute which alerts to send for the given watches/deals, minus already-notified keys. */
export function computeAlerts(
  watches: WatchRow[],
  deals: AlertDeal[],
  alreadyNotified: Set<string>,
): Alert[] {
  const alerts: Alert[] = []
  for (const w of watches) {
    const match = matchesForItem(w.term, deals)
      .find(d => d.price != null && (w.max_price == null || d.price <= w.max_price)) as AlertDeal | undefined
    if (!match) continue
    const key = dedupeKey(w.term, match)
    if (alreadyNotified.has(`${w.device_id}:${key}`)) continue
    alerts.push({ deviceId: w.device_id, term: w.term, dedupeKey: key, deal: match })
  }
  return alerts
}

export async function sendWatchAlerts(): Promise<void> {
  const pub = process.env.VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  if (!pub || !priv) { console.log('[notify] VAPID keys not set — skipping'); return }
  const db = getServiceClient()

  const [{ data: subs }, { data: watches }] = await Promise.all([
    db.from('push_subscriptions').select('device_id, subscription'),
    db.from('watches').select('device_id, term, max_price'),
  ])
  if (!subs?.length || !watches?.length) { console.log('[notify] nothing to do'); return }
  const subByDevice = new Map(subs.map(s => [s.device_id, s.subscription]))
  const activeWatches = (watches as WatchRow[]).filter(w => subByDevice.has(w.device_id))
  if (!activeWatches.length) { console.log('[notify] no watches with subscriptions'); return }

  const now = new Date().toISOString()
  const { data: deals } = await db.from('deals')
    .select('name, normalized_name, merchant_slug, price, source, external_id')
    .not('price', 'is', null).lte('valid_from', now).gte('valid_to', now).limit(10_000)
  // merchant display names
  const { data: stores } = await db.from('stores').select('slug, name')
  const storeName = new Map((stores ?? []).map(s => [s.slug, s.name]))
  const alertDeals: AlertDeal[] = (deals ?? []).map(d => ({
    ...(d as unknown as AlertDeal),
    merchant_name: storeName.get((d as { merchant_slug: string }).merchant_slug) ?? (d as { merchant_slug: string }).merchant_slug,
  }))

  const { data: notified } = await db.from('notified').select('device_id, dedupe_key').limit(10_000)
  const seen = new Set((notified ?? []).map(n => `${n.device_id}:${n.dedupe_key}`))

  const alerts = computeAlerts(activeWatches, alertDeals, seen)
  if (!alerts.length) { console.log('[notify] no new alerts'); return }

  const webpush = (await import('web-push')).default
  webpush.setVapidDetails(process.env.VAPID_CONTACT ?? 'mailto:admin@example.com', pub, priv)

  let sent = 0
  for (const a of alerts) {
    const sub = subByDevice.get(a.deviceId)
    try {
      await webpush.sendNotification(sub as never, JSON.stringify({
        title: `${a.deal.name} — $${a.deal.price!.toFixed(2)}`,
        body: `Your watched "${a.term}" is on sale at ${a.deal.merchant_name}`,
        tag: a.dedupeKey,
        url: '/',
      }))
      await db.from('notified').upsert({ device_id: a.deviceId, dedupe_key: a.dedupeKey })
      sent++
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode
      if (status === 404 || status === 410) {
        await db.from('push_subscriptions').delete().eq('device_id', a.deviceId)
        console.log(`[notify] pruned dead subscription ${a.deviceId}`)
      } else {
        console.error('[notify] send failed:', e)
      }
    }
  }
  console.log(`[notify] sent ${sent}/${alerts.length} alerts`)
}
