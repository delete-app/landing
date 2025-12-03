import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { $api } from '../lib/api/client'
import { useAuth } from '../lib/auth/context'

export default function Login() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const loginMutation = $api.useMutation('post', '/v1/auth/login', {
    onSuccess: async () => {
      // Cookies are set by the server, fetch user and update local auth state
      await login()
      navigate('/')
    },
    onError: (err) => {
      const detail = err.detail?.[0]?.msg
      setError(detail || 'Login failed')
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    loginMutation.mutate({
      body: { email, password },
    })
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1>×</h1>
        <h2>Welcome back</h2>

        <form onSubmit={handleSubmit}>
          {error && <div className="error">{error}</div>}

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
          />

          <button type="submit" disabled={loginMutation.isPending}>
            {loginMutation.isPending ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <p className="auth-switch">
          Don't have an account? <Link to="/signup">Sign up</Link>
        </p>
      </div>
    </div>
  )
}
