import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { fetchClient } from '../api/client'
import type { components } from '../api/schema'

type User = components['schemas']['UserResponse']

interface AuthState {
  isAuthenticated: boolean
  isLoading: boolean
  user: User | null
}

interface AuthContextType extends AuthState {
  login: () => void
  logout: () => Promise<void>
  checkAuth: () => Promise<boolean>
  refetchUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    isLoading: true, // Start loading to verify auth on mount
    user: null,
  })

  const fetchUser = useCallback(async (): Promise<User | null> => {
    const { data, error } = await fetchClient.GET('/v1/users/me', {})
    if (error || !data) return null
    return data
  }, [])

  const refetchUser = useCallback(async () => {
    const user = await fetchUser()
    if (user) {
      setState((prev) => ({ ...prev, user }))
    }
  }, [fetchUser])

  const login = useCallback(async () => {
    // Called after successful login API call
    // Cookies are set by the server, fetch user data
    const user = await fetchUser()
    setState({
      isAuthenticated: true,
      isLoading: false,
      user,
    })
  }, [fetchUser])

  const logout = useCallback(async () => {
    try {
      // Call logout endpoint to clear cookies on server
      await fetchClient.POST('/v1/auth/logout', {})
    } catch {
      // Ignore errors, still clear local state
    }
    setState({
      isAuthenticated: false,
      isLoading: false,
      user: null,
    })
  }, [])

  const checkAuth = useCallback(async (): Promise<boolean> => {
    try {
      // Try to refresh tokens - if successful, we have valid auth
      const { error } = await fetchClient.POST('/v1/auth/refresh', {})

      if (error) {
        setState({ isAuthenticated: false, isLoading: false, user: null })
        return false
      }

      const user = await fetchUser()
      setState({ isAuthenticated: true, isLoading: false, user })
      return true
    } catch {
      setState({ isAuthenticated: false, isLoading: false, user: null })
      return false
    }
  }, [fetchUser])

  // Check auth status on mount by attempting to refresh
  useEffect(() => {
    let cancelled = false

    async function verifyAuth() {
      try {
        const { error } = await fetchClient.POST('/v1/auth/refresh', {})
        if (cancelled) return

        if (error) {
          setState({ isAuthenticated: false, isLoading: false, user: null })
          return
        }

        const user = await fetchUser()
        if (!cancelled) {
          setState({
            isAuthenticated: true,
            isLoading: false,
            user,
          })
        }
      } catch {
        if (!cancelled) {
          setState({ isAuthenticated: false, isLoading: false, user: null })
        }
      }
    }

    verifyAuth()

    return () => {
      cancelled = true
    }
  }, [fetchUser])

  // Set up token refresh interval (refresh 5 minutes before expiry, assuming 30 min token)
  useEffect(() => {
    if (!state.isAuthenticated) return

    const refreshInterval = setInterval(
      () => {
        checkAuth()
      },
      25 * 60 * 1000
    ) // 25 minutes

    return () => clearInterval(refreshInterval)
  }, [state.isAuthenticated, checkAuth])

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        logout,
        checkAuth,
        refetchUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
