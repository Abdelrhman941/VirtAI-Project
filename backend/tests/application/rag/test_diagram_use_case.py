import json
import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.application.rag.diagram_use_case import DiagramDomainException, DiagramUseCase
from app.domain.chat.entities import LLMResult
from app.infrastructure.db.models import DocumentChunk


class MockLLMProvider:
    def __init__(self):
        self.complete_mock = AsyncMock()

    async def complete(self, history, **kwargs):
        return await self.complete_mock(history, **kwargs)


@pytest.mark.asyncio
async def test_diagram_use_case_no_chunks():
    db = AsyncMock()
    mock_result = MagicMock()
    # No cache hit
    mock_result.scalar_one_or_none.return_value = None
    mock_result.scalars.return_value.all.return_value = []
    db.execute.return_value = mock_result

    llm = MockLLMProvider()
    use_case = DiagramUseCase(llm)

    with pytest.raises(DiagramDomainException, match="No content found"):
        await use_case.generate_diagram(db, str(uuid.uuid4()), str(uuid.uuid4()))


@pytest.mark.asyncio
async def test_diagram_use_case_mermaid_sanitizer():
    llm = MockLLMProvider()
    use_case = DiagramUseCase(llm)

    bad_mermaid = "```mermaid\nflowchart TD\n  A[\"User (Admin)\"] --> B['Settings']\n```"
    sanitized = use_case._sanitize_mermaid(bad_mermaid)

    assert "```" not in sanitized
    assert "flowchart TD" in sanitized
    assert "User (Admin)" in sanitized
    assert "Settings" in sanitized

    bad_mermaid_no_start = "A[App] --> B[DB]"
    sanitized_no_start = use_case._sanitize_mermaid(bad_mermaid_no_start)
    assert sanitized_no_start.startswith("flowchart TD\n")


@pytest.mark.asyncio
async def test_diagram_use_case_node_limit():
    llm = MockLLMProvider()
    use_case = DiagramUseCase(llm)

    # 65 lines of mermaid code
    big_mermaid = "flowchart TD\n" + "\n".join([f"  A{i} --> B{i}" for i in range(65)])

    with pytest.raises(DiagramDomainException, match="too complex"):
        use_case._check_node_limit(big_mermaid)


@pytest.mark.asyncio
async def test_diagram_use_case_json_parsing_success():
    db = AsyncMock()
    db.add = MagicMock()

    chunk = DocumentChunk(chunk_text="Some facts", chunk_order=1)

    class ExecResult:
        def __init__(self, scalar_val=None, all_res=None):
            self._scalar_val = scalar_val
            self._all_res = all_res

        def scalar_one_or_none(self):
            return self._scalar_val

        def scalars(self):
            class Scalars:
                def __init__(self, items):
                    self.items = items

                def all(self):
                    return self.items

            return Scalars(self._all_res)

    # First call: cache miss, second call: chunks
    db.execute.side_effect = [ExecResult(scalar_val=None), ExecResult(all_res=[chunk])]

    llm = MockLLMProvider()

    good_json = {"mermaid_code": "flowchart TD\n  A[Concept 1] --> B[Concept 2]", "citations": [1]}

    llm.complete_mock.return_value = LLMResult(full_text=json.dumps(good_json))

    use_case = DiagramUseCase(llm)
    diagram_id = await use_case.generate_diagram(db, str(uuid.uuid4()), str(uuid.uuid4()))

    assert diagram_id is not None
    assert llm.complete_mock.call_count == 1
    assert db.add.call_count == 1
