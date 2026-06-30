const fs = require('fs');
const file = 'frontend/src/features/chat/components/MessageBubble.tsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  "            {isLast && msg.id && (\n              <VisualizeButton messageId={msg.id} locale=\"en\" onExpand={onScrollToBottom} />\n            )}\n          </div>",
  "          </div>\n          {isLast && msg.id && (\n            <VisualizeButton messageId={msg.id} locale=\"en\" onExpand={onScrollToBottom} />\n          )}"
);

fs.writeFileSync(file, code);
