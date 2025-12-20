import { test, expect, type Page } from '@playwright/test'

/**
 * E2E tests for Delete Learn (/learn) - Starlight documentation site
 *
 * These tests cover:
 * - Page rendering and content
 * - Navigation (sidebar, prev/next, internal links)
 * - Mobile sidebar behavior
 * - Table of Contents (TOC)
 * - PWA functionality
 * - Responsive design
 */

// Helper to check if we're in mobile viewport
const isMobile = (page: Page) => {
  const viewport = page.viewportSize()
  return viewport ? viewport.width < 800 : false
}

test.describe('Learn - Page Rendering', () => {
  test('learn index page renders correctly', async ({ page }) => {
    await page.goto('/learn/')

    // Check page title
    await expect(page).toHaveTitle(/Delete Learn/)

    // Check main heading
    await expect(page.getByRole('heading', { name: /Delete Learn/i, level: 1 })).toBeVisible()

    // Check that module cards are visible
    await expect(page.getByText(/Know Yourself/i).first()).toBeVisible()
    await expect(page.getByText(/Science of Attraction/i).first()).toBeVisible()
  })

  test('article page renders with correct structure', async ({ page }) => {
    await page.goto('/learn/know-yourself/why-self-awareness-matters/')

    // Check page title
    await expect(page).toHaveTitle(/Why Self-Awareness Matters/)

    // Check main heading
    await expect(
      page.getByRole('heading', { name: /Why Self-Awareness Matters/i, level: 1 })
    ).toBeVisible()

    // Check article content exists
    await expect(page.locator('.sl-markdown-content')).toBeVisible()

    // Check prev/next navigation exists
    await expect(page.getByRole('link', { name: /Previous/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /Next/i })).toBeVisible()
  })

  test('references section is present on article pages', async ({ page }) => {
    await page.goto('/learn/know-yourself/why-self-awareness-matters/')

    // Check references heading exists
    await expect(page.getByRole('heading', { name: /References/i })).toBeVisible()

    // Check that reference links exist (doi links)
    const doiLinks = page.locator('a[href*="doi.org"]')
    await expect(doiLinks.first()).toBeVisible()
  })
})

