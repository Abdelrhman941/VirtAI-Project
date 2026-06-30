const fs = require('fs');
const file = 'backend/app/schemas/ws_messages.py';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  "    created_at: str | None = None\n",
  "    created_at: str | None = None\n    db_message_id: str | None = None\n"
);

code = code.replace(
  "    emotion: str | None = None,\n    created_at: str | None = None,\n) -> ChatFinal:",
  "    emotion: str | None = None,\n    created_at: str | None = None,\n    db_message_id: str | None = None,\n) -> ChatFinal:"
);

code = code.replace(
  "        created_at=created_at,\n    )",
  "        created_at=created_at,\n        db_message_id=db_message_id,\n    )"
);

fs.writeFileSync(file, code);
