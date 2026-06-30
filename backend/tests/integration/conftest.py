from unittest.mock import MagicMock

import pytest


class FakeAsyncSession:
    def __init__(self):
        self.inserted = []

    def add(self, obj):
        self.inserted.append(obj)

    async def commit(self):
        pass

    async def execute(self, *args, **kwargs):
        result = MagicMock()

        def scalar_one_or_none():
            return self.inserted[-1] if self.inserted else None

        result.scalar_one_or_none.side_effect = scalar_one_or_none
        result.scalars.return_value.all.return_value = self.inserted
        return result

    async def scalar(self, *args, **kwargs):
        from unittest.mock import MagicMock

        return MagicMock(id=str(args[0])) if args else MagicMock()


@pytest.fixture
def mock_db_session():
    """
    Creates a fake DB session.
    """
    return FakeAsyncSession()


@pytest.fixture
def app_fixture():
    """
    Returns the FastAPI app object.
    """
    from app.main import app

    # Clear overrides if any
    app.dependency_overrides = {}
    return app


@pytest.fixture
async def test_user():
    import uuid
    from app.infrastructure.db.database import AsyncSessionLocal
    from app.infrastructure.db.models import User

    user_id = uuid.uuid4()
    async with AsyncSessionLocal() as session:
        user = User(
            id=user_id,
            email=f"test_{user_id}@test.com",
            username=f"test_{user_id}",
            provider="LOCAL",
            is_active=True
        )
        session.add(user)
        await session.commit()
    
    yield user_id

    async with AsyncSessionLocal() as session:
        from sqlalchemy import delete
        await session.execute(delete(User).where(User.id == user_id))
        await session.commit()

@pytest.fixture
def token(test_user):
    from app.shared.security import create_access_token
    return create_access_token(user_id=test_user)

@pytest.fixture
def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}
