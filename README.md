# 🛡️ PharmaShield — Counterfeit Medicine Detector

Enterprise-grade 4-tier pharmaceutical verification platform.  
Hybrid Computer Vision + LLM pipeline with a MongoDB "Truth Ledger" and a hyper-modern clinical UI.

## Architecture

| Tier | Stack | Purpose |
|------|-------|---------|
| **Frontend** | React + Vite + Tailwind CSS | PWA scanner interface |
| **Gateway** | Node.js + Express + Mongoose | API gateway, DB ops, scan logging |
| **AI/CV Service** | Python + FastAPI + OpenCV | SSIM analysis, Gemini verification |
| **Database** | MongoDB | Truth Ledger (medicines, scan history) |

## Quick Start

```bash
# 1 — Python microservice
cd backend-python
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# 2 — Node gateway (needs MongoDB running)
cd backend-node
npm install
node seed.js          # seed the database
node server.js        # starts on :5000

# 3 — Frontend
cd frontend
npm install
npm run dev           # starts on :5173
```

## Environment Variables

| Service | Variable | Description |
|---------|----------|-------------|
| `backend-python` | `GEMINI_API_KEY` | Google Gemini API key |
| `backend-node` | `MONGO_URI` | MongoDB connection string |
| `backend-node` | `PYTHON_SERVICE_URL` | Python service URL (default `http://localhost:8000`) |

## Hackathon: Codecure — Team Busted
