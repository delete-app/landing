import { defineConfig, devices } from '@playwright/test'

// Determine which webservers to start based on which projects are being run
// This is controlled via environment variable or defaults to all
const projectFilter = process.env.PLAYWRIGHT_PROJECT || ''

const webServers = []

// Only start my-app server if running my-app tests
if (!projectFilter || projectFilter.includes('my-app')) {
  webServers.push({
    command: 'pnpm --filter @delete/my dev',
    url: 'http://localhost:5174',
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
  })
}

// Only start landing server if running learn tests
if (!projectFilter || projectFilter.includes('learn')) {
  webServers.push({
    command: 'pnpm --filter @delete/landing preview',
    url: 'http://localhost:4321',
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
  })
}

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    trace: 'on-first-retry',
  },
  projects: [
    // My App tests (React SPA)
    {
      name: 'my-app',
      use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:5174' },
      testMatch: /my-app\.spec\.ts/,
    },
    // Landing/Learn tests - Desktop
    {
      name: 'learn-desktop',
      use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:4321' },
      testMatch: /learn.*\.spec\.ts/,
    },
    // Landing/Learn tests - Mobile (using Chromium with mobile viewport)
    {
      name: 'learn-mobile',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 375, height: 812 },
        isMobile: true,
        hasTouch: true,
        baseURL: 'http://localhost:4321',
      },
      testMatch: /learn.*\.spec\.ts/,
    },
    // Design capture
    {
      name: 'design-capture',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
      testMatch: /capture-design-references\.ts/,
    },
  ],
  webServer: webServers.length > 0 ? webServers : undefined,
})
