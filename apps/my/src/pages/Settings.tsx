import { $api } from '../lib/api/client'
import { useAuth } from '../lib/auth/context'
import {
  Button,
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogCloseTrigger,
} from '../components/ui'

export default function Settings() {
  const { logout } = useAuth()
  const { data: user, isLoading, error } = $api.useQuery('get', '/v1/users/me')

  if (isLoading) {
    return (
      <div className="max-w-xl">
        <div className="text-text-dim">Loading...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-xl">
        <div className="py-3 px-4 text-sm text-error bg-error/10 rounded-lg">
          Failed to load profile
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-xl">
      <h2 className="text-2xl font-medium mb-8">Settings</h2>

      <section className="mb-10">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-text-dim mb-4">
          Account
        </h3>
        <div className="flex justify-between items-center py-3 border-b border-border-light">
          <label className="text-text-muted text-sm">Email</label>
          <span className="text-text text-sm">{user?.email}</span>
        </div>
        <div className="flex justify-between items-center py-3 border-b border-border-light">
          <label className="text-text-muted text-sm">Name</label>
          <span className="text-text text-sm">{user?.name || 'Not set'}</span>
        </div>
        <div className="flex justify-between items-center py-3 border-b border-border-light">
          <label className="text-text-muted text-sm">Member since</label>
          <span className="text-text text-sm">
            {user?.created_at
              ? new Date(user.created_at).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })
              : '-'}
          </span>
        </div>
      </section>

      <section className="mb-10">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-text-dim mb-4">
          Danger Zone
        </h3>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="danger" size="sm">
              Sign out
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogTitle>Sign out?</DialogTitle>
            <DialogDescription>
              Are you sure you want to sign out of your account?
            </DialogDescription>
            <div className="flex gap-3 justify-end">
              <DialogCloseTrigger asChild>
                <Button variant="secondary" size="sm">
                  Cancel
                </Button>
              </DialogCloseTrigger>
              <Button variant="danger" size="sm" onClick={logout}>
                Sign out
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </section>
    </div>
  )
}
