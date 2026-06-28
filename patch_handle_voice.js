const fs = require('fs');
const file = 'backend/app/application/voice/handle_voice_turn.py';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  "                            text=context.llm_full_response,\n                            emotion=context.llm_emotion,\n                            created_at=context.assistant_created_at,\n                        )",
  "                            text=context.llm_full_response,\n                            emotion=context.llm_emotion,\n                            created_at=context.assistant_created_at,\n                            db_message_id=saved_asst_msg.get('id') if saved_asst_msg else None,\n                        )"
);

fs.writeFileSync(file, code);
