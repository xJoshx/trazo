import { expect, test } from '@playwright/test'

test('file import preserves Unicode, CRLF and BOM through export', async ({ page }) => {
  await page.goto('/')
  const editor = page.locator('.cm-content')
  await expect(editor).toBeVisible()
  await expect(page.getByRole('status')).toContainText('Saved on this device')

  const source = '\uFEFF# Día\r\n\r\nCafé y 🧑‍💻\r\n'
  await page.getByLabel('Import Markdown file').setInputFiles({
    name: 'diario.md', mimeType: 'text/markdown', buffer: Buffer.from(source)
  })
  await expect(editor.locator('.cm-line')).toHaveText(['# Día', '', 'Café y 🧑‍💻', ''])
  await expect(page.getByRole('status')).toContainText('Saved on this device')

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Document actions' }).click()
  await page.getByRole('menuitem', { name: 'Export Markdown' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe('diario.md')
  const stream = await download.createReadStream()
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(Buffer.from(chunk))
  expect(Buffer.concat(chunks).equals(Buffer.from(source))).toBe(true)
})

test('invalid UTF-8 import leaves the saved draft intact', async ({ page }) => {
  await page.goto('/')
  const editor = page.locator('.cm-content')
  await expect(editor).toBeVisible()
  await editor.fill('Keep this local draft 🧑‍💻.')
  await expect(page.getByRole('status')).toContainText('Saved on this device')
  await page.getByLabel('Import Markdown file').setInputFiles({
    name: 'broken.md', mimeType: 'text/markdown', buffer: Buffer.from([0xff])
  })
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(editor).toContainText('Keep this local draft 🧑‍💻.')
  await page.reload()
  await expect(page.locator('.cm-content')).toContainText('Keep this local draft 🧑‍💻.')
})

for (const width of [1280, 390]) test(`sentence focus follows the caret and an edit remains undoable at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 800 })
  await page.goto('/')
  const editor = page.locator('.cm-content')
  await expect(editor).toBeVisible()
  await editor.fill('Primera frase. Segunda 🧑‍💻 frase.')
  await expect(page.getByRole('status')).toContainText('Saved on this device')
  await page.getByRole('button', { name: 'Focus mode' }).click()
  await expect(page.getByRole('button', { name: 'Exit focus mode' })).toBeVisible()
  await expect(editor.locator('.md-dim')).toContainText('Primera frase.')

  await page.keyboard.type(' Más.')
  await expect(editor).toContainText('Más.')
  await page.keyboard.press('ControlOrMeta+z')
  await expect(editor).not.toContainText('Más.')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Focus mode' })).toBeVisible()
})