test.describe('Learn - Navigation', () => {
  test('sidebar navigation is functional', async ({ page }, testInfo) => {
    const isMobileProject = testInfo.project.name === 'learn-mobile'

    if (isMobileProject) {
      // On mobile, start from an article page where sidebar is accessible
      await page.goto('/learn/know-yourself/why-self-awareness-matters/')

      // Open the hamburger menu
      await page.locator('starlight-menu-button button').click()
      await page.waitForTimeout(500) // Wait for animation

      // Check sidebar sections exist in the opened menu
      await expect(page.locator('.sidebar-pane').getByText(/Know Yourself First/i).first()).toBeVisible()
      await expect(page.locator('.sidebar-pane').getByText(/Science of Attraction/i).first()).toBeVisible()

      // Click on a navigation link
      await page.locator('.sidebar-pane a', { hasText: 'Your Attachment Style' }).click()

      // Verify navigation worked
      await expect(page).toHaveURL(/your-attachment-style/)
    } else {
      // Desktop: start from index page
      await page.goto('/learn/')

      // Check sidebar sections exist (at least the first few visible)
      await expect(page.getByText(/Know Yourself First/i).first()).toBeVisible()
      await expect(page.getByText(/Science of Attraction/i).first()).toBeVisible()

      // Click on a navigation link
      await page.getByRole('link', { name: /Why Self-Awareness Matters/i }).click()

      // Verify navigation worked
      await expect(page).toHaveURL(/why-self-awareness-matters/)
    }
  })

  test('prev/next navigation works correctly', async ({ page }) => {
    await page.goto('/learn/know-yourself/why-self-awareness-matters/')

    // Click next link
    await page.getByRole('link', { name: /Next.*Attachment Style/i }).click()
    await expect(page).toHaveURL(/your-attachment-style/)

    // Click previous link to go back
    await page.getByRole('link', { name: /Previous.*Self-Awareness/i }).click()
    await expect(page).toHaveURL(/why-self-awareness-matters/)
  })

  test('internal article links work', async ({ page }) => {
    await page.goto('/learn/know-yourself/why-self-awareness-matters/')

    // Find a link to another article within the content
    const nextUpLink = page.locator('.sl-markdown-content a[href*="/learn/know-yourself/"]').first()
    if (await nextUpLink.isVisible()) {
      const href = await nextUpLink.getAttribute('href')
      await nextUpLink.click()
      await expect(page).toHaveURL(new RegExp(href!.replace(/\//g, '\\/')))
    }
  })
})

test.describe('Learn - Mobile Sidebar', () => {
  // These tests only run in learn-mobile project (mobile viewport)
  test.beforeEach(async ({ page }, testInfo) => {
    // Skip these tests on desktop project
    if (testInfo.project.name === 'learn-desktop') {
      testInfo.skip()
    }
  })

  test('hamburger menu opens and closes', async ({ page }) => {
    await page.goto('/learn/know-yourself/why-self-awareness-matters/')

    // The menu button is inside starlight-menu-button custom element
    const menuButton = page.locator('starlight-menu-button button')
    await expect(menuButton).toBeVisible()

    // Open menu
    await menuButton.click()
    await page.waitForTimeout(300)

    // Check sidebar pane becomes visible
    await expect(page.locator('.sidebar-pane')).toBeVisible()

    // Close menu
    await menuButton.click()
    await page.waitForTimeout(300)

    // Verify menu closed - sidebar should be hidden (has visibility: hidden)
    await expect(page.locator('.sidebar-pane')).toBeHidden()
  })

  test('sidebar scrolling works without visible scrollbar', async ({ page }) => {
    await page.goto('/learn/know-yourself/why-self-awareness-matters/')

    // Open menu
    await page.getByRole('button', { name: /Menu/i }).click()
    await page.waitForTimeout(300)

    // Check that scrollbar is hidden via CSS
    const sidebarContent = page.locator('.sidebar-content')
    await expect(sidebarContent).toHaveCSS('scrollbar-width', 'none')

    // Verify scrolling works by scrolling the sidebar-pane
    const scrolled = await page.evaluate(() => {
      const pane = document.querySelector('.sidebar-pane')
      if (!pane) return false
      pane.scrollTop = 500
      return pane.scrollTop > 0
    })
    expect(scrolled).toBe(true)
  })

  test('mobile sidebar has bottom sheet styling', async ({ page }) => {
    await page.goto('/learn/know-yourself/why-self-awareness-matters/')

    // Open menu
    await page.getByRole('button', { name: /Menu/i }).click()
    await page.waitForTimeout(300)

    // Check bottom sheet styling (border-radius on top) - value is in pixels: 16px = 1rem
    const sidebarPane = page.locator('.sidebar-pane')
    await expect(sidebarPane).toHaveCSS('border-radius', /16px 16px 0(px)? 0(px)?/)
  })

  test('clicking sidebar link navigates and closes menu', async ({ page }) => {
    // Use an article page that definitely has a sidebar
    await page.goto('/learn/know-yourself/why-self-awareness-matters/')

    // Open menu
    await page.getByRole('button', { name: /Menu/i }).click()
    await page.waitForTimeout(500) // Wait for menu animation

    // Click a navigation link - use a more specific selector
    const link = page.locator('.sidebar-pane a', { hasText: 'Your Attachment Style' })
    await link.click()

    // Verify navigation worked
    await expect(page).toHaveURL(/your-attachment-style/)
  })
})

test.describe('Learn - Table of Contents', () => {
  test('TOC shows article sections', async ({ page }) => {
    await page.goto('/learn/know-yourself/why-self-awareness-matters/')

    if (isMobile(page)) {
      // On mobile, TOC is in a collapsible - skip this test
      // Mobile TOC is tested separately
      test.skip()
      return
    }

    // Desktop: Check that right sidebar TOC exists with article headings
    // Look for TOC links that point to anchor headings
    const tocLinks = page.locator('starlight-toc a[href*="#"], [class*="toc"] a[href*="#"]')
    const count = await tocLinks.count()

    // Should have multiple TOC entries for this article
    expect(count).toBeGreaterThan(3)
  })

  test('TOC links scroll to sections', async ({ page }) => {
    await page.goto('/learn/know-yourself/why-self-awareness-matters/')

    // Skip on mobile for this test
    if (isMobile(page)) {
      test.skip()
      return
    }

    // Find a TOC link and click it
    const tocLink = page.locator('starlight-toc a[href*="#"]').first()
    if (await tocLink.isVisible()) {
      const href = await tocLink.getAttribute('href')
      await tocLink.click()

      // Verify URL has the hash
      await expect(page).toHaveURL(new RegExp(href!.replace('#', '.*#')))
    }
  })
})

test.describe('Learn - PWA', () => {
  test('manifest is linked correctly', async ({ page }) => {
    await page.goto('/learn/')

    // Check manifest link exists
    const manifestLink = page.locator('link[rel="manifest"]')
    await expect(manifestLink).toHaveAttribute('href', '/manifest.webmanifest')
  })

  test('service worker registration script is present', async ({ page }) => {
    await page.goto('/learn/')

    // Check registerSW.js script is loaded
    const swScript = page.locator('script[src="/registerSW.js"]')
    await expect(swScript).toBeAttached()
  })

  test('service worker registers successfully', async ({ page, context }) => {
    await page.goto('/learn/')

    // Wait for service worker to register
    await page.waitForTimeout(2000)

    // Check if service worker is registered
    const swRegistered = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return false
      const registrations = await navigator.serviceWorker.getRegistrations()
      return registrations.some((reg) => reg.scope.includes('/learn'))
    })

    expect(swRegistered).toBe(true)
  })
})

test.describe('Learn - Styling & Theme', () => {
  test('dark theme is applied', async ({ page }) => {
    await page.goto('/learn/')

    // Check dark background
    const body = page.locator('body')
    // The background should be dark (#0a0a0a = rgb(10, 10, 10))
    await expect(body).toHaveCSS('background-color', 'rgb(10, 10, 10)')
  })

  test('accent color (amber) is used for links', async ({ page }) => {
    await page.goto('/learn/know-yourself/why-self-awareness-matters/')

    // Check that content links have amber color
    const contentLink = page.locator('.sl-markdown-content a').first()
    if (await contentLink.isVisible()) {
      // Amber accent is approximately rgb(230, 126, 34) = #e67e22
      const color = await contentLink.evaluate((el) => getComputedStyle(el).color)
      expect(color).toMatch(/rgb\(230, 126, 34\)|rgb\(243, 156, 18\)/)
    }
  })
})

test.describe('Learn - Accessibility', () => {
  test('skip to content link exists', async ({ page }) => {
    await page.goto('/learn/')

    const skipLink = page.getByRole('link', { name: /Skip to content/i })
    await expect(skipLink).toBeAttached()
  })

  test('main heading has correct hierarchy', async ({ page }) => {
    await page.goto('/learn/know-yourself/why-self-awareness-matters/')

    // There should be exactly one h1
    const h1s = page.locator('h1')
    await expect(h1s).toHaveCount(1)

    // h2s should be present for sections
    const h2s = page.locator('h2')
    expect(await h2s.count()).toBeGreaterThan(0)
  })

  test('images have alt text', async ({ page }) => {
    await page.goto('/learn/')

    const images = page.locator('img:not([alt=""])')
    const count = await images.count()

    // All visible images should have alt attributes
    for (let i = 0; i < count; i++) {
      const img = images.nth(i)
      if (await img.isVisible()) {
        await expect(img).toHaveAttribute('alt')
      }
    }
  })

  test('navigation landmarks are present', async ({ page }) => {
    // Use an article page where sidebar is always present
    await page.goto('/learn/know-yourself/why-self-awareness-matters/')

    // Main content should always be present and visible
    await expect(page.getByRole('main')).toBeVisible()

    // Header should be present
    await expect(page.locator('header')).toBeVisible()

    // On desktop, sidebar nav content should be visible (sidebar-content)
    if (!isMobile(page)) {
      await expect(page.locator('.sidebar-content')).toBeVisible()
    }
  })
})

test.describe('Learn - Search', () => {
  test('search button is visible', async ({ page }) => {
    await page.goto('/learn/')

    const searchButton = page.getByRole('button', { name: /Search/i })
    await expect(searchButton).toBeVisible()
  })

  test('search modal opens on click', async ({ page }) => {
    await page.goto('/learn/')

    // Click search button
    await page.getByRole('button', { name: /Search/i }).click()

    // Check search modal/dialog appears
    const searchInput = page.locator('input[type="search"], input[placeholder*="Search"]')
    await expect(searchInput).toBeVisible()
  })
})

test.describe('Learn - Content Modules', () => {
  const modules = [
    { path: '/learn/know-yourself/why-self-awareness-matters/', title: 'Self-Awareness' },
    { path: '/learn/attraction/limerence-vs-love/', title: 'Limerence' },
    { path: '/learn/compatibility/values-alignment/', title: 'Values' },
    { path: '/learn/building-real/what-makes-relationships-last/', title: 'Relationships Last' },
    { path: '/learn/neurodivergent/adhd-in-relationships/', title: 'ADHD' },
    { path: '/learn/communication/the-art-of-questions/', title: 'Questions' },
  ]

  for (const mod of modules) {
    test(`module page loads: ${mod.title}`, async ({ page }) => {
      await page.goto(mod.path)

      // Page should load without errors
      await expect(page.locator('h1')).toBeVisible()

      // Content area should be present
      await expect(page.locator('.sl-markdown-content')).toBeVisible()
    })
  }
})
