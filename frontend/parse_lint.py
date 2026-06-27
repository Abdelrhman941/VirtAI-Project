import json

with open('lint-results.json') as f:
    raw = f.read()
start_idx = raw.find('[')
data = json.loads(raw[start_idx:])

for d in data:
    for m in d['messages']:
        if m.get('ruleId') == '@typescript-eslint/no-unused-vars':
            print(f"{d['filePath']}:{m['line']} - {m['message']}")
