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

  return (
    <div className="onboarding">
      <div className="onboarding-progress">
        <div className={`step ${step === 'basics' ? 'active' : ''}`}>1</div>
        <div className="step-line" />
        <div className={`step ${step === 'details' ? 'active' : ''}`}>2</div>
        <div className="step-line" />
        <div className={`step ${step === 'preferences' ? 'active' : ''}`}>3</div>
      </div>

      {step === 'basics' && (
        <form onSubmit={handleBasics} className="onboarding-form">
          <h2>Let's get to know you</h2>
          <p className="subtitle">Tell us the basics</p>

          {error && <div className="error">{error}</div>}

          <div className="form-group">
            <label>Your name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="What should we call you?"
              required
            />
          </div>

          <div className="form-group">
            <label>Birthday</label>
            <input
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              max={MAX_BIRTH_DATE}
              required
            />
          </div>

          <div className="form-group">
            <label>I am</label>
            <div className="button-group">
              {['male', 'female', 'non-binary', 'other'].map((g) => (
                <button
                  key={g}
                  type="button"
                  className={`option-btn ${gender === g ? 'selected' : ''}`}
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
          >
            {updateMutation.isPending ? 'Saving...' : 'Continue'}
          </button>
        </form>
      )}

      {step === 'details' && (
        <form onSubmit={handleDetails} className="onboarding-form">
          <h2>Add some details</h2>
          <p className="subtitle">Help others get to know you</p>

          {error && <div className="error">{error}</div>}

          <div className="form-group">
            <label>About you</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Write a short bio..."
              rows={4}
              maxLength={500}
            />
            <span className="char-count">{bio.length}/500</span>
          </div>

          <div className="form-group">
            <label>Location</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="City, Country"
            />
          </div>

          <div className="button-row">
            <button type="button" className="btn-secondary" onClick={() => setStep('basics')}>
              Back
            </button>
            <button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Saving...' : 'Continue'}
            </button>
          </div>
        </form>
      )}

      {step === 'preferences' && (
        <form onSubmit={handlePreferences} className="onboarding-form">
          <h2>Who are you looking for?</h2>
          <p className="subtitle">We'll help you find the right match</p>

          {error && <div className="error">{error}</div>}

          <div className="form-group">
            <label>I'm interested in</label>
            <div className="button-group">
              {[
                { value: 'male', label: 'Men' },
                { value: 'female', label: 'Women' },
                { value: 'everyone', label: 'Everyone' },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`option-btn ${lookingFor === option.value ? 'selected' : ''}`}
                  onClick={() => setLookingFor(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="button-row">
            <button type="button" className="btn-secondary" onClick={() => setStep('details')}>
              Back
            </button>
            <button type="submit" disabled={updateMutation.isPending || !lookingFor}>
              {updateMutation.isPending ? 'Saving...' : 'Complete Setup'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
