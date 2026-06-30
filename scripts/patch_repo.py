import re

with open("backend/app/infrastructure/db/repositories/chat_repository.py", "r") as f:
    content = f.read()

upsert_code = """        from sqlalchemy.dialects.postgresql import insert as pg_insert
        stmt = pg_insert(Message).values(**message_kwargs)
        stmt = stmt.on_conflict_do_update(
            index_elements=["id"],
            set_={
                "content": stmt.excluded.content,
                "tts_cache_key": stmt.excluded.tts_cache_key,
                "sources": stmt.excluded.sources,
                "timestamp": stmt.excluded.timestamp,
                "role": stmt.excluded.role,
                "input_type": stmt.excluded.input_type,
            }
        ).returning(Message)
        
        result = await self.db.execute(stmt)
        message = result.scalars().first()"""

content = re.sub(r"        from sqlalchemy.dialects.postgresql import insert as pg_insert.*?message = result.scalars\(\).first\(\)", upsert_code, content, flags=re.DOTALL)

with open("backend/app/infrastructure/db/repositories/chat_repository.py", "w") as f:
    f.write(content)
