import { expect, test } from '@playwright/test'

test('standalone diary tag gains editor styling while typing', async ({ page }) => {
  await page.goto('/')
  const editor = page.locator('.cm-content')
  await expect(editor).toBeVisible()
  await editor.fill('# 27/09/2026\n\n\n\n')
  await page.keyboard.type('#diario')
  await expect(page.locator('.cm-content .md-tag')).toHaveText('#diario')
})
