# Lectly

**The AI-powered lecture companion that doesn't just take notes — it teaches.**

Upload messy lecture recordings. Get clean, structured notes. Learn with an AI tutor that teaches the material back to you at your level.

Website: [lectly.app](https://lectly.app)

---

## Project Structure

```
lectly/
├── frontend/          # Next.js 15 + Tailwind CSS + TypeScript
│   ├── src/app/       # App router pages
│   │   ├── page.tsx           # Landing page
│   │   ├── upload/            # Audio upload page
│   │   ├── dashboard/         # Lecture dashboard
│   │   ├── sign-in/           # Auth (Clerk)
│   │   └── sign-up/           # Auth (Clerk)
│   └── .env.example   # Frontend env template
│
├── backend/           # Python FastAPI
│   ├── app/
│   │   ├── main.py            # App entry point
│   │   ├── config.py          # Settings from env
│   │   ├── routes/            # API endpoints
│   │   │   └── lectures.py    # Upload, process, explain, learn
│   │   ├── services/          # Business logic
│   │   │   ├── audio.py       # Audio processing + transcription
│   │   │   └── notes.py       # Note generation + Learn Mode
│   │   ├── models/            # Pydantic data models
│   │   │   └── lecture.py     # Lecture, Notes, Quiz models
│   │   └── utils/             # Shared utilities
│   ├── uploads/               # Raw uploaded audio files
│   ├── processed/             # Cleaned/processed audio
│   ├── requirements.txt       # Python dependencies
│   └── .env.example           # Backend env template
│
└── README.md
```

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- Python 3.11+
- API keys (see Setup below)

### 1. Clone and install

```bash
# Frontend
cd frontend
cp .env.example .env.local
npm install

# Backend
cd ../backend
cp .env.example .env
pip install -r requirements.txt
```

### 2. Add your API keys

**Backend `.env`:**
- `OPENAI_API_KEY` — Get from [platform.openai.com](https://platform.openai.com/api-keys)
- `ANTHROPIC_API_KEY` — Get from [console.anthropic.com](https://console.anthropic.com/)

**Frontend `.env.local`:**
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` — Get from [clerk.com](https://dashboard.clerk.com)
- `CLERK_SECRET_KEY` — Same Clerk dashboard

### 3. Run locally

```bash
# Terminal 1 — Backend (runs on port 8000)
cd backend
uvicorn app.main:app --reload

# Terminal 2 — Frontend (runs on port 3000)
cd frontend
npm run dev
```

### 4. Open in browser

- Frontend: [http://localhost:3000](http://localhost:3000)
- API docs: [http://localhost:8000/docs](http://localhost:8000/docs)
- Health check: [http://localhost:8000/health](http://localhost:8000/health)

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/upload` | Upload audio file |
| POST | `/api/lectures/{id}/process` | Trigger processing pipeline |
| GET | `/api/lectures` | List all lectures |
| GET | `/api/lectures/{id}` | Get lecture details + notes |
| POST | `/api/explain` | Explain highlighted text |
| POST | `/api/learn` | Activate Learn Mode |
| GET | `/health` | Health check + API key status |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, React 19, Tailwind CSS, TypeScript |
| Backend | Python, FastAPI |
| Auth | Clerk |
| Transcription | OpenAI Whisper |
| AI / LLM | Anthropic Claude |
| Hosting | Vercel (frontend) + Railway (backend) |

## Deployment

### Frontend → Vercel

1. Push to GitHub
2. Import repo in [vercel.com](https://vercel.com)
3. Set root directory to `frontend`
4. Add env variables from `.env.example`
5. Deploy

### Backend → Railway

1. Push to GitHub
2. Create new project in [railway.app](https://railway.app)
3. Set root directory to `backend`
4. Set start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
5. Add env variables from `.env.example`
6. Deploy

## Roadmap

- [x] Project setup + landing page
- [x] Audio upload with drag & drop
- [x] Dashboard with lecture list
- [x] FastAPI backend with upload endpoint
- [ ] Connect OpenAI Whisper for real transcription
- [ ] Connect Claude for note generation
- [ ] Build full Learn Mode UI
- [ ] Add flashcard generation
- [ ] Offline note downloads
- [ ] WhatsApp sharing
- [ ] Mobile app (React Native)

## License

Proprietary — All rights reserved.
