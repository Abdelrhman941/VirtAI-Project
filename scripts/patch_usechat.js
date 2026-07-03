const fs = require('fs');
const file = 'frontend/src/widgets/Classroom/hooks/useClassroomChat.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  "sessionRef.current.addAssistantMessage(\n            `${d.message_id}-assistant`,",
  "sessionRef.current.addAssistantMessage(\n            d.db_message_id ? `${d.db_message_id}-assistant` : `${d.message_id}-assistant`,"
);

fs.writeFileSync(file, code);
