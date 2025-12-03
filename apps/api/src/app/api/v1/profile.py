import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user_id
from app.db.session import get_db
from app.schemas import (
    AVAILABLE_PROMPTS,
    AvailablePromptsResponse,
    BadgeResponse,
    PhotoCreate,
    PhotoReorder,
    PhotoResponse,
    ProfileCompletion,
    PromptCreate,
    PromptResponse,
    PromptUpdate,
    QuizResponseOut,
    QuizSubmit,
)
from app.services.profile import (
    calculate_profile_completion,
    create_photo,
    create_prompt,
    delete_photo,
    delete_prompt,
    get_user_badges,
    get_user_photos,
    get_user_prompts,
    get_user_quiz_responses,
    reorder_photos,
    submit_quiz,
    update_prompt,
)
from app.services.user import get_user_by_id

router = APIRouter(prefix="/profile", tags=["profile"])


# Photo endpoints
@router.get("/photos", response_model=list[PhotoResponse])
async def list_photos(
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[PhotoResponse]:
    """Get all photos for the current user."""
    photos = await get_user_photos(db, uuid.UUID(user_id))
    return [PhotoResponse.model_validate(p) for p in photos]


@router.post("/photos", response_model=PhotoResponse, status_code=201)
async def add_photo(
    photo_in: PhotoCreate,
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> PhotoResponse:
    """Add a new photo to the user's profile."""
    # Check photo limit
    photos = await get_user_photos(db, uuid.UUID(user_id))
    if len(photos) >= 6:
        raise HTTPException(status_code=400, detail="Maximum 6 photos allowed")

    photo = await create_photo(db, uuid.UUID(user_id), photo_in)
    return PhotoResponse.model_validate(photo)


@router.delete("/photos/{photo_id}", status_code=204)
async def remove_photo(
    photo_id: uuid.UUID,
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    """Delete a photo from the user's profile."""
    deleted = await delete_photo(db, photo_id, uuid.UUID(user_id))
    if not deleted:
        raise HTTPException(status_code=404, detail="Photo not found")


@router.put("/photos/reorder", response_model=list[PhotoResponse])
async def reorder_user_photos(
    reorder: PhotoReorder,
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[PhotoResponse]:
    """Reorder photos by providing photo IDs in desired order."""
    try:
        photos = await reorder_photos(db, uuid.UUID(user_id), reorder.photo_ids)
        return [PhotoResponse.model_validate(p) for p in photos]
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# Prompt endpoints
@router.get("/prompts/available", response_model=AvailablePromptsResponse)
async def list_available_prompts() -> AvailablePromptsResponse:
    """Get list of available prompt questions."""
    return AvailablePromptsResponse(prompts=AVAILABLE_PROMPTS)


@router.get("/prompts", response_model=list[PromptResponse])
async def list_prompts(
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[PromptResponse]:
    """Get all prompts for the current user."""
    prompts = await get_user_prompts(db, uuid.UUID(user_id))
    return [PromptResponse.model_validate(p) for p in prompts]


@router.post("/prompts", response_model=PromptResponse, status_code=201)
async def add_prompt(
    prompt_in: PromptCreate,
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> PromptResponse:
    """Add a new prompt answer to the user's profile."""
    # Check prompt limit
    prompts = await get_user_prompts(db, uuid.UUID(user_id))
    if len(prompts) >= 3:
        raise HTTPException(status_code=400, detail="Maximum 3 prompts allowed")

    try:
        prompt = await create_prompt(db, uuid.UUID(user_id), prompt_in)
        return PromptResponse.model_validate(prompt)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/prompts/{prompt_id}", response_model=PromptResponse)
async def edit_prompt(
    prompt_id: uuid.UUID,
    prompt_in: PromptUpdate,
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> PromptResponse:
    """Update an existing prompt answer."""
    prompt = await update_prompt(db, prompt_id, uuid.UUID(user_id), prompt_in.answer)
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt not found")
    return PromptResponse.model_validate(prompt)


@router.delete("/prompts/{prompt_id}", status_code=204)
async def remove_prompt(
    prompt_id: uuid.UUID,
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    """Delete a prompt from the user's profile."""
    deleted = await delete_prompt(db, prompt_id, uuid.UUID(user_id))
    if not deleted:
        raise HTTPException(status_code=404, detail="Prompt not found")


# Quiz endpoints
@router.post("/quiz", response_model=list[BadgeResponse], status_code=201)
async def submit_quiz_answers(
    quiz_in: QuizSubmit,
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[BadgeResponse]:
    """Submit quiz answers and receive generated badges."""
    badges = await submit_quiz(db, uuid.UUID(user_id), quiz_in.answers)
    return [BadgeResponse.model_validate(b) for b in badges]


@router.get("/quiz", response_model=list[QuizResponseOut])
async def get_quiz_responses(
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[QuizResponseOut]:
    """Get the current user's quiz responses."""
    responses = await get_user_quiz_responses(db, uuid.UUID(user_id))
    return [QuizResponseOut.model_validate(r) for r in responses]


@router.get("/badges", response_model=list[BadgeResponse])
async def list_badges(
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[BadgeResponse]:
    """Get all badges for the current user."""
    badges = await get_user_badges(db, uuid.UUID(user_id))
    return [BadgeResponse.model_validate(b) for b in badges]


# Profile completion endpoint
@router.get("/completion", response_model=ProfileCompletion)
async def get_profile_completion(
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ProfileCompletion:
    """Get profile completion status and percentage."""
    user = await get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return await calculate_profile_completion(db, uuid.UUID(user_id), user)
