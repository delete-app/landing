"""Seed script to create test profiles for discovery testing.

Run with: cd apps/api && uv run python -m app.scripts.seed_profiles
"""

import asyncio
import uuid
from datetime import date, timedelta
from random import randint

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import async_session_maker
from app.models.user import User
from app.models.profile import Photo, Prompt, Badge
from app.core.security import get_password_hash


# Test profile data - diverse set of profiles
TEST_PROFILES = [
    {
        "name": "Priya",
        "email": "priya@test.delete.app",
        "gender": "female",
        "looking_for": "male",
        "birth_date": date.today() - timedelta(days=27 * 365),
        "bio": "Software engineer by day, amateur chef by night. Looking for someone who appreciates both good code and good food.",
        "location": "Bangalore",
        "photos": [
            "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=600&fit=crop",
            "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400&h=600&fit=crop",
        ],
        "prompts": [
            ("A perfect Sunday looks like...", "Morning run, filter coffee at a local cafe, and catching up on my reading list."),
            ("I geek out on...", "System design, mechanical keyboards, and finding the best biryani in the city."),
        ],
        "badges": [("deep_thinker", "Deep Thinker", "Values meaningful conversations")],
    },
    {
        "name": "Arjun",
        "email": "arjun@test.delete.app",
        "gender": "male",
        "looking_for": "female",
        "birth_date": date.today() - timedelta(days=29 * 365),
        "bio": "Product manager who believes in building things that matter. Weekend trekker and amateur photographer.",
        "location": "Mumbai",
        "photos": [
            "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=600&fit=crop",
            "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=600&fit=crop",
        ],
        "prompts": [
            ("The way to my heart is...", "Through thoughtful conversations and spontaneous road trips."),
        ],
        "badges": [("adventure_seeker", "Adventure Seeker", "Loves exploring new places")],
    },
    {
        "name": "Meera",
        "email": "meera@test.delete.app",
        "gender": "female",
        "looking_for": "male",
        "birth_date": date.today() - timedelta(days=26 * 365),
        "bio": "UX designer passionate about making technology more human. Plant parent of 12 (and counting).",
        "location": "Delhi",
        "photos": [
            "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=600&fit=crop",
        ],
        "prompts": [
            ("I'm looking for...", "Someone who can appreciate comfortable silences as much as deep conversations."),
            ("My simple pleasures...", "Morning chai on the balcony, Sunday farmers markets, and getting lost in a good book."),
        ],
        "badges": [],
    },
    {
        "name": "Vikram",
        "email": "vikram@test.delete.app",
        "gender": "male",
        "looking_for": "female",
        "birth_date": date.today() - timedelta(days=30 * 365),
        "bio": "Data scientist who finds patterns everywhere. Music producer on weekends. Believer in slow living.",
        "location": "Bangalore",
        "photos": [
            "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=600&fit=crop",
            "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=600&fit=crop",
        ],
        "prompts": [
            ("My ideal weekend...", "Vinyl records, homemade pasta, and no plans beyond that."),
        ],
        "badges": [("creative_soul", "Creative Soul", "Expresses through art and music")],
    },
    {
        "name": "Ananya",
        "email": "ananya@test.delete.app",
        "gender": "female",
        "looking_for": "male",
        "birth_date": date.today() - timedelta(days=28 * 365),
        "bio": "Lawyer by profession, writer by passion. Collecting stories and making sense of the world one conversation at a time.",
        "location": "Chennai",
        "photos": [
            "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&h=600&fit=crop",
        ],
        "prompts": [
            ("I value...", "Honesty, intellectual curiosity, and people who can laugh at themselves."),
            ("Green flags I look for...", "Good listeners, people who read, and those who are kind to service staff."),
        ],
        "badges": [("thoughtful", "Thoughtful", "Takes time to understand others")],
    },
    {
        "name": "Rohan",
        "email": "rohan@test.delete.app",
        "gender": "male",
        "looking_for": "female",
        "birth_date": date.today() - timedelta(days=31 * 365),
        "bio": "Startup founder building in climate tech. I believe we can build a better future. Dog dad to a golden retriever named Mango.",
        "location": "Bangalore",
        "photos": [
            "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=400&h=600&fit=crop",
        ],
        "prompts": [
            ("I'm passionate about...", "Building sustainable solutions and long morning walks with Mango."),
            ("A relationship green flag is...", "When someone genuinely celebrates your wins."),
        ],
        "badges": [("purpose_driven", "Purpose Driven", "Motivated by making an impact")],
    },
    {
        "name": "Kavya",
        "email": "kavya@test.delete.app",
        "gender": "female",
        "looking_for": "male",
        "birth_date": date.today() - timedelta(days=25 * 365),
        "bio": "Architect who sees beauty in structures. Weekend baker, terrible singer (but enthusiastic). Looking for depth over drama.",
        "location": "Pune",
        "photos": [
            "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=400&h=600&fit=crop",
            "https://images.unsplash.com/photo-1496440737103-cd596325d314?w=400&h=600&fit=crop",
        ],
        "prompts": [
            ("My love language is...", "Acts of service and really good playlists."),
        ],
        "badges": [("creative_soul", "Creative Soul", "Expresses through art and design")],
    },
]


async def seed_profiles(db: AsyncSession) -> None:
    """Create test profiles in the database."""

    created_count = 0
    skipped_count = 0

    for profile_data in TEST_PROFILES:
        # Check if user already exists
        result = await db.execute(
            select(User).where(User.email == profile_data["email"])
        )
        existing = result.scalar_one_or_none()

        if existing:
            print(f"  Skipping {profile_data['name']} - already exists")
            skipped_count += 1
            continue

        # Create user
        user = User(
            id=uuid.uuid4(),
            email=profile_data["email"],
            hashed_password=get_password_hash("testpass123"),
            name=profile_data["name"],
            birth_date=profile_data["birth_date"],
            gender=profile_data["gender"],
            looking_for=profile_data["looking_for"],
            bio=profile_data["bio"],
            location=profile_data["location"],
            profile_complete=True,
            is_active=True,
        )
        db.add(user)
        await db.flush()  # Get the user ID

        # Add photos
        for i, url in enumerate(profile_data["photos"]):
            photo = Photo(
                user_id=user.id,
                url=url,
                order=i,
            )
            db.add(photo)

        # Add prompts
        for i, (question, answer) in enumerate(profile_data["prompts"]):
            prompt = Prompt(
                user_id=user.id,
                question=question,
                answer=answer,
                order=i,
            )
            db.add(prompt)

        # Add badges
        for badge_type, label, description in profile_data["badges"]:
            badge = Badge(
                user_id=user.id,
                badge_type=badge_type,
                label=label,
                description=description,
            )
            db.add(badge)

        print(f"  Created {profile_data['name']} ({profile_data['location']})")
        created_count += 1

    await db.commit()
    print(f"\nDone! Created {created_count} profiles, skipped {skipped_count} existing.")


async def main() -> None:
    """Main entry point."""
    print("Seeding test profiles...")
    print("-" * 40)

    async with async_session_maker() as db:
        await seed_profiles(db)


if __name__ == "__main__":
    asyncio.run(main())
