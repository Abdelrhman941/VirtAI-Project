# Digital Educational Agent — Prototype

A responsive 3-page React + Vite + Tailwind CSS prototype for a Digital Educational Agent with avatar configuration, document upload/RAG, and chat interface.

## Tech stack

- React 18
- Vite 5
- Tailwind CSS 3
- React Router v6

## Features

1. **Overview (landing)**: Hero + feature tiles with CTA to Setup page.
2. **Setup (3-step wizard)**: Avatar selection → Documents upload → Ready confirmation.
3. **Classroom (chat)**: ChatGPT-like layout with left sidebar (conversations), center chat area, right sources panel.

## To use it, simply run:
```bash
./run.sh
```

## Installation

```bash
npm install
```

## Run locally

```bash
npm run dev
```

Open browser at `http://localhost:5173`.

## Mock API

All backend endpoints (`/api/upload`, `/api/analyze`, `/api/agent-response`, `/api/tts`) are mocked in `src/api/mock.ts` with simulated delays and canned responses. No real backend required.

## Acceptance checklist

- [x] Navigation: Page1 → Page2 → Page3 flows work.
- [x] Avatar: Selecting/uploading avatar updates preview and persists to Ready summary.
- [x] Documents: Upload → Analyze → Indexed (mock) and summary displayed.
- [x] Chat: Send message → agent response rendered with source pills and TTS button.
- [x] On-the-fly upload: Upload from chat triggers analyze flow.
- [x] Right-click options: Conversation context menu (Rename/Favorite/Show Sources).
- [x] Responsive: Desktop and tablet layouts.

## Design tokens

- Layout width: 1100px centered
- Spacing: 4/8/12/16/24px increments
- Colors: bg `#F7F8FA`, surface `#FFFFFF`, text `#111827`, accent `#0EA5A4`
- Typography: Inter-like, 16px body, line-height 1.5

## File structure

```
src/
  api/
    mock.ts               # Mock endpoints
  pages/
    Overview.jsx          # Page 1 — Landing
    Setup.jsx             # Page 2 — 3-step wizard
    Classroom.jsx         # Page 3 — Chat
  ui/
    AvatarStep.jsx
    DocumentsStep.jsx
    ReadyStep.jsx
    ChatLayout.jsx
    components/
      AvatarGrid.jsx
      AvatarPreview.jsx
      Uploader.jsx
      ChatSidebar.jsx
      ChatArea.jsx
      SourcesPanel.jsx
  App.jsx               # Routing
  main.jsx              # Entry
  styles.css            # Tailwind + CSS variables
```

## Notes

- No real LLM/TTS backend — all API responses are mocked.
- Placeholder avatars and sample data are hardcoded for demo.
- Right-click menu on conversation items is not fully implemented (basic UI shown).
- Upload behavior auto-analyzes files and displays progress.

## Next steps (optional)

- Add dark mode toggle.
- Implement avatar speaking animation (lip movement).
- Add onboarding tooltips for first-time users.
- Connect to real LLM API and TTS service.

## License

MIT
