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
    <div className="flex items-center justify-center min-h-screen p-8 bg-bg">
      <div className="w-full max-w-[360px] text-center">
        <h1 className="text-6xl font-extralight mb-2 text-text">×</h1>
        <h2 className="text-2xl font-normal text-text-muted mb-8">Welcome back</h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && (
            <div className="py-3 px-4 text-sm text-error bg-error/10 rounded-lg text-left">
              {error}
            </div>
          )}

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="py-3.5 px-4 text-base border border-border rounded-lg bg-bg-secondary text-text outline-none transition-colors focus:border-text-dim placeholder:text-text-dimmer"
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="py-3.5 px-4 text-base border border-border rounded-lg bg-bg-secondary text-text outline-none transition-colors focus:border-text-dim placeholder:text-text-dimmer"
          />

          <button
            type="submit"
            disabled={loginMutation.isPending}
            className="py-3.5 px-4 text-base font-medium border-none rounded-lg bg-text text-bg cursor-pointer transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loginMutation.isPending ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <p className="mt-6 text-sm text-text-dim">
          Don't have an account?{' '}
          <Link to="/signup" className="text-text no-underline hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  )
}
