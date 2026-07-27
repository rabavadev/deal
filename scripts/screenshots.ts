// Captures the README screenshots against a running dev server (npm run dev).
// Usage: npx tsx scripts/screenshots.ts
import { chromium } from 'playwright'
import { mkdirSync } from 'fs'

const BASE = process.env.SHOT_BASE ?? 'http://localhost:3000'
const OUT = 'docs/screenshots'

const PREFS = JSON.stringify({
  address: 'Upper East Side, New York', lat: 40.7823, lng: -73.9525,
  zip: '10128', radiusMiles: 1.5, enabledStores: null,
})

async function main() {
  mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })

  // 1) landing
  await page.goto(BASE)
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.waitForTimeout(1500)
  await page.screenshot({ path: `${OUT}/landing.png` })

  // 2) feed
  await page.evaluate(prefs => localStorage.setItem('deal-radar-prefs-v1', prefs), PREFS)
  await page.reload()
  await page.waitForSelector('.grid > button', { timeout: 20_000 })
  await page.waitForTimeout(2500) // images
  await page.screenshot({ path: `${OUT}/feed.png` })

  // 3) deal sheet
  await page.locator('.grid > button').first().click()
  await page.waitForTimeout(1200)
  await page.screenshot({ path: `${OUT}/deal-sheet.png` })
  await page.keyboard.press('Escape')

  // 4) list comparison
  await page.evaluate(() => localStorage.setItem('deal-radar-list-v1',
    JSON.stringify([{ text: 'chicken breast' }, { text: 'whole milk' }, { text: 'blueberries' }, { text: 'strawberries' }])))
  await page.getByRole('button', { name: 'My list', exact: true }).click()
  await page.waitForTimeout(2500)
  await page.screenshot({ path: `${OUT}/list.png` })

  await browser.close()
  console.log('screenshots written to', OUT)
}
main()
