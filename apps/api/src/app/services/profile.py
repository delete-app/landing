import uuid
from typing import Sequence

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Badge, Photo, Prompt, QuizResponse, User
from app.schemas import (
    AVAILABLE_PROMPTS,
    PhotoCreate,
    ProfileCompletion,
    PromptCreate,
    QuizAnswer,
)


# Badge definitions based on quiz responses
BADGE_DEFINITIONS = {
    "introvert_extrovert": {
        1: ("introvert", "Introvert", "Recharges with alone time"),
        2: ("introvert", "Introvert", "Recharges with alone time"),
        4: ("extrovert", "Extrovert", "Energized by social time"),
        5: ("extrovert", "Extrovert", "Energized by social time"),
    },
    "planner_spontaneous": {
        1: ("planner", "Planner", "Likes structure and schedules"),
        2: ("planner", "Planner", "Likes structure and schedules"),
        4: ("spontaneous", "Spontaneous", "Goes with the flow"),
        5: ("spontaneous", "Spontaneous", "Goes with the flow"),
    },
    "conflict_style": {
        1: ("talks_it_out", "Talks through conflict", "Prefers to discuss issues immediately"),
        2: ("talks_it_out", "Talks through conflict", "Prefers to discuss issues immediately"),
        4: ("needs_space", "Needs space first", "Processes before discussing"),
        5: ("needs_space", "Needs space first", "Processes before discussing"),
    },
    "alone_time": {
        1: ("low_alone_time", "Together time", "Prefers frequent togetherness"),
        2: ("low_alone_time", "Together time", "Prefers frequent togetherness"),
        4: ("high_alone_time", "Needs alone time", "Values personal space"),
        5: ("high_alone_time", "Needs alone time", "Values personal space"),
    },
    "decision_speed": {
        1: ("slow_decisions", "Thoughtful decider", "Takes time to decide"),
        2: ("slow_decisions", "Thoughtful decider", "Takes time to decide"),
        4: ("quick_decisions", "Quick decider", "Decides fast and moves on"),
        5: ("quick_decisions", "Quick decider", "Decides fast and moves on"),
    },
    "novelty_needs": {
        1: ("routine_lover", "Routine lover", "Finds comfort in consistency"),
        2: ("routine_lover", "Routine lover", "Finds comfort in consistency"),
        4: ("novelty_seeker", "Novelty seeker", "Thrives on new experiences"),
        5: ("novelty_seeker", "Novelty seeker", "Thrives on new experiences"),
    },
}


# Photo operations
async def get_user_photos(db: AsyncSession, user_id: uuid.UUID) -> Sequence[Photo]:
    result = await db.execute(
        select(Photo).where(Photo.user_id == user_id).order_by(Photo.order)
    )
    return result.scalars().all()


async def create_photo(
    db: AsyncSession, user_id: uuid.UUID, photo_in: PhotoCreate
) -> Photo:
    # Get current max order
    result = await db.execute(
        select(Photo).where(Photo.user_id == user_id).order_by(Photo.order.desc())
    )
    existing = result.scalars().first()
    new_order = (existing.order + 1) if existing else 0

    photo = Photo(
        user_id=user_id,
        url=photo_in.url,
        order=new_order,
    )
    db.add(photo)
    await db.commit()
    await db.refresh(photo)
    return photo


async def delete_photo(db: AsyncSession, photo_id: uuid.UUID, user_id: uuid.UUID) -> bool:
    result = await db.execute(
        select(Photo).where(Photo.id == photo_id, Photo.user_id == user_id)
    )
    photo = result.scalars().first()
    if not photo:
        return False
    await db.delete(photo)
    await db.commit()
    return True


async def reorder_photos(
    db: AsyncSession, user_id: uuid.UUID, photo_ids: list[uuid.UUID]
) -> Sequence[Photo]:
    # Verify all photos belong to user
    result = await db.execute(
        select(Photo).where(Photo.user_id == user_id, Photo.id.in_(photo_ids))
    )
    photos = {p.id: p for p in result.scalars().all()}

    if len(photos) != len(photo_ids):
        raise ValueError("Invalid photo IDs")

    # Update order
    for i, photo_id in enumerate(photo_ids):
        photos[photo_id].order = i

    await db.commit()
    return await get_user_photos(db, user_id)


# Prompt operations
async def get_user_prompts(db: AsyncSession, user_id: uuid.UUID) -> Sequence[Prompt]:
    result = await db.execute(
        select(Prompt).where(Prompt.user_id == user_id).order_by(Prompt.order)
    )
    return result.scalars().all()


