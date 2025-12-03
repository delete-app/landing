import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { $api } from '../lib/api/client'
import { useAuth } from '../lib/auth/context'
import { Button, Input, Textarea, Label } from '../components/ui'
import { notify } from '../lib/toast'

type Step = 'basics' | 'details' | 'preferences' | 'quiz'

// Quiz questions for personality assessment
const QUIZ_QUESTIONS = [
  {
    key: 'introvert_extrovert',
    question: 'After a long week, I recharge by...',
    left: 'Quiet time alone',
    right: 'Going out with friends',
  },
  {
    key: 'planner_spontaneous',
    question: 'When it comes to plans, I prefer...',
    left: 'Having a schedule',
    right: 'Going with the flow',
  },
  {
    key: 'conflict_style',
    question: "When there's a disagreement, I tend to...",
    left: 'Talk it out right away',
    right: 'Need space to process',
  },
  {
    key: 'alone_time',
    question: 'In a relationship, I need...',
    left: 'Lots of together time',
    right: 'Regular alone time',
  },
  {
    key: 'decision_speed',
    question: 'When making decisions, I...',
    left: 'Take my time to think',
    right: 'Decide quickly and move on',
  },
  {
    key: 'novelty_needs',
    question: 'I find comfort in...',
    left: 'Familiar routines',
    right: 'New experiences',
  },
]

// Calculate max birth date for 18+ requirement (computed once at module load)
const getMaxBirthDate = () => {
  const minAgeYears = 18
  const msPerYear = 365.25 * 24 * 60 * 60 * 1000
  return new Date(Date.now() - minAgeYears * msPerYear).toISOString().split('T')[0]
}
const MAX_BIRTH_DATE = getMaxBirthDate()

