import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { $api } from '../lib/api/client'

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
    <div className="flex items-center justify-center min-h-screen p-8 bg-bg">
      <div className="w-full max-w-[360px] text-center">
        <h1 className="text-6xl font-extralight mb-2 text-text">×</h1>
        <h2 className="text-2xl font-normal text-text-muted mb-8">Create account</h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && (
            <div className="py-3 px-4 text-sm text-error bg-error/10 rounded-lg text-left">
              {error}
            </div>
          )}

          <input
            type="text"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="py-3.5 px-4 text-base border border-border rounded-lg bg-bg-secondary text-text outline-none transition-colors focus:border-text-dim placeholder:text-text-dimmer"
          />

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
            minLength={8}
            className="py-3.5 px-4 text-base border border-border rounded-lg bg-bg-secondary text-text outline-none transition-colors focus:border-text-dim placeholder:text-text-dimmer"
          />

          <button
            type="submit"
            disabled={signupMutation.isPending}
            className="py-3.5 px-4 text-base font-medium border-none rounded-lg bg-text text-bg cursor-pointer transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {signupMutation.isPending ? 'Creating account...' : 'Sign up'}
          </button>
        </form>

        <p className="mt-6 text-sm text-text-dim">
          Already have an account?{' '}
          <Link to="/login" className="text-text no-underline hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
