import uuid
from datetime import datetime

from pydantic import BaseModel, Field


# Photo schemas
class PhotoCreate(BaseModel):
    url: str = Field(..., max_length=500)
    order: int = Field(default=0, ge=0, le=5)


class PhotoResponse(BaseModel):
    id: uuid.UUID
    url: str
    order: int
    created_at: datetime

    model_config = {"from_attributes": True}


class PhotoReorder(BaseModel):
    photo_ids: list[uuid.UUID] = Field(..., min_length=1, max_length=6)


# Prompt schemas
class PromptCreate(BaseModel):
    question: str = Field(..., max_length=200)
    answer: str = Field(..., min_length=1, max_length=500)


class PromptUpdate(BaseModel):
    answer: str = Field(..., min_length=1, max_length=500)


class PromptResponse(BaseModel):
    id: uuid.UUID
    question: str
    answer: str
    order: int
    created_at: datetime

    model_config = {"from_attributes": True}


# Quiz schemas
class QuizAnswer(BaseModel):
    question_key: str = Field(..., max_length=50)
    answer_value: int = Field(..., ge=1, le=5)


class QuizSubmit(BaseModel):
    answers: list[QuizAnswer] = Field(..., min_length=6, max_length=6)


class QuizResponseOut(BaseModel):
    question_key: str
    answer_value: int

    model_config = {"from_attributes": True}


# Badge schemas
class BadgeResponse(BaseModel):
    id: uuid.UUID
    badge_type: str
    label: str
    description: str
    created_at: datetime

    model_config = {"from_attributes": True}


# Profile completion schema
class ProfileCompletion(BaseModel):
    percentage: int = Field(..., ge=0, le=100)
    has_photos: bool
    photo_count: int
    has_prompts: bool
    prompt_count: int
    has_quiz: bool
    has_basic_info: bool
    missing: list[str]


# Available prompts (predefined)
AVAILABLE_PROMPTS = [
    # Self-awareness
    "A pattern I'm trying to break in relationships...",
    "I know I'm hard to deal with when...",
    "I've learned that I need a partner who...",
    # Values
    "I won't compromise on...",
    "The hill I'll die on...",
    "In 5 years, I want to be...",
    # Lifestyle
    "My ideal Sunday with a partner...",
    "I recharge by...",
]


class AvailablePromptsResponse(BaseModel):
    prompts: list[str]
