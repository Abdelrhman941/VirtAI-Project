import asyncio
import os
from app.infrastructure.llm.cohere_provider import CohereLLMProvider
from app.domain.chat.entities import ConversationHistory
from app.shared.config import get_settings

async def main():
    settings = get_settings()
    llm = CohereLLMProvider(model=settings.GENERATION_MODEL, temperature=0.7, api_key=settings.COHERE_API_KEY)
    history = ConversationHistory(
        system_prompt="You are a helpful assistant.",
    )
    history.add_user_message("")
    
    try:
        res = await llm.complete(history)
        print("COMPLETE:", res.full_text)
    except Exception as e:
        print("COMPLETE ERROR:", e)

    try:
        print("STREAMING:")
        async for chunk in llm.stream(history):
            print(chunk.token, end="", flush=True)
        print()
    except Exception as e:
        print("STREAM ERROR:", e)

if __name__ == "__main__":
    asyncio.run(main())
