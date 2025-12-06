import { useState } from 'react'
import type { DiscoveryProfile } from '../../types/discovery'

interface ProfileCardProps {
  profile: DiscoveryProfile
  onImageChange?: (index: number) => void
}

export function ProfileCard({ profile, onImageChange }: ProfileCardProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0)

  const handleImageNav = (direction: 'prev' | 'next') => {
    const newIndex =
      direction === 'next'
        ? (currentImageIndex + 1) % profile.photos.length
        : (currentImageIndex - 1 + profile.photos.length) % profile.photos.length
    setCurrentImageIndex(newIndex)
    onImageChange?.(newIndex)
  }

  return (
    <div className="relative w-full max-w-md mx-auto">
      {/* Photo Section */}
      <div className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-bg-secondary">
        {profile.photos.length > 0 ? (
          <>
            <img
              src={profile.photos[currentImageIndex]?.url}
              alt={profile.name}
              className="w-full h-full object-cover"
            />
            {/* Image navigation areas */}
            {profile.photos.length > 1 && (
              <>
                <button
                  onClick={() => handleImageNav('prev')}
                  className="absolute left-0 top-0 w-1/3 h-full cursor-pointer"
                  aria-label="Previous photo"
                />
                <button
                  onClick={() => handleImageNav('next')}
                  className="absolute right-0 top-0 w-1/3 h-full cursor-pointer"
                  aria-label="Next photo"
                />
                {/* Photo indicators */}
                <div className="absolute top-3 left-0 right-0 flex justify-center gap-1 px-4">
                  {profile.photos.map((_, idx) => (
                    <div
                      key={idx}
                      className={`h-0.5 flex-1 rounded-full transition-all ${
                        idx === currentImageIndex ? 'bg-white' : 'bg-white/40'
                      }`}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-text-dimmest">
            No photos
          </div>
        )}

        {/* Gradient overlay for text */}
        <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

        {/* Profile info overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-5">
          <div className="flex items-baseline gap-2 mb-1">
            <h2 className="text-2xl font-medium text-white">{profile.name}</h2>
            {profile.age && <span className="text-xl text-white/80">{profile.age}</span>}
          </div>
          {profile.location && <p className="text-sm text-white/70">{profile.location}</p>}
        </div>
      </div>

      {/* Bio & Prompts Section */}
      <div className="mt-4 space-y-4">
        {profile.bio && <p className="text-text-muted text-sm leading-relaxed">{profile.bio}</p>}

        {profile.prompts && profile.prompts.length > 0 && (
          <div className="space-y-3">
            {profile.prompts.map((prompt, idx) => (
              <div key={idx} className="bg-bg-secondary rounded-xl p-4">
                <p className="text-text-dim text-xs mb-1">{prompt.question}</p>
                <p className="text-text text-sm">{prompt.answer}</p>
              </div>
            ))}
          </div>
        )}

        {profile.badges && profile.badges.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {profile.badges.map((badge, idx) => (
              <span
                key={idx}
                className="px-3 py-1 bg-bg-tertiary rounded-full text-xs text-text-muted"
              >
                {badge.label}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
