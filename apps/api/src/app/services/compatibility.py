"""Trait derivation and compatibility scoring logic."""

import uuid
from dataclasses import dataclass
from typing import Sequence

from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import QuizResponse
from app.models.matching import UserTraitScore


# Quiz question keys map directly to trait scores
TRAIT_MAPPING = {
    "introvert_extrovert": "introvert_extrovert",
    "planner_spontaneous": "planner_spontaneous",
    "conflict_style": "conflict_talk_space",
    "alone_time": "together_alone_time",
    "decision_speed": "slow_quick_decisions",
    "novelty_needs": "routine_novelty",
}

# Quiz answer value (1-5) maps directly to trait score
# 1 = left side of scale, 5 = right side
# Example: introvert_extrovert: 1=strong introvert, 5=strong extrovert


@dataclass
class TraitComparison:
    """Comparison result for a single trait."""
    trait_name: str
    user_score: int
    other_score: int
    difference: int
    compatibility: str  # "aligned", "similar", "different", "opposite"
    description: str


@dataclass
class CompatibilityResult:
    """Full compatibility analysis between two users."""
    overall_score: int  # 0-100
    trait_comparisons: list[TraitComparison]
    summary: str
    highlights: list[str]  # "Why you might click" items


def get_compatibility_label(difference: int) -> tuple[str, str]:
    """Convert score difference to compatibility label and description."""
    if difference == 0:
        return "aligned", "You're exactly aligned"
    elif difference == 1:
        return "similar", "Very similar"
    elif difference == 2:
        return "different", "Some differences"
    else:  # 3 or 4
        return "opposite", "Opposite — may complement or clash"


TRAIT_LABELS = {
    "introvert_extrovert": {
        "name": "Social energy",
        1: "Introvert",
        2: "Leans introvert",
        3: "Ambivert",
        4: "Leans extrovert",
        5: "Extrovert",
    },
    "planner_spontaneous": {
        "name": "Planning style",
        1: "Strong planner",
        2: "Prefers planning",
        3: "Balanced",
        4: "Prefers spontaneity",
        5: "Very spontaneous",
    },
    "conflict_talk_space": {
        "name": "Conflict style",
        1: "Talks it out immediately",
        2: "Prefers talking",
        3: "Depends on situation",
        4: "Needs some space",
        5: "Needs space to process",
    },
    "together_alone_time": {
        "name": "Together time",
        1: "Loves togetherness",
        2: "Prefers together",
        3: "Balanced",
        4: "Values alone time",
        5: "Needs lots of space",
    },
    "slow_quick_decisions": {
        "name": "Decision making",
        1: "Very deliberate",
        2: "Takes time",
        3: "Balanced",
        4: "Decides quickly",
        5: "Instant decisions",
    },
    "routine_novelty": {
        "name": "Lifestyle",
        1: "Loves routine",
        2: "Prefers routine",
        3: "Balanced",
        4: "Seeks variety",
        5: "Novelty seeker",
    },
}


async def derive_trait_scores(
    db: AsyncSession, user_id: uuid.UUID, quiz_responses: list[QuizResponse]
) -> UserTraitScore:
    """
    Convert quiz responses to trait scores and store them.

    Quiz answers (1-5) map directly to trait scores.
    This is the source of truth for compatibility calculations.
    """
    # Build trait scores dict from responses
    scores = {}
    for response in quiz_responses:
        if response.question_key in TRAIT_MAPPING:
            trait_col = TRAIT_MAPPING[response.question_key]
            scores[trait_col] = response.answer_value

    # Ensure all traits have values (default to 3/neutral if missing)
    for trait_col in TRAIT_MAPPING.values():
        if trait_col not in scores:
            scores[trait_col] = 3

    # Delete existing trait scores for this user
    await db.execute(
        delete(UserTraitScore).where(UserTraitScore.user_id == user_id)
    )

    # Create new trait scores
    trait_score = UserTraitScore(
        user_id=user_id,
        introvert_extrovert=scores["introvert_extrovert"],
        planner_spontaneous=scores["planner_spontaneous"],
        conflict_talk_space=scores["conflict_talk_space"],
        together_alone_time=scores["together_alone_time"],
        slow_quick_decisions=scores["slow_quick_decisions"],
        routine_novelty=scores["routine_novelty"],
    )
    db.add(trait_score)
    await db.commit()
    await db.refresh(trait_score)
    return trait_score


async def get_user_trait_scores(
    db: AsyncSession, user_id: uuid.UUID
) -> UserTraitScore | None:
    """Get a user's derived trait scores."""
    result = await db.execute(
        select(UserTraitScore).where(UserTraitScore.user_id == user_id)
    )
    return result.scalars().first()


def calculate_compatibility(
    user_traits: UserTraitScore, other_traits: UserTraitScore
) -> CompatibilityResult:
    """
    Calculate compatibility between two users based on trait scores.

    Returns overall score (0-100) and detailed trait comparisons.
    """
    comparisons = []
    total_difference = 0
    highlights = []

    trait_columns = [
        "introvert_extrovert",
        "planner_spontaneous",
        "conflict_talk_space",
        "together_alone_time",
        "slow_quick_decisions",
        "routine_novelty",
    ]

    for trait_col in trait_columns:
        user_score = getattr(user_traits, trait_col)
        other_score = getattr(other_traits, trait_col)
        difference = abs(user_score - other_score)
        total_difference += difference

        compatibility, compat_desc = get_compatibility_label(difference)
        trait_info = TRAIT_LABELS[trait_col]

        comparison = TraitComparison(
            trait_name=trait_info["name"],
            user_score=user_score,
            other_score=other_score,
            difference=difference,
            compatibility=compatibility,
            description=compat_desc,
        )
        comparisons.append(comparison)

        # Generate highlights for well-aligned traits
        if difference <= 1:
            user_label = trait_info[user_score]
            if difference == 0:
                highlights.append(f"Both {user_label.lower()}")
            else:
                highlights.append(f"Similar {trait_info['name'].lower()}")

    # Calculate overall score: 0-100
    # Max difference per trait is 4, max total is 24
    # Score = 100 - (total_difference / 24 * 100)
    max_difference = 4 * len(trait_columns)  # 24
    overall_score = int(100 - (total_difference / max_difference * 100))

    # Generate summary
    if overall_score >= 80:
        summary = "Strong compatibility — you're well aligned on most traits"
    elif overall_score >= 60:
        summary = "Good compatibility — similar in key areas with some differences"
    elif overall_score >= 40:
        summary = "Moderate compatibility — some alignment, some contrast"
    else:
        summary = "Complementary opposites — could balance each other out"

    return CompatibilityResult(
        overall_score=overall_score,
        trait_comparisons=comparisons,
        summary=summary,
        highlights=highlights[:3],  # Max 3 highlights
    )


async def get_compatibility_between_users(
    db: AsyncSession, user1_id: uuid.UUID, user2_id: uuid.UUID
) -> CompatibilityResult | None:
    """Calculate compatibility between two users."""
    user1_traits = await get_user_trait_scores(db, user1_id)
    user2_traits = await get_user_trait_scores(db, user2_id)

    if not user1_traits or not user2_traits:
        return None

    return calculate_compatibility(user1_traits, user2_traits)
