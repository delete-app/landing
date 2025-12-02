import createClient from 'openapi-fetch'
import type { paths } from './schema'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export const apiClient = createClient<paths>({
  baseUrl: API_URL,
})
