import json

log_path = r'C:\Users\abdal\.gemini\antigravity-ide\brain\399706e5-179d-43f6-b6be-df72e2c10f02\.system_generated\logs\transcript_full.jsonl'

with open(log_path, 'r', encoding='utf-8') as f:
    for line in f:
        try:
            data = json.loads(line)
            if data.get('type') == 'USER_INPUT' and 'ASR hotfix' in data.get('content', ''):
                print(data['content'])
        except Exception:
            pass
