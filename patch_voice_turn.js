const fs = require('fs');
const file = 'backend/app/application/voice/handle_voice_turn.py';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  "saved_asst_msg = await self._persistence.persist_assistant_output(\n                    session_id, context.llm_full_response, tts_key, trace_id, message_id\n                )",
  "saved_asst_msg = await self._persistence.persist_assistant_output(\n                    session_id, context.llm_full_response, tts_key, trace_id, None\n                )"
);

fs.writeFileSync(file, code);
