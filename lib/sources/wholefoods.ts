import { DEFAULT_LOCATION } from '@/config/location'
import { enrichWfDeals, flattenWfProducts, parseWholeFoodsText, wfToDeals } from './wholefoods-parse'
import type { DealSource, FlyerInput } from '@/lib/types'

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'

export const wholeFoodsSource: DealSource = {
  id: 'wholefoods',
  async fetchFlyers() {
    const storeId = DEFAULT_LOCATION.wholeFoodsStoreId
    if (!storeId) return []
    const now = new Date().toISOString()
    return [{
      source: 'wholefoods', externalId: `wf-${storeId}-${now.slice(0, 10)}`,
      merchantSlug: 'whole-foods-market', merchantName: 'Whole Foods Market',
      title: 'Weekly Sales', validFrom: now, validTo: null, raw: { storeId },
    }]
  },
  async fetchDeals(flyer: FlyerInput) {
    const { storeId } = flyer.raw as { storeId: number }
    const { chromium } = await import('playwright')
    const browser = await chromium.launch({ args: ['--disable-blink-features=AutomationControlled'] })
    try {
      const page = await browser.newPage({ userAgent: UA })
      const productBatches: unknown[] = []
      page.on('response', async res => {
        if (res.url().includes('/api/wwos/products') && res.status() === 200) {
          try { productBatches.push(await res.json()) } catch { /* non-JSON, ignore */ }
        }
      })
      await page.goto(`https://www.wholefoodsmarket.com/sales-flyer?store-id=${storeId}`, {
        waitUntil: 'domcontentloaded', timeout: 45_000,
      })
      await page.waitForTimeout(5_000) // let client hydration finish
      // scroll through the page so lazy product batches (images) all load
      for (let i = 0; i < 8; i++) {
        await page.evaluate(() => window.scrollBy(0, window.innerHeight * 2))
        await page.waitForTimeout(700)
      }
      const text = await page.evaluate(() => document.body.innerText)
      // card images carry the product name as alt text — the richest image source
      const domImages = await page.evaluate(() =>
        Array.from(document.querySelectorAll('img'))
          .filter(i => i.alt && /media-amazon\.com\/images\/I\//.test(i.src))
          .map(i => ({ name: i.alt, productImages: [i.src] })))
      const deals = wfToDeals(parseWholeFoodsText(text), storeId, new Date().toISOString())
      if (deals.length === 0) throw new Error('Whole Foods parse produced 0 deals — page layout may have changed')
      return enrichWfDeals(deals, [...domImages, ...flattenWfProducts(productBatches)])
    } finally {
      await browser.close()
    }
  },
}
