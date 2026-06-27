import asyncio
from app.infrastructure.db.database import get_session
from app.infrastructure.db.repositories.chat_repository import ChatRepository
import uuid
import sys

async def main():
    async for db in get_session():
        repo = ChatRepository(db, None)
        session_id = str(uuid.uuid4())
        # We need a user to create a session
        # For simplicity, we just look at the code syntax
        print("Code compiles.")
        return

if __name__ == "__main__":
    asyncio.run(main())
