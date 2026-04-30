import { expect, test } from '@playwright/test'

test('loads budget app and renders login or authenticated shell', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/Budget/i)

  const loginButton = page.getByRole('button', { name: 'Se connecter' })
  const mainNav = page.getByRole('navigation', { name: 'Navigation principale' })

  await Promise.race([
    loginButton.waitFor({ state: 'visible' }),
    mainNav.waitFor({ state: 'visible' }),
  ])
})
