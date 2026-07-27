import { chromium } from 'playwright'

// Loads a Whole Foods store page and prints every store-id-looking number in
// embedded data, plus captured /api/stores/{id}/summary calls.
const SLUG = process.argv[2] ?? 'uppereastside'

async function main() {
  const browser = await chromium.launch({ args: ['--disable-blink-features=AutomationControlled'] })
  const page = await browser.newPage()
  const hits: string[] = []
  page.on('response', res => {
    const m = /\/api\/stores\/(\d+)\/summary/.exec(res.url())
    if (m) hits.push(m[1])
  })
  await page.goto(`https://www.wholefoodsmarket.com/stores/${SLUG}`, {
    waitUntil: 'domcontentloaded', timeout: 45_000,
  })
  await page.waitForTimeout(5_000)
  const html = await page.content()
  const ids = [...new Set([...html.matchAll(/store[-_ ]?id["']?\s*[:=]\s*["']?(\d{3,6})/gi)].map(m => m[1]))]
  const tlc = [...new Set([...html.matchAll(/"storeId"\s*:\s*"?(\d{3,6})"?/g)].map(m => m[1]))]
  console.log('title:', await page.title())
  console.log('summary-api ids:', [...new Set(hits)])
  console.log('html store-id matches:', ids)
  console.log('json storeId matches:', tlc)
  console.log('text head:', (await page.evaluate(() => document.body.innerText)).slice(0, 600))
  await browser.close()
}
main()
