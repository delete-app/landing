import uuid
from datetime import datetime, date

from pydantic import BaseModel, EmailStr, Field


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str | None = None


class UserResponse(BaseModel):
    id: uuid.UUID
    email: EmailStr
    name: str | None
    is_active: bool
    birth_date: date | None
    gender: str | None
    bio: str | None
    location: str | None
    looking_for: str | None
    height_cm: int | None
    profile_complete: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class ProfileUpdate(BaseModel):
    name: str | None = Field(None, max_length=100)
    birth_date: date | None = None
    gender: str | None = Field(None, pattern="^(male|female|non-binary|other)$")
    bio: str | None = Field(None, max_length=500)
    location: str | None = Field(None, max_length=100)
    looking_for: str | None = Field(None, pattern="^(male|female|everyone)$")
    height_cm: int | None = Field(None, ge=100, le=250)


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class TokenRefresh(BaseModel):
    refresh_token: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
