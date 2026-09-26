import { expect, test, type Page } from '@playwright/test'

// The 26 September 2026 panel screenshot showed 119 fps, 7 ms edit-to-frame,
// 8 ms analysis, 11 ms save, 0 slow frames/tasks, 20.85 MiB heap, 68 ms
// TTS/TTI, 5 ms TTFB, 84 ms LCP, 0.043 CLS, and 40 ms estimated INP.
// These limits allow roughly 2–3x the screenshot's latency readings for a
// 10,000-word draft. INP has a wider limit after a 328 ms headless outlier.
// Tight release targets remain in docs/MVP.md.
const limits = {
  editMs: 30,
  analysisMs: 40,
  saveMs: 50,
  slowFrames: 5,
  longTasks: 5,
  heapMiB: 40,
  ttsMs: 150,
  ttiMs: 200,
  ttfbMs: 50,
  lcpMs: 200,
  cls: 0.1,
  inpMs: 400
}

// Production build of 26 September 2026: 833,453 raw / 407,327 gzip bytes.
// Allow about 10% growth in the assets counted by build-metrics.json.
const buildLimits = { rawBytes: 920_000, gzipBytes: 450_000 }

async function metric(page: Page, name: string): Promise<number | undefined> {
  const tile = page.locator('.metric').filter({ has: page.locator('span', { hasText: name }) }).first()
  const value = (await tile.locator('strong').textContent())?.trim() ?? ''
  if (value === '—' || value === 'Paused') return undefined
  const parsed = Number.parseFloat(value)
  expect(Number.isFinite(parsed), `${name}: ${value}`).toBe(true)
  return parsed
}

async function requiredMetric(page: Page, name: string): Promise<number> {
  await expect.poll(() => metric(page, name)).toBeDefined()
  return (await metric(page, name))!
}

function largeDraft(): string {
  const paragraph = 'A clear local draft keeps words readable while the editor saves every change. '
  return Array.from({ length: 100 }, (_, index) => `## Note ${index + 1}\n\n${paragraph.repeat(8)}\n`).join('\n')
}

test('10,000-word draft stays within the browser performance smoke budgets', async ({ page }, testInfo) => {
  await page.goto('/')
  const editor = page.locator('.cm-content')
  await expect(editor).toBeVisible()

  // Use a real editable transaction, wait for a committed draft, then reload.
  // This exercises startup with the large draft instead of only an empty page.
  const draft = largeDraft()
  const words = draft.trim().split(/\s+/u).length
  expect(words).toBeGreaterThanOrEqual(10_000)
  await editor.fill(draft)
  await expect(page.getByRole('status')).toContainText('Saved on this device', { timeout: 15_000 })
  await page.reload()
  await expect(page.locator('.word-count')).toContainText(`${words} words`)
  await page.getByRole('button', { name: 'Performance metrics' }).click()
  await expect(page.getByRole('complementary', { name: 'Performance metrics' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Build size' })).toContainText('Gzip')
  const buildResponse = await page.request.get('/build-metrics.json')
  expect(buildResponse.ok()).toBe(true)
  const build = await buildResponse.json() as {
    rawBytes: number
    gzipBytes: number
    files: { rawBytes: number; gzipBytes: number }[]
  }
  expect(build.files.length).toBeGreaterThan(0)
  expect(build.rawBytes).toBe(build.files.reduce((total, file) => total + file.rawBytes, 0))
  expect(build.gzipBytes).toBe(build.files.reduce((total, file) => total + file.gzipBytes, 0))

  // The display may be 60 or 120 Hz. Measure its local rAF ceiling and
  // require at least 70% of that rate while the metrics panel is open.
  const refreshFps = await page.evaluate(() => new Promise<number>(resolve => {
    const frames: number[] = []
    const sample = (now: number) => {
      frames.push(now)
      if (now - frames[0] < 800) requestAnimationFrame(sample)
      else resolve((frames.length - 1) * 1000 / (now - frames[0]))
    }
    requestAnimationFrame(sample)
  }))

  await editor.click()
  await page.keyboard.press('ControlOrMeta+End')
  await page.keyboard.type('A final sentence grows one character at a time.', { delay: 45 })
  await expect(page.getByRole('status')).toContainText('Saved on this device', { timeout: 15_000 })
  await expect.poll(() => metric(page, 'Frame rate')).toBeDefined()
  await expect.poll(() => metric(page, 'Analysis')).toBeDefined()

  const readings = {
    fps: await requiredMetric(page, 'Frame rate'),
    editMs: await requiredMetric(page, 'Edit → frame'),
    analysisMs: await requiredMetric(page, 'Analysis'),
    saveMs: await requiredMetric(page, 'Local save'),
    slowFrames: await requiredMetric(page, 'Slow frames'),
    longTasks: await requiredMetric(page, 'Long tasks'),
    heapMiB: await metric(page, 'JS heap'),
    ttsMs: await requiredMetric(page, 'TTS · screen'),
    ttiMs: await requiredMetric(page, 'TTI · editor'),
    ttfbMs: await metric(page, 'TTFB'),
    lcpMs: await metric(page, 'LCP'),
    cls: await requiredMetric(page, 'CLS'),
    inpMs: await metric(page, 'INP estimate')
  }
  await testInfo.attach('performance-readings.json', {
    body: JSON.stringify({ browser: 'headless Chrome', words, refreshFps, readings, limits, build: { rawBytes: build.rawBytes, gzipBytes: build.gzipBytes }, buildLimits }, null, 2),
    contentType: 'application/json'
  })
  console.log('Performance readings:', JSON.stringify({ refreshFps, readings, build: { rawBytes: build.rawBytes, gzipBytes: build.gzipBytes } }))

  expect(build.rawBytes).toBeLessThanOrEqual(buildLimits.rawBytes)
  expect(build.gzipBytes).toBeLessThanOrEqual(buildLimits.gzipBytes)
  expect(readings.fps).toBeGreaterThanOrEqual(Math.max(45, refreshFps * 0.7))
  expect(readings.editMs).toBeLessThanOrEqual(limits.editMs)
  expect(readings.analysisMs).toBeLessThanOrEqual(limits.analysisMs)
  expect(readings.saveMs).toBeLessThanOrEqual(limits.saveMs)
  expect(readings.slowFrames).toBeLessThanOrEqual(limits.slowFrames)
  expect(readings.longTasks).toBeLessThanOrEqual(limits.longTasks)
  expect(readings.ttsMs).toBeLessThanOrEqual(limits.ttsMs)
  expect(readings.ttiMs).toBeLessThanOrEqual(limits.ttiMs)
  expect(readings.cls).toBeLessThanOrEqual(limits.cls)
  if (readings.heapMiB !== undefined) expect(readings.heapMiB).toBeLessThanOrEqual(limits.heapMiB)
  if (readings.ttfbMs !== undefined) expect(readings.ttfbMs).toBeLessThanOrEqual(limits.ttfbMs)
  if (readings.lcpMs !== undefined) expect(readings.lcpMs).toBeLessThanOrEqual(limits.lcpMs)
  if (readings.inpMs !== undefined) expect(readings.inpMs).toBeLessThanOrEqual(limits.inpMs)
})