export default function Onboarding() {
  const navigate = useNavigate()
  const { refetchUser } = useAuth()
  const [step, setStep] = useState<Step>('basics')

  // Form state
  const [name, setName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [gender, setGender] = useState('')
  const [bio, setBio] = useState('')
  const [location, setLocation] = useState('')
  const [lookingFor, setLookingFor] = useState('')
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({})
  const [currentQuizIndex, setCurrentQuizIndex] = useState(0)

  const updateMutation = $api.useMutation('patch', '/v1/users/me', {
    onSuccess: async () => {
      if (step === 'basics') {
        setStep('details')
      } else if (step === 'details') {
        setStep('preferences')
      } else if (step === 'preferences') {
        setStep('quiz')
      }
    },
    onError: (err) => {
      notify.error(err.detail?.[0]?.msg || 'Failed to save')
    },
  })

  const quizMutation = $api.useMutation('post', '/v1/profile/quiz', {
    onSuccess: async () => {
      // Refetch user to update profile_complete in auth context
      await refetchUser()
      notify.success('Profile complete!')
      navigate('/dashboard')
    },
    onError: (err) => {
      notify.error(err.detail?.[0]?.msg || 'Failed to save quiz')
    },
  })

  function handleBasics(e: React.FormEvent) {
    e.preventDefault()
    updateMutation.mutate({
      body: {
        name,
        birth_date: birthDate || undefined,
        gender: gender || undefined,
      },
    })
  }

  function handleDetails(e: React.FormEvent) {
    e.preventDefault()
    updateMutation.mutate({
      body: {
        bio: bio || undefined,
        location: location || undefined,
      },
    })
  }

  function handlePreferences(e: React.FormEvent) {
    e.preventDefault()
    updateMutation.mutate({
      body: {
        looking_for: lookingFor || undefined,
      },
    })
  }

  function handleQuizAnswer(value: number) {
    const currentQuestion = QUIZ_QUESTIONS[currentQuizIndex]
    const newAnswers = { ...quizAnswers, [currentQuestion.key]: value }
    setQuizAnswers(newAnswers)

    if (currentQuizIndex < QUIZ_QUESTIONS.length - 1) {
      // Move to next question
      setCurrentQuizIndex(currentQuizIndex + 1)
    } else {
      // Submit quiz
      const answers = Object.entries(newAnswers).map(([key, val]) => ({
        question_key: key,
        answer_value: val,
      }))
      quizMutation.mutate({ body: { answers } })
    }
  }

  return (
    <div className="max-w-md mx-auto pt-8">
      <div className="flex items-center justify-center mb-12">
        <div
          className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm transition-all ${
            step === 'basics' ? 'border-text bg-text text-bg' : 'border-border text-text-dim'
          }`}
        >
          1
        </div>
        <div className="w-15 h-0.5 bg-border mx-2" />
        <div
          className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm transition-all ${
            step === 'details' ? 'border-text bg-text text-bg' : 'border-border text-text-dim'
          }`}
        >
          2
        </div>
        <div className="w-15 h-0.5 bg-border mx-2" />
        <div
          className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm transition-all ${
            step === 'preferences' ? 'border-text bg-text text-bg' : 'border-border text-text-dim'
          }`}
        >
          3
        </div>
        <div className="w-15 h-0.5 bg-border mx-2" />
        <div
          className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm transition-all ${
            step === 'quiz' ? 'border-text bg-text text-bg' : 'border-border text-text-dim'
          }`}
        >
          4
        </div>
      </div>

      {step === 'basics' && (
        <form onSubmit={handleBasics} className="flex flex-col gap-6">
          <h2 className="text-2xl font-medium mb-0">Let's get to know you</h2>
          <p className="text-text-dim text-sm -mt-4">Tell us the basics</p>

          <div className="flex flex-col gap-2">
            <Label>Your name</Label>
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="What should we call you?"
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Birthday</Label>
            <Input
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              max={MAX_BIRTH_DATE}
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>I am</Label>
            <div className="flex gap-2 flex-wrap">
              {['male', 'female', 'non-binary', 'other'].map((g) => (
                <Button
                  key={g}
                  type="button"
                  variant="chip"
                  size="sm"
                  selected={gender === g}
                  onClick={() => setGender(g)}
                  className="flex-1 min-w-[100px]"
                >
                  {g.charAt(0).toUpperCase() + g.slice(1).replace('-', ' ')}
                </Button>
              ))}
            </div>
          </div>

          <Button
            type="submit"
            disabled={updateMutation.isPending || !name || !birthDate || !gender}
            className="mt-4"
          >
            {updateMutation.isPending ? 'Saving...' : 'Continue'}
          </Button>
        </form>
      )}

      {step === 'details' && (
        <form onSubmit={handleDetails} className="flex flex-col gap-6">
          <h2 className="text-2xl font-medium mb-0">Add some details</h2>
          <p className="text-text-dim text-sm -mt-4">Help others get to know you</p>

          <div className="flex flex-col gap-2">
            <Label>About you</Label>
            <Textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Write a short bio..."
              rows={4}
              maxLength={500}
            />
            <span className="text-xs text-text-dimmer text-right">{bio.length}/500</span>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Location</Label>
            <Input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="City, Country"
            />
          </div>

          <div className="flex gap-4 mt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setStep('basics')}
              className="flex-1"
            >
              Back
            </Button>
            <Button type="submit" disabled={updateMutation.isPending} className="flex-1">
              {updateMutation.isPending ? 'Saving...' : 'Continue'}
            </Button>
          </div>
        </form>
      )}

      {step === 'preferences' && (
        <form onSubmit={handlePreferences} className="flex flex-col gap-6">
          <h2 className="text-2xl font-medium mb-0">Who are you looking for?</h2>
          <p className="text-text-dim text-sm -mt-4">We'll help you find the right match</p>

          <div className="flex flex-col gap-2">
            <Label>I'm interested in</Label>
            <div className="flex gap-2 flex-wrap">
              {[
                { value: 'male', label: 'Men' },
                { value: 'female', label: 'Women' },
                { value: 'everyone', label: 'Everyone' },
              ].map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  variant="chip"
                  size="sm"
                  selected={lookingFor === option.value}
                  onClick={() => setLookingFor(option.value)}
                  className="flex-1 min-w-[100px]"
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex gap-4 mt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setStep('details')}
              className="flex-1"
            >
              Back
            </Button>
            <Button
              type="submit"
              disabled={updateMutation.isPending || !lookingFor}
              className="flex-1"
            >
              {updateMutation.isPending ? 'Saving...' : 'Continue'}
            </Button>
          </div>
        </form>
      )}

      {step === 'quiz' && (
        <div className="flex flex-col gap-6">
          <h2 className="text-2xl font-medium mb-0">Quick personality check</h2>
          <p className="text-text-dim text-sm -mt-4">
            Help us find compatible matches ({currentQuizIndex + 1}/{QUIZ_QUESTIONS.length})
          </p>

          <div className="flex flex-col gap-6">
            <p className="text-lg text-center py-4">{QUIZ_QUESTIONS[currentQuizIndex].question}</p>

            {/* Scale from 1-5 */}
            <div className="flex flex-col gap-3">
              <div className="flex justify-between text-sm text-text-dim px-1">
                <span>{QUIZ_QUESTIONS[currentQuizIndex].left}</span>
                <span>{QUIZ_QUESTIONS[currentQuizIndex].right}</span>
              </div>
              <div className="flex gap-2 justify-center">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => handleQuizAnswer(value)}
                    disabled={quizMutation.isPending}
                    className={`w-12 h-12 rounded-full border-2 transition-all hover:border-text hover:bg-text hover:text-bg ${
                      quizAnswers[QUIZ_QUESTIONS[currentQuizIndex].key] === value
                        ? 'border-text bg-text text-bg'
                        : 'border-border text-text-dim'
                    }`}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-border rounded-full h-1.5 mt-4">
              <div
                className="bg-text h-1.5 rounded-full transition-all"
                style={{ width: `${((currentQuizIndex + 1) / QUIZ_QUESTIONS.length) * 100}%` }}
              />
            </div>

            {currentQuizIndex > 0 && (
              <Button
                type="button"
                variant="secondary"
                onClick={() => setCurrentQuizIndex(currentQuizIndex - 1)}
                disabled={quizMutation.isPending}
                className="mt-2"
              >
                Back
              </Button>
            )}

            {quizMutation.isPending && (
              <p className="text-center text-text-dim">Saving your answers...</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
