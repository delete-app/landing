import createFetchClient from 'openapi-fetch'
import createClient from 'openapi-react-query'
import type { paths } from './schema'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const fetchClient = createFetchClient<paths>({
  baseUrl: API_URL,
})

export const $api = createClient(fetchClient)
