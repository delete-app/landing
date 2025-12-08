import { $api } from '../lib/api/client'

export default function Matches() {
  const { data: matches, isLoading, error } = $api.useQuery('get', '/v1/matching/matches')

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-text-dim">Loading matches...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-red-400">Failed to load matches</div>
      </div>
    )
  }

  if (!matches || matches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <div className="text-6xl">💫</div>
        <h2 className="text-xl font-light">No matches yet</h2>
        <p className="text-text-dim text-center max-w-sm">
          Keep discovering profiles. When someone you like also likes you back, they'll appear here.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-light">Your Matches</h1>
        <span className="text-text-dim text-sm">
          {matches.length} match{matches.length !== 1 ? 'es' : ''}
        </span>
      </div>

      <div className="grid gap-4">
        {matches.map((match) => (
          <div
            key={match.id}
            className="flex items-center gap-4 p-4 rounded-xl bg-surface border border-border-light"
          >
            {match.other_user_photo ? (
              <img
                src={match.other_user_photo}
                alt={match.other_user_name || 'Match'}
                className="w-16 h-16 rounded-full object-cover"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-surface-elevated flex items-center justify-center text-2xl">
                {match.other_user_name?.[0]?.toUpperCase() || '?'}
              </div>
            )}
            <div className="flex-1">
              <h3 className="font-medium">{match.other_user_name || 'Someone'}</h3>
              <p className="text-sm text-text-dim">
                Matched {new Date(match.matched_at).toLocaleDateString()}
              </p>
            </div>
            <div className="text-2xl">💬</div>
          </div>
        ))}
      </div>

      <p className="text-center text-text-dim text-sm">
        Chat coming soon! For now, look at their profile to connect.
      </p>
    </div>
  )
}
