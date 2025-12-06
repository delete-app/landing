from fastapi import APIRouter

from app.api.v1.auth import router as auth_router
from app.api.v1.health import router as health_router
from app.api.v1.matching import router as matching_router
from app.api.v1.profile import router as profile_router
from app.api.v1.users import router as users_router
from app.api.v1.daily_discovery import router as daily_discovery_router

api_router = APIRouter(prefix="/v1")
api_router.include_router(health_router)
api_router.include_router(auth_router)
api_router.include_router(users_router)
api_router.include_router(profile_router)
api_router.include_router(matching_router)
api_router.include_router(daily_discovery_router)
