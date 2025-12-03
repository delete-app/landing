import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth/context'

interface LayoutProps {
  children: React.ReactNode
}

export function Layout({ children }: LayoutProps) {
  const { isAuthenticated, logout } = useAuth()
  const location = useLocation()

  const isAuthPage = location.pathname === '/login' || location.pathname === '/signup'

  if (isAuthPage) {
    return <>{children}</>
  }

  return (
    <div className="min-h-screen flex flex-col bg-bg text-text">
      <header className="flex items-center justify-between px-6 py-4 border-b border-border-light">
        <Link to="/" className="text-3xl font-extralight text-text no-underline">
          ×
        </Link>
        {isAuthenticated && (
          <nav className="flex items-center gap-6">
            <Link
              to="/dashboard"
              className={`text-sm no-underline transition-colors ${
                location.pathname === '/dashboard' ? 'text-text' : 'text-text-dim hover:text-text'
              }`}
            >
              Home
            </Link>
            <Link
              to="/settings"
              className={`text-sm no-underline transition-colors ${
                location.pathname === '/settings' ? 'text-text' : 'text-text-dim hover:text-text'
              }`}
            >
              Settings
            </Link>
            <button
              onClick={logout}
              className="bg-transparent border-none text-text-dim text-sm cursor-pointer p-0 transition-colors hover:text-text"
            >
              Sign out
            </button>
          </nav>
        )}
      </header>
      <main className="flex-1 p-8 max-w-3xl mx-auto w-full">{children}</main>
    </div>
  )
}
