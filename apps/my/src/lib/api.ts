const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export async function apiFetch(path: string, options?: RequestInit) {
  const url = `${API_URL}${path}`
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })
  return res
}

export const api = {
  auth: {
    login: (email: string, password: string) =>
      apiFetch('/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    signup: (name: string, email: string, password: string) =>
      apiFetch('/v1/auth/signup', {
        method: 'POST',
        body: JSON.stringify({ name, email, password }),
      }),
  },
}
