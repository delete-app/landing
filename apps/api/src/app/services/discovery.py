"""Discovery service: Profile ranking, filtering, and daily queue generation."""

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Sequence

from sqlalchemy import select, and_, or_, func, not_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User, Photo, Prompt
from app.models.matching import (
    Like, Pass, Match, Block, UserTraitScore, MatchStatus
)
from app.services.compatibility import (
    get_user_trait_scores, calculate_compatibility, CompatibilityResult
)


@dataclass
class DiscoveryProfile:
    """A profile in the discovery queue with ranking metadata."""
    user: User
    photos: list[Photo]
    prompts: list[Prompt]
    compatibility: CompatibilityResult | None
    ranking_score: float
    is_new_user: bool  # Joined in last 7 days


@dataclass
class DiscoveryResult:
    """Result of discovery query with metadata."""
    profiles: list[DiscoveryProfile]
    total_available: int
    exhausted_pool: bool
    suggestions: list[str]  # Suggestions if pool is small


# Pass expiration in days
PASS_COOLDOWN_DAYS = 30

# Max profiles per day
MAX_DAILY_PROFILES = 10

# Diversity rules
MAX_SAME_PROFESSION = 3  # TODO: Add profession field to User
NEW_USER_BOOST_DAYS = 7
NEW_USER_BOOST_SCORE = 20  # Points added to ranking


async def get_blocked_user_ids(db: AsyncSession, user_id: uuid.UUID) -> set[uuid.UUID]:
    """Get all user IDs that should be hidden (blocked by or blocking)."""
    result = await db.execute(
        select(Block.blocked_id).where(Block.blocker_id == user_id)
    )
    blocked_by_me = {row[0] for row in result.fetchall()}

    result = await db.execute(
        select(Block.blocker_id).where(Block.blocked_id == user_id)
    )
    blocked_me = {row[0] for row in result.fetchall()}

    return blocked_by_me | blocked_me


async def get_already_interacted_ids(
    db: AsyncSession, user_id: uuid.UUID
) -> set[uuid.UUID]:
    """Get user IDs already liked or matched with."""
    # Already liked
    result = await db.execute(
        select(Like.to_user_id).where(Like.from_user_id == user_id)
    )
    liked_ids = {row[0] for row in result.fetchall()}

    # Already matched (either position)
    result = await db.execute(
        select(Match.user1_id, Match.user2_id).where(
            or_(Match.user1_id == user_id, Match.user2_id == user_id),
            Match.status.in_([MatchStatus.ACTIVE.value, MatchStatus.DATING.value])
        )
    )
    matched_ids = set()
    for row in result.fetchall():
        matched_ids.add(row[0])
        matched_ids.add(row[1])
    matched_ids.discard(user_id)

    return liked_ids | matched_ids


async def get_active_pass_ids(db: AsyncSession, user_id: uuid.UUID) -> set[uuid.UUID]:
    """Get user IDs with active (non-expired) passes."""
    now = datetime.now(UTC)
    result = await db.execute(
        select(Pass.to_user_id).where(
            Pass.from_user_id == user_id,
            Pass.expires_at > now  # Only non-expired passes
        )
    )
    return {row[0] for row in result.fetchall()}


async def get_users_who_passed_me(db: AsyncSession, user_id: uuid.UUID) -> set[uuid.UUID]:
    """Get users who passed on me (so my like would go nowhere)."""
    now = datetime.now(UTC)
    result = await db.execute(
        select(Pass.from_user_id).where(
            Pass.to_user_id == user_id,
            Pass.expires_at > now
        )
    )
    return {row[0] for row in result.fetchall()}


async def get_eligible_profiles(
    db: AsyncSession,
    user_id: uuid.UUID,
    user: User,
    limit: int = MAX_DAILY_PROFILES * 3  # Fetch more for ranking
) -> tuple[Sequence[User], int]:
    """
    Get profiles that match user's preferences and haven't been interacted with.

    Returns (profiles, total_available_count)
    """
    # Get exclusion sets
    blocked_ids = await get_blocked_user_ids(db, user_id)
    interacted_ids = await get_already_interacted_ids(db, user_id)
    passed_ids = await get_active_pass_ids(db, user_id)
    passed_me_ids = await get_users_who_passed_me(db, user_id)

    exclude_ids = blocked_ids | interacted_ids | passed_ids | passed_me_ids
    exclude_ids.add(user_id)  # Exclude self

    # Build base query with preference filters
    query = select(User).where(
        User.is_active == True,
        User.profile_complete == True,
        User.id.not_in(exclude_ids) if exclude_ids else True
    )

    # Filter by looking_for preference
    if user.looking_for == "male":
        query = query.where(User.gender == "male")
    elif user.looking_for == "female":
        query = query.where(User.gender == "female")
    # "everyone" = no gender filter

    # Filter by reciprocal interest (they're looking for user's gender)
    if user.gender:
        query = query.where(
            or_(
                User.looking_for == user.gender,
                User.looking_for == "everyone"
            )
        )

    # Get total count first
    count_query = select(func.count()).select_from(query.subquery())
    count_result = await db.execute(count_query)
    total_available = count_result.scalar() or 0

    # Add ordering: active users first, then by updated_at
    query = query.order_by(User.updated_at.desc()).limit(limit)

    result = await db.execute(query)
    return result.scalars().all(), total_available


