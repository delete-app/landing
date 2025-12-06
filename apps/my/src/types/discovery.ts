export interface DiscoveryPhoto {
  id: string
  url: string
  order: number
}

export interface DiscoveryPrompt {
  id: string
  question: string
  answer: string
}

export interface DiscoveryBadge {
  id: string
  label: string
  description: string
}

export interface DiscoveryProfile {
  id: string
  name: string
  /** Age calculated server-side from birth_date - PII never sent to client */
  age: number | null
  bio: string | null
  location: string | null
  photos: DiscoveryPhoto[]
  prompts: DiscoveryPrompt[]
  badges: DiscoveryBadge[]
}

export interface DailyDiscoveryState {
  /** Profiles available today */
  profiles: DiscoveryProfile[]
  /** Index of current profile being viewed */
  currentIndex: number
  /** Whether free pick has been used today */
  freePickUsed: boolean
  /** IDs of profiles user has expressed interest in */
  interestedIds: string[]
  /** IDs of profiles user has passed on */
  passedIds: string[]
  /** Date string for when this state was created (YYYY-MM-DD) */
  date: string
}

export type InterestType = 'free_pick' | 'earned'

export interface InterestRecord {
  profileId: string
  type: InterestType
  timestamp: string
}
