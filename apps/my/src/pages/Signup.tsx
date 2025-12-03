import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { $api } from '../lib/api/client'
import { Button, Input } from '../components/ui'

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

          <Input
            type="text"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoComplete="name"
          />

          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />

          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
          />

          <Button type="submit" disabled={signupMutation.isPending} className="w-full">
            {signupMutation.isPending ? 'Creating account...' : 'Sign up'}
          </Button>
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