async def create_prompt(
    db: AsyncSession, user_id: uuid.UUID, prompt_in: PromptCreate
) -> Prompt:
    # Validate question is in available prompts
    if prompt_in.question not in AVAILABLE_PROMPTS:
        raise ValueError("Invalid prompt question")

    # Check if user already answered this question
    result = await db.execute(
        select(Prompt).where(
            Prompt.user_id == user_id, Prompt.question == prompt_in.question
        )
    )
    existing = result.scalars().first()
    if existing:
        raise ValueError("You already answered this prompt")

    # Get current max order
    result = await db.execute(
        select(Prompt).where(Prompt.user_id == user_id).order_by(Prompt.order.desc())
    )
    last = result.scalars().first()
    new_order = (last.order + 1) if last else 0

    prompt = Prompt(
        user_id=user_id,
        question=prompt_in.question,
        answer=prompt_in.answer,
        order=new_order,
    )
    db.add(prompt)
    await db.commit()
    await db.refresh(prompt)
    return prompt


async def update_prompt(
    db: AsyncSession, prompt_id: uuid.UUID, user_id: uuid.UUID, answer: str
) -> Prompt | None:
    result = await db.execute(
        select(Prompt).where(Prompt.id == prompt_id, Prompt.user_id == user_id)
    )
    prompt = result.scalars().first()
    if not prompt:
        return None
    prompt.answer = answer
    await db.commit()
    await db.refresh(prompt)
    return prompt


async def delete_prompt(
    db: AsyncSession, prompt_id: uuid.UUID, user_id: uuid.UUID
) -> bool:
    result = await db.execute(
        select(Prompt).where(Prompt.id == prompt_id, Prompt.user_id == user_id)
    )
    prompt = result.scalars().first()
    if not prompt:
        return False
    await db.delete(prompt)
    await db.commit()
    return True


# Quiz operations
async def submit_quiz(
    db: AsyncSession, user_id: uuid.UUID, answers: list[QuizAnswer]
) -> list[Badge]:
    # Import here to avoid circular dependency
    from app.services.compatibility import derive_trait_scores

    # Clear existing quiz responses and badges
    await db.execute(delete(QuizResponse).where(QuizResponse.user_id == user_id))
    await db.execute(delete(Badge).where(Badge.user_id == user_id))

    # Save quiz responses
    quiz_responses = []
    for answer in answers:
        response = QuizResponse(
            user_id=user_id,
            question_key=answer.question_key,
            answer_value=answer.answer_value,
        )
        db.add(response)
        quiz_responses.append(response)

    # Generate badges based on responses
    badges = []
    for answer in answers:
        if answer.question_key in BADGE_DEFINITIONS:
            badge_map = BADGE_DEFINITIONS[answer.question_key]
            # Only generate badge for strong answers (1-2 or 4-5, skip 3)
            if answer.answer_value in badge_map:
                badge_type, label, description = badge_map[answer.answer_value]
                badge = Badge(
                    user_id=user_id,
                    badge_type=badge_type,
                    label=label,
                    description=description,
                )
                db.add(badge)
                badges.append(badge)

    await db.commit()

    # Derive trait scores for compatibility matching
    await derive_trait_scores(db, user_id, quiz_responses)

    return badges


async def get_user_badges(db: AsyncSession, user_id: uuid.UUID) -> Sequence[Badge]:
    result = await db.execute(
        select(Badge).where(Badge.user_id == user_id).order_by(Badge.created_at)
    )
    return result.scalars().all()


async def get_user_quiz_responses(
    db: AsyncSession, user_id: uuid.UUID
) -> Sequence[QuizResponse]:
    result = await db.execute(
        select(QuizResponse).where(QuizResponse.user_id == user_id)
    )
    return result.scalars().all()


# Profile completion
async def calculate_profile_completion(
    db: AsyncSession, user_id: uuid.UUID, user: User
) -> ProfileCompletion:
    photos = await get_user_photos(db, user_id)
    prompts = await get_user_prompts(db, user_id)
    quiz_responses = await get_user_quiz_responses(db, user_id)

    has_basic_info = all([user.name, user.birth_date, user.gender, user.looking_for])
    has_photos = len(photos) >= 2
    has_prompts = len(prompts) >= 1
    has_quiz = len(quiz_responses) >= 6

    missing = []
    if not has_basic_info:
        missing.append("Complete basic info (name, birthday, gender, preferences)")
    if not has_photos:
        missing.append(f"Add at least 2 photos ({len(photos)}/2)")
    if not has_prompts:
        missing.append("Answer at least 1 prompt")
    if not has_quiz:
        missing.append("Complete the personality quiz")

    # Calculate percentage
    total_items = 4  # basic info, 2 photos, 1 prompt, quiz
    completed = sum([has_basic_info, has_photos, has_prompts, has_quiz])
    percentage = int((completed / total_items) * 100)

    return ProfileCompletion(
        percentage=percentage,
        has_photos=has_photos,
        photo_count=len(photos),
        has_prompts=has_prompts,
        prompt_count=len(prompts),
        has_quiz=has_quiz,
        has_basic_info=has_basic_info,
        missing=missing,
    )
