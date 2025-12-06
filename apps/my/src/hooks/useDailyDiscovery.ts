/**
 * Hook for daily discovery with server-side time validation.
 *
 * This hook manages the daily discovery flow using React Query:
 * - Fetches daily profiles from server
 * - Auto-starts views when profile changes (encapsulated here, not in component)
 * - Tracks view timer state
 * - Validates minimum view time before expressing interest
 * - First pick is free, subsequent picks require earned time
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { $api } from '../lib/api/client'
import type { components } from '../lib/api/schema'

// Type aliases from generated schema
type DailyDiscoveryProfileOut = components['schemas']['DailyDiscoveryProfileOut']
type InterestType = components['schemas']['InterestType']

const MINIMUM_VIEW_TIME = 20 // seconds

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

  // Timer state (managed internally)
  isTimerComplete: boolean
  remainingTime: number

  // Mutation states
  isStartingView: boolean
  isExpressingInterest: boolean
  isPassing: boolean

  // Actions (no startView - it's automatic now)
  expressInterest: () => Promise<{ success: boolean; interestType?: InterestType; error?: string }>
  pass: () => Promise<{ success: boolean; error?: string }>
  resetForTesting: () => Promise<void>
}

export function useDailyDiscovery(): UseDailyDiscoveryResult {
  const [localActiveViewId, setLocalActiveViewId] = useState<string | null>(null)
  const [localViewStartedAt, setLocalViewStartedAt] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Timer state - track per profile using Maps to avoid effect-based state resets
  const [profileTimerState, setProfileTimerState] = useState<Map<string, number>>(new Map())
  const [completedProfileIds, setCompletedProfileIds] = useState<Set<string>>(new Set())
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Track which profile we've started a view for to prevent double-starts
  const startedViewForProfileRef = useRef<string | null>(null)

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
  const currentProfileId = currentProfile?.id ?? null

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

  // Timer completion derived from set
  const isTimerComplete = currentProfileId ? completedProfileIds.has(currentProfileId) : false

  // Get remaining time for current profile from map, defaulting to full time for new profiles
  const remainingTime = currentProfileId
    ? (profileTimerState.get(currentProfileId) ?? MINIMUM_VIEW_TIME)
    : MINIMUM_VIEW_TIME

  // Auto-start view when profile changes (internal effect)
  // We use a ref to track which profile we've started, not setState
  useEffect(() => {
    // Skip if no profile, already have active view, or already starting for this profile
    if (
      !currentProfileId ||
      activeViewId ||
      startedViewForProfileRef.current === currentProfileId
    ) {
      return
    }

    // Mark that we're starting for this profile (ref update, not state)
    startedViewForProfileRef.current = currentProfileId

    // Start the view
    const doStartView = async () => {
      try {
        setError(null)
        const data = await startViewMutation.mutateAsync({
          body: { profile_id: currentProfileId },
        })

        if (data) {
          setLocalActiveViewId(data.view_id)
          setLocalViewStartedAt(new Date(data.started_at))
        }
      } catch {
        setError('Failed to start view')
        // Reset so we can retry
        startedViewForProfileRef.current = null
      }
    }

    doStartView()
  }, [currentProfileId, activeViewId, startViewMutation])

  // Timer countdown effect
  useEffect(() => {
    // Clear any existing timer
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }

    // Don't run timer if no profile or already complete
    if (!currentProfileId || isTimerComplete) {
      return
    }

    // Start countdown - update the Map for this specific profile
    timerRef.current = setInterval(() => {
      setProfileTimerState((prevMap) => {
        const currentTime = prevMap.get(currentProfileId) ?? MINIMUM_VIEW_TIME
        if (currentTime <= 1) {
          // Timer complete - add to completed set
          setCompletedProfileIds((ids) => new Set(ids).add(currentProfileId))
          if (timerRef.current) {
            clearInterval(timerRef.current)
            timerRef.current = null
          }
          const newMap = new Map(prevMap)
          newMap.set(currentProfileId, 0)
          return newMap
        }
        const newMap = new Map(prevMap)
        newMap.set(currentProfileId, currentTime - 1)
        return newMap
      })
    }, 1000)

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [currentProfileId, isTimerComplete])

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

    // Timer state (managed internally)
    isTimerComplete,
    remainingTime,

    // Mutation states
    isStartingView: startViewMutation.isPending,
    isExpressingInterest: expressInterestMutation.isPending,
    isPassing: passMutation.isPending,

    // Actions
    expressInterest,
    pass,
    resetForTesting,
  }
}
