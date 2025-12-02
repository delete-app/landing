import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { $api } from '../lib/api/hooks'

export default function Signup() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const signupMutation = $api.useMutation('post', '/v1/auth/signup', {
    onSuccess: () => {
      // Signup successful, redirect to login
      navigate('/login')
    },
    onError: (err) => {
      const detail = err.detail?.[0]?.msg
      setError(detail || 'Signup failed')
    },
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    signupMutation.mutate({
      body: { email, password, name: name || undefined },
    })
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1>×</h1>
        <h2>Create account</h2>

        <form onSubmit={handleSubmit}>
          {error && <div className="error">{error}</div>}

          <input
            type="text"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />

          <button type="submit" disabled={signupMutation.isPending}>
            {signupMutation.isPending ? 'Creating account...' : 'Sign up'}
          </button>
        </form>

        <p className="auth-switch">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
