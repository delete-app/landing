import { useState, useCallback, useEffect } from 'react'
import type { DiscoveryProfile, DailyDiscoveryState, InterestType } from '../types/discovery'

const DAILY_PROFILE_LIMIT = 5
const STORAGE_KEY = 'delete_discovery_state'

// Get today's date as YYYY-MM-DD
function getTodayDate(): string {
  return new Date().toISOString().split('T')[0]
}

// Mock profiles for development - age is pre-calculated (server-side in production)
// Note: In production, PII like birth_date is never sent to client - only derived age
const MOCK_PROFILES: DiscoveryProfile[] = [
  {
    id: '1',
    name: 'Priya',
    age: 27,
    bio: 'Software engineer by day, amateur chef by night. Looking for someone who appreciates both good code and good food.',
    location: 'Bangalore',
    photos: [
      {
        id: 'p1',
        url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=600&fit=crop',
        order: 0,
      },
      {
        id: 'p2',
        url: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400&h=600&fit=crop',
        order: 1,
      },
    ],
    prompts: [
      {
        id: 'pr1',
        question: 'A perfect Sunday looks like...',
        answer: 'Morning run, filter coffee at a local cafe, and catching up on my reading list.',
      },
      {
        id: 'pr2',
        question: 'I geek out on...',
        answer: 'System design, mechanical keyboards, and finding the best biryani in the city.',
      },
    ],
    badges: [{ id: 'b1', label: 'Deep Thinker', description: 'Values meaningful conversations' }],
  },
  {
    id: '2',
    name: 'Arjun',
    age: 29,
    bio: 'Product manager who believes in building things that matter. Weekend trekker and amateur photographer.',
    location: 'Mumbai',
    photos: [
      {
        id: 'p3',
        url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=600&fit=crop',
        order: 0,
      },
      {
        id: 'p4',
        url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=600&fit=crop',
        order: 1,
      },
    ],
    prompts: [
      {
        id: 'pr3',
        question: 'The way to my heart is...',
        answer: 'Through thoughtful conversations and spontaneous road trips.',
      },
    ],
    badges: [{ id: 'b2', label: 'Adventure Seeker', description: 'Loves exploring new places' }],
  },
  {
    id: '3',
    name: 'Meera',
    age: 26,
    bio: 'UX designer passionate about making technology more human. Plant parent of 12 (and counting).',
    location: 'Delhi',
    photos: [
      {
        id: 'p5',
        url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=600&fit=crop',
        order: 0,
      },
    ],
    prompts: [
      {
        id: 'pr4',
        question: "I'm looking for...",
        answer: 'Someone who can appreciate comfortable silences as much as deep conversations.',
      },
      {
        id: 'pr5',
        question: 'My simple pleasures...',
        answer:
          'Morning chai on the balcony, Sunday farmers markets, and getting lost in a good book.',
      },
    ],
    badges: [],
  },
  {
    id: '4',
    name: 'Vikram',
    age: 30,
    bio: 'Data scientist who finds patterns everywhere. Music producer on weekends. Believer in slow living.',
    location: 'Bangalore',
    photos: [
      {
        id: 'p6',
        url: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=600&fit=crop',
        order: 0,
      },
      {
        id: 'p7',
        url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=600&fit=crop',
        order: 1,
      },
    ],
    prompts: [
      {
        id: 'pr6',
        question: 'My ideal weekend...',
        answer: 'Vinyl records, homemade pasta, and no plans beyond that.',
      },
    ],
    badges: [{ id: 'b3', label: 'Creative Soul', description: 'Expresses through art and music' }],
  },
  {
    id: '5',
    name: 'Ananya',
    age: 28,
    bio: 'Lawyer by profession, writer by passion. Collecting stories and making sense of the world one conversation at a time.',
    location: 'Chennai',
    photos: [
      {
        id: 'p8',
        url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&h=600&fit=crop',
        order: 0,
      },
    ],
    prompts: [
      {
        id: 'pr7',
        question: 'I value...',
        answer: 'Honesty, intellectual curiosity, and people who can laugh at themselves.',
      },
      {
        id: 'pr8',
        question: 'Green flags I look for...',
        answer: 'Good listeners, people who read, and those who are kind to service staff.',
      },
    ],
    badges: [{ id: 'b4', label: 'Thoughtful', description: 'Takes time to understand others' }],
  },
]

function loadState(): DailyDiscoveryState | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return null
    return JSON.parse(stored) as DailyDiscoveryState
  } catch {
    return null
  }
}

function saveState(state: DailyDiscoveryState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

function createInitialState(): DailyDiscoveryState {
  return {
    profiles: MOCK_PROFILES.slice(0, DAILY_PROFILE_LIMIT),
    currentIndex: 0,
    freePickUsed: false,
    interestedIds: [],
    passedIds: [],
    date: getTodayDate(),
  }
}

export function useDiscovery() {
  const [state, setState] = useState<DailyDiscoveryState>(() => {
    const stored = loadState()
    const today = getTodayDate()

    // If stored state is from a different day, reset
    if (!stored || stored.date !== today) {
      const initial = createInitialState()
      saveState(initial)
      return initial
    }

    return stored
  })

  // Persist state changes
  useEffect(() => {
    saveState(state)
  }, [state])

  const currentProfile = state.profiles[state.currentIndex] ?? null
  const isComplete = state.currentIndex >= state.profiles.length
  const viewedCount = state.interestedIds.length + state.passedIds.length
  const isFreePick = !state.freePickUsed

  const expressInterest = useCallback(
    (type: InterestType) => {
      if (!currentProfile) return

      setState((prev) => ({
        ...prev,
        currentIndex: prev.currentIndex + 1,
        freePickUsed: type === 'free_pick' ? true : prev.freePickUsed,
        interestedIds: [...prev.interestedIds, currentProfile.id],
      }))
    },
    [currentProfile]
  )

  const pass = useCallback(() => {
    if (!currentProfile) return

    setState((prev) => ({
      ...prev,
      currentIndex: prev.currentIndex + 1,
      passedIds: [...prev.passedIds, currentProfile.id],
    }))
  }, [currentProfile])

  const resetForTesting = useCallback(() => {
    const initial = createInitialState()
    setState(initial)
    saveState(initial)
  }, [])

  return {
    currentProfile,
    isComplete,
    isFreePick,
    viewedCount,
    totalProfiles: state.profiles.length,
    interestedCount: state.interestedIds.length,
    expressInterest,
    pass,
    resetForTesting,
  }
}
