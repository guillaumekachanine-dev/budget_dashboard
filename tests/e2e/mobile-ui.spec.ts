import { expect, test, type Page } from '@playwright/test'

async function openApp(page: Page) {
  await page.goto('/')
  await expect(page).toHaveTitle(/Budget/i)
}

async function hasAuthenticatedShell(page: Page): Promise<boolean> {
  return page.getByRole('navigation', { name: 'Navigation principale' }).isVisible()
}

function assertMinTouchTarget(box: { width: number; height: number } | null, label: string) {
  expect(box, `${label} should be visible`).not.toBeNull()
  expect(box!.width, `${label} width should be >= 44px`).toBeGreaterThanOrEqual(44)
  expect(box!.height, `${label} height should be >= 44px`).toBeGreaterThanOrEqual(44)
}

test.describe('mobile ui guards', () => {
  test('prevents horizontal overflow and keeps bottom nav visible', async ({ page }) => {
    await openApp(page)

    const noHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth <= window.innerWidth + 1
    })
    expect(noHorizontalOverflow).toBeTruthy()

    if (await hasAuthenticatedShell(page)) {
      const nav = page.getByRole('navigation', { name: 'Navigation principale' })
      await expect(nav).toBeVisible()

      const navBox = await nav.boundingBox()
      expect(navBox).not.toBeNull()
      expect(navBox!.y + navBox!.height).toBeLessThanOrEqual(page.viewportSize()!.height + 1)
    }
  })

  test('enforces touch targets >=44px on flux, budgets and add modal controls', async ({ page }) => {
    await openApp(page)

    test.skip(!(await hasAuthenticatedShell(page)), 'Requires authenticated shell to reach Flux/Budgets/Add modal controls')

    await page.getByRole('link', { name: 'Flux' }).click()
    const advancedFiltersButton = page.getByRole('button', { name: 'Filtres avances' })
    await expect(advancedFiltersButton).toBeVisible()
    assertMinTouchTarget(await advancedFiltersButton.boundingBox(), 'Flux advanced filters button')

    await page.getByRole('link', { name: 'Budgets' }).click()
    const categoryButton = page.getByRole('button', { name: 'Choisir une catégorie' })
    await expect(categoryButton).toBeVisible()
    await categoryButton.click()

    const budgetsCloseButton = page.getByRole('button', { name: 'Fermer' }).first()
    await expect(budgetsCloseButton).toBeVisible()
    assertMinTouchTarget(await budgetsCloseButton.boundingBox(), 'Budgets category sheet close button')
    await budgetsCloseButton.click()

    const addOperationButton = page.getByRole('button', { name: 'Ajouter une opération' })
    await addOperationButton.click()

    const addModal = page.getByTestId('add-transaction-modal')
    await expect(addModal).toBeVisible()

    const modalCloseButton = addModal.getByRole('button', { name: 'Fermer' })
    const dateEditButton = addModal.getByRole('button', { name: 'Modifier la date' })

    assertMinTouchTarget(await modalCloseButton.boundingBox(), 'Add transaction close button')
    assertMinTouchTarget(await dateEditButton.boundingBox(), 'Add transaction date edit button')
  })

  test('keeps focused modal input visible with reduced viewport height (keyboard overlap guard)', async ({ page }) => {
    await openApp(page)

    test.skip(!(await hasAuthenticatedShell(page)), 'Requires authenticated shell to open add transaction modal')

    await page.getByRole('button', { name: 'Ajouter une opération' }).click()
    const addModal = page.getByTestId('add-transaction-modal')
    await expect(addModal).toBeVisible()

    const currentViewport = page.viewportSize()
    if (currentViewport) {
      await page.setViewportSize({
        width: currentViewport.width,
        height: Math.max(480, currentViewport.height - 220),
      })
    }

    const descriptionInput = page.getByLabel('Libellé')
    await descriptionInput.click()

    const inputWithinViewport = await descriptionInput.evaluate((el) => {
      const rect = el.getBoundingClientRect()
      return rect.top >= 0 && rect.bottom <= window.innerHeight
    })

    expect(inputWithinViewport).toBeTruthy()
  })
})