async def rank_profiles(
    db: AsyncSession,
    user_id: uuid.UUID,
    profiles: Sequence[User]
) -> list[tuple[User, float, CompatibilityResult | None]]:
    """
    Rank profiles by compatibility and other factors.

    Ranking factors:
    1. Compatibility score (0-100 from quiz)
    2. Profile completeness (photos, prompts)
    3. Activity recency
    4. New user boost
    """
    user_traits = await get_user_trait_scores(db, user_id)
    ranked = []

    now = datetime.now(UTC)
    new_user_cutoff = now - timedelta(days=NEW_USER_BOOST_DAYS)

    for profile in profiles:
        score = 0.0
        compatibility = None

        # 1. Compatibility score (0-100, weighted at 50%)
        if user_traits:
            profile_traits = await get_user_trait_scores(db, profile.id)
            if profile_traits:
                compatibility = calculate_compatibility(user_traits, profile_traits)
                score += compatibility.overall_score * 0.5

        # 2. Profile completeness (up to 20 points)
        photos_result = await db.execute(
            select(func.count()).where(Photo.user_id == profile.id)
        )
        photo_count = photos_result.scalar() or 0
        prompts_result = await db.execute(
            select(func.count()).where(Prompt.user_id == profile.id)
        )
        prompt_count = prompts_result.scalar() or 0

        # 3 points per photo (up to 6), 2 points per prompt (up to 3)
        score += min(photo_count, 6) * 3  # Max 18
        score += min(prompt_count, 3) * 2  # Max 6
        # Normalize to 20 points max
        completeness_score = min(photo_count * 3 + prompt_count * 2, 24) / 24 * 20
        score += completeness_score

        # 3. Activity recency (up to 10 points)
        if profile.updated_at:
            days_since_update = (now - profile.updated_at).days
            if days_since_update <= 1:
                score += 10
            elif days_since_update <= 7:
                score += 7
            elif days_since_update <= 30:
                score += 4

        # 4. New user boost
        if profile.created_at and profile.created_at.replace(tzinfo=UTC) > new_user_cutoff:
            score += NEW_USER_BOOST_SCORE

        ranked.append((profile, score, compatibility))

    # Sort by score descending
    ranked.sort(key=lambda x: x[1], reverse=True)
    return ranked


def apply_diversity_rules(
    ranked_profiles: list[tuple[User, float, CompatibilityResult | None]],
    limit: int
) -> list[tuple[User, float, CompatibilityResult | None]]:
    """
    Apply diversity rules to prevent echo chamber.

    Rules:
    - Don't show too many profiles with identical compatibility patterns
    - Include at least one "complementary opposite" if available
    """
    if len(ranked_profiles) <= limit:
        return ranked_profiles

    selected = []
    complementary_included = False

    for profile, score, compat in ranked_profiles:
        if len(selected) >= limit:
            break

        # Include one complementary opposite (score < 50)
        if compat and compat.overall_score < 50 and not complementary_included:
            selected.append((profile, score, compat))
            complementary_included = True
            continue

        # Normal selection
        selected.append((profile, score, compat))

    return selected


async def get_discovery_queue(
    db: AsyncSession,
    user_id: uuid.UUID,
    limit: int = MAX_DAILY_PROFILES
) -> DiscoveryResult:
    """
    Get the daily discovery queue for a user.

    This is the main entry point for the discovery feed.
    """
    # Get user
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    if not user:
        return DiscoveryResult(
            profiles=[],
            total_available=0,
            exhausted_pool=True,
            suggestions=["User not found"]
        )

    # Get eligible profiles
    profiles, total_available = await get_eligible_profiles(db, user_id, user)

    # Handle scarcity gracefully
    suggestions = []
    exhausted_pool = total_available == 0

    if total_available == 0:
        suggestions.append("You've seen everyone nearby for now")
        suggestions.append("Try expanding your distance preference")
        suggestions.append("Check back tomorrow for new profiles")
    elif total_available < 5:
        suggestions.append(f"Only {total_available} profiles available")
        suggestions.append("Consider adjusting your preferences")

    # Rank profiles
    ranked = await rank_profiles(db, user_id, profiles)

    # Apply diversity rules
    ranked = apply_diversity_rules(ranked, limit)

    # Build discovery profiles with photos/prompts
    discovery_profiles = []
    now = datetime.now(UTC)
    new_user_cutoff = now - timedelta(days=NEW_USER_BOOST_DAYS)

    for profile, score, compatibility in ranked[:limit]:
        # Fetch photos
        photos_result = await db.execute(
            select(Photo).where(Photo.user_id == profile.id).order_by(Photo.order)
        )
        photos = list(photos_result.scalars().all())

        # Fetch prompts
        prompts_result = await db.execute(
            select(Prompt).where(Prompt.user_id == profile.id).order_by(Prompt.order)
        )
        prompts = list(prompts_result.scalars().all())

        is_new = (
            profile.created_at and
            profile.created_at.replace(tzinfo=UTC) > new_user_cutoff
        )

        discovery_profiles.append(DiscoveryProfile(
            user=profile,
            photos=photos,
            prompts=prompts,
            compatibility=compatibility,
            ranking_score=score,
            is_new_user=is_new
        ))

    return DiscoveryResult(
        profiles=discovery_profiles,
        total_available=total_available,
        exhausted_pool=exhausted_pool,
        suggestions=suggestions
    )
