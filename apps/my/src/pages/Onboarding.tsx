import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { $api } from '../lib/api/client'
import { useAuth } from '../lib/auth/context'

type Step = 'basics' | 'details' | 'preferences'

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
  const [error, setError] = useState('')

  // Form state
  const [name, setName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [gender, setGender] = useState('')
  const [bio, setBio] = useState('')
  const [location, setLocation] = useState('')
  const [lookingFor, setLookingFor] = useState('')

  const updateMutation = $api.useMutation('patch', '/v1/users/me', {
    onSuccess: async () => {
      if (step === 'basics') {
        setStep('details')
      } else if (step === 'details') {
        setStep('preferences')
      } else {
        // Refetch user to update profile_complete in auth context
        await refetchUser()
        navigate('/dashboard')
      }
    },
    onError: (err) => {
      setError(err.detail?.[0]?.msg || 'Failed to save')
    },
  })

  function handleBasics(e: React.FormEvent) {
    e.preventDefault()
    setError('')
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
    setError('')
    updateMutation.mutate({
      body: {
        bio: bio || undefined,
        location: location || undefined,
      },
    })
  }

  function handlePreferences(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    updateMutation.mutate({
      body: {
        looking_for: lookingFor || undefined,
      },
    })
  }

  const inputClass =
    'py-3.5 px-4 text-base border border-border rounded-lg bg-bg-secondary text-text outline-none transition-colors focus:border-text-dim placeholder:text-text-dimmer font-[inherit]'
  const primaryBtnClass =
    'flex-1 py-3.5 px-4 text-base font-medium border-none rounded-lg bg-text text-bg cursor-pointer transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed'
  const secondaryBtnClass =
    'flex-1 py-3.5 px-4 text-base font-medium border border-border rounded-lg bg-transparent text-text-muted cursor-pointer transition-colors hover:border-text-dim hover:text-text'

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
      </div>

      {step === 'basics' && (
        <form onSubmit={handleBasics} className="flex flex-col gap-6">
          <h2 className="text-2xl font-medium mb-0">Let's get to know you</h2>
          <p className="text-text-dim text-sm -mt-4">Tell us the basics</p>

          {error && (
            <div className="py-3 px-4 text-sm text-error bg-error/10 rounded-lg text-left">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <label className="text-sm text-text-muted">Your name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="What should we call you?"
              required
              className={inputClass}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm text-text-muted">Birthday</label>
            <input
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              max={MAX_BIRTH_DATE}
              required
              className={inputClass}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm text-text-muted">I am</label>
            <div className="flex gap-2 flex-wrap">
              {['male', 'female', 'non-binary', 'other'].map((g) => (
                <button
                  key={g}
                  type="button"
                  className={`flex-1 min-w-[100px] py-3 px-4 text-sm border rounded-lg cursor-pointer transition-all ${
                    gender === g
                      ? 'border-text bg-text text-bg'
                      : 'border-border bg-transparent text-text-muted hover:border-text-dim hover:text-text'
                  }`}
                  onClick={() => setGender(g)}
                >
                  {g.charAt(0).toUpperCase() + g.slice(1).replace('-', ' ')}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={updateMutation.isPending || !name || !birthDate || !gender}
            className={`${primaryBtnClass} mt-4`}
          >
            {updateMutation.isPending ? 'Saving...' : 'Continue'}
          </button>
        </form>
      )}

      {step === 'details' && (
        <form onSubmit={handleDetails} className="flex flex-col gap-6">
          <h2 className="text-2xl font-medium mb-0">Add some details</h2>
          <p className="text-text-dim text-sm -mt-4">Help others get to know you</p>

          {error && (
            <div className="py-3 px-4 text-sm text-error bg-error/10 rounded-lg text-left">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <label className="text-sm text-text-muted">About you</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Write a short bio..."
              rows={4}
              maxLength={500}
              className={`${inputClass} resize-y min-h-[100px]`}
            />
            <span className="text-xs text-text-dimmer text-right">{bio.length}/500</span>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm text-text-muted">Location</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="City, Country"
              className={inputClass}
            />
          </div>

          <div className="flex gap-4 mt-4">
            <button type="button" className={secondaryBtnClass} onClick={() => setStep('basics')}>
              Back
            </button>
            <button type="submit" disabled={updateMutation.isPending} className={primaryBtnClass}>
              {updateMutation.isPending ? 'Saving...' : 'Continue'}
            </button>
          </div>
        </form>
      )}

      {step === 'preferences' && (
        <form onSubmit={handlePreferences} className="flex flex-col gap-6">
          <h2 className="text-2xl font-medium mb-0">Who are you looking for?</h2>
          <p className="text-text-dim text-sm -mt-4">We'll help you find the right match</p>

          {error && (
            <div className="py-3 px-4 text-sm text-error bg-error/10 rounded-lg text-left">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <label className="text-sm text-text-muted">I'm interested in</label>
            <div className="flex gap-2 flex-wrap">
              {[
                { value: 'male', label: 'Men' },
                { value: 'female', label: 'Women' },
                { value: 'everyone', label: 'Everyone' },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`flex-1 min-w-[100px] py-3 px-4 text-sm border rounded-lg cursor-pointer transition-all ${
                    lookingFor === option.value
                      ? 'border-text bg-text text-bg'
                      : 'border-border bg-transparent text-text-muted hover:border-text-dim hover:text-text'
                  }`}
                  onClick={() => setLookingFor(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-4 mt-4">
            <button type="button" className={secondaryBtnClass} onClick={() => setStep('details')}>
              Back
            </button>
            <button
              type="submit"
              disabled={updateMutation.isPending || !lookingFor}
              className={primaryBtnClass}
            >
              {updateMutation.isPending ? 'Saving...' : 'Complete Setup'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
