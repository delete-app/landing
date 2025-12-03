import createFetchClient, { type Middleware } from 'openapi-fetch'
import createQueryClient from 'openapi-react-query'
import type { paths } from './schema'
import { config } from '../config'

// Store logout function to avoid circular dependency with auth context
let logoutFn: (() => void) | null = null

export function setLogoutHandler(fn: () => void) {
  logoutFn = fn
}

/**
 * Middleware for logging requests/responses in dev mode
 */
const loggingMiddleware: Middleware = {
  async onRequest({ request }) {
    if (import.meta.env.DEV) {
      console.log(`[API] ${request.method} ${request.url}`)
    }
    return request
  },
  async onResponse({ response }) {
    if (import.meta.env.DEV) {
      const status = response.status
      const statusColor = status >= 400 ? '\x1b[31m' : '\x1b[32m'
      console.log(`[API] ${statusColor}${status}\x1b[0m ${response.url}`)
    }
    return response
  },
}

/**
 * Middleware for handling 401 responses globally
 */
const authMiddleware: Middleware = {
  async onResponse({ response }) {
    if (response.status === 401) {
      // Trigger logout for any 401 except the login endpoint itself
      if (!response.url.includes('/auth/login') && logoutFn) {
        logoutFn()
      }
    }
    return response
  },
}

/**
 * Single typed fetch client for direct API calls.
 * Use this for non-React contexts (e.g., auth context).
 *
 * credentials: 'include' ensures cookies are sent with cross-origin requests,
 * which is required for HttpOnly cookie-based authentication across subdomains.
 */
export const fetchClient = createFetchClient<paths>({
  baseUrl: config.apiUrl,
  credentials: 'include',
})

// Register middleware
fetchClient.use(loggingMiddleware)
fetchClient.use(authMiddleware)

/**
 * React Query hooks for API calls.
 * Use this in React components for automatic caching, refetching, etc.
 */
export const $api = createQueryClient(fetchClient)
