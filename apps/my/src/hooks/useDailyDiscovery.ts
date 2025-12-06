/**
 * Hook for daily discovery with server-side time validation.
 *
 * This hook manages the daily discovery flow using React Query:
 * - Fetches daily profiles from server
 * - Tracks view start time (server-side)
 * - Validates minimum view time before expressing interest
 * - First pick is free, subsequent picks require earned time
 */

import { useCallback, useMemo, useState } from 'react'
import { $api } from '../lib/api/client'
import type { components } from '../lib/api/schema'

// Type aliases from generated schema
type DailyDiscoveryProfileOut = components['schemas']['DailyDiscoveryProfileOut']
type InterestType = components['schemas']['InterestType']

interface UseDailyDiscoveryResult {
  // State
  isLoading: boolean
  error: string | null

  // Current profile
  currentProfile: DailyDiscoveryProfileOut | null
  activeViewId: string | null
  viewStartedAt: Date | null

  // Progress
  isComplete: boolean
  isFreePick: boolean
  viewedCount: number
  totalProfiles: number
  interestedCount: number

  // Mutation states
  isStartingView: boolean
  isExpressingInterest: boolean
  isPassing: boolean

  // Actions
  startView: () => Promise<void>
  expressInterest: () => Promise<{ success: boolean; interestType?: InterestType; error?: string }>
  pass: () => Promise<{ success: boolean; error?: string }>
  resetForTesting: () => Promise<void>
}

export function useDailyDiscovery(): UseDailyDiscoveryResult {
  const [localActiveViewId, setLocalActiveViewId] = useState<string | null>(null)
  const [localViewStartedAt, setLocalViewStartedAt] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Fetch daily discovery state with React Query
  const {
    data: discoveryData,
    isLoading,
    refetch,
  } = $api.useQuery('get', '/v1/daily-discovery', undefined, {
    staleTime: 0, // Always refetch to get latest state
  })

  // Mutations using React Query
  const startViewMutation = $api.useMutation('post', '/v1/daily-discovery/view/start')
  const expressInterestMutation = $api.useMutation('post', '/v1/daily-discovery/interest')
  const passMutation = $api.useMutation('post', '/v1/daily-discovery/pass')
  const resetMutation = $api.useMutation('post', '/v1/daily-discovery/reset')

  // Extract state from response
  const state = discoveryData?.state
  const currentProfile = discoveryData?.current_profile ?? null

  // Derive active view from server or local state
  const activeViewId = useMemo(
    () => localActiveViewId ?? discoveryData?.active_view_id ?? null,
    [localActiveViewId, discoveryData?.active_view_id]
  )

  // Derive view start time from local state or server data
  const serverViewStartedAt = discoveryData?.active_view_started_at
  const viewStartedAt = useMemo(() => {
    if (localViewStartedAt) return localViewStartedAt
    if (serverViewStartedAt) {
      return new Date(serverViewStartedAt)
    }
    return null
  }, [localViewStartedAt, serverViewStartedAt])

  // Start viewing current profile
  const startView = useCallback(async () => {
    if (!currentProfile) return

    try {
      setError(null)
      const data = await startViewMutation.mutateAsync({
        body: { profile_id: currentProfile.id },
      })

      if (data) {
        setLocalActiveViewId(data.view_id)
        setLocalViewStartedAt(new Date(data.started_at))
      }
    } catch {
      setError('Failed to start view')
    }
  }, [currentProfile, startViewMutation])

  // Express interest in current profile
  const expressInterest = useCallback(async (): Promise<{
    success: boolean
    interestType?: InterestType
    error?: string
  }> => {
    if (!activeViewId) {
      return { success: false, error: 'No active view' }
    }

    try {
      setError(null)
      const data = await expressInterestMutation.mutateAsync({
        body: { view_id: activeViewId },
      })

      // Reset view state and refetch
      setLocalActiveViewId(null)
      setLocalViewStartedAt(null)
      await refetch()

      return {
        success: true,
        interestType: data.interest_type ?? undefined,
      }
    } catch (e) {
      const errorMsg = (e as { detail?: string })?.detail || 'Failed to express interest'
      setError(errorMsg)
      return { success: false, error: errorMsg }
    }
  }, [activeViewId, expressInterestMutation, refetch])

  // Pass on current profile
  const pass = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    if (!activeViewId) {
      return { success: false, error: 'No active view' }
    }

    try {
      setError(null)
      await passMutation.mutateAsync({
        body: { view_id: activeViewId },
      })

      // Reset view state and refetch
      setLocalActiveViewId(null)
      setLocalViewStartedAt(null)
      await refetch()

      return { success: true }
    } catch (e) {
      const errorMsg = (e as { detail?: string })?.detail || 'Failed to pass'
      setError(errorMsg)
      return { success: false, error: errorMsg }
    }
  }, [activeViewId, passMutation, refetch])

  // Reset for testing (dev only)
  const resetForTesting = useCallback(async () => {
    try {
      await resetMutation.mutateAsync({})
      setLocalActiveViewId(null)
      setLocalViewStartedAt(null)
      setError(null)
      await refetch()
    } catch (e) {
      console.error('Failed to reset:', e)
    }
  }, [resetMutation, refetch])

  return {
    // State
    isLoading,
    error,

    // Current profile
    currentProfile,
    activeViewId,
    viewStartedAt,

    // Progress
    isComplete: state?.is_complete ?? false,
    isFreePick: state?.is_free_pick ?? true,
    viewedCount: state?.viewed_count ?? 0,
    totalProfiles: state?.total_profiles ?? 0,
    interestedCount: state?.interested_count ?? 0,

    // Mutation states
    isStartingView: startViewMutation.isPending,
    isExpressingInterest: expressInterestMutation.isPending,
    isPassing: passMutation.isPending,

    // Actions
    startView,
    expressInterest,
    pass,
    resetForTesting,
  }
}
