# ⬛ Competitor Ad War Room
### Real-Time Competitive Intelligence Dashboard for Mosaic Wellness

> Like having a spy in every competitor's marketing team — legally.

Built for **Be Bodywise**, **Man Matters**, and **Little Joys** — tracks competitor ads from Meta Ad Library with AI-powered analysis, trend detection, and weekly briefs.

---

## 🎯 What It Does

| Feature | Description |
|---|---|
| 📊 **Live Dashboard** | Real-time KPIs, charts, competitor activity tracking |
| 🔍 **Ad Intelligence Feed** | Filter by brand, format, theme, date, status |
| 🤖 **AI Insights** | Gemini-powered trend detection and pattern analysis |
| ⚡ **Top Performers** | Identifies long-running ads (competitors' proven winners) |
| 💡 **Gap Detection** | Finds creative formats competitors aren't using |
| 📋 **Weekly Brief** | AI-written Monday morning intel report |

---

## 🏢 Brands & Competitors Tracked

### Be Bodywise — Women's Health & Wellness
Pilgrim · Mamaearth · Dot & Key · Plum Goodness · Minimalist · WOW Skin Science · mCaffeine · OZiva

### Man Matters — Men's Grooming & Health
The Man Company · Bombay Shaving Company · Beardo · USTRAA · Traya Health · Vedix · BoldFit

### Little Joys — Kids' Nutrition & Wellness
Mamaearth Baby · Himalaya Baby · Bey Bee · Chicco India · Horlicks · Complan · Pediasure · The Moms Co

---

## 🚀 Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | FastAPI + Python 3.11 |
| **Database** | SQLite via SQLAlchemy |
| **AI** | Google Gemini 1.5 Flash |
| **Frontend** | Vanilla JS + Chart.js |
| **Data Source** | Meta Ad Library API |
| **Deployment** | Render / Railway / Docker |

---

## ⚡ Quick Start

### 1. Clone the repo
```bash
git clone https://github.com/saurabhkanth-5/ad-warroom.git
cd ad-warroom
```

### 2. Install dependencies
```bash
pip install -r backend/requirements.txt
```

### 3. Set up environment
```bash
cd backend
cp .env.example .env
# Add your GEMINI_API_KEY to .env
```

### 4. Run
```bash
python backend/app.py
```

Open → **http://localhost:8000**

---

## 🔑 Environment Variables

| Variable | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | ✅ Yes | Get free at [aistudio.google.com](https://aistudio.google.com/app/apikey) |
| `GEMINI_MODEL` | ✅ Yes | Set to `gemini-1.5-flash` |
| `DB_PATH` | ✅ Yes | Set to `warroom.db` |
| `META_ACCESS_TOKEN` | ❌ Optional | For live Meta Ad Library data |

---

## 📁 Project Structure

```
ad-warroom/
├── backend/
│   ├── app.py              # FastAPI — all API routes
│   ├── ai_analyzer.py      # Gemini AI analysis layer
│   ├── meta_api.py         # Meta Ad Library API client
│   ├── database.py         # SQLite database
│   ├── competitors.py      # Competitor config + justification
│   ├── sample_data.py      # Mock data generator
│   └── requirements.txt
├── frontend/
│   ├── index.html          # Dashboard SPA
│   ├── styles.css          # War room dark theme
│   └── dashboard.js        # Charts + app logic
├── Dockerfile
├── docker-compose.yml
└── README.md
```

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Health check |
| GET | `/api/brands` | All brands + competitors |
| GET | `/api/stats` | Dashboard statistics |
| GET | `/api/ads` | Ad feed with filters |
| GET | `/api/ads/top-performers` | Long-running winning ads |
| GET | `/api/insights` | AI-generated insights |
| POST | `/api/brief/{brand}/generate` | Generate weekly brief |
| POST | `/api/fetch` | Fetch from Meta Ad Library |

---

## 🐳 Docker

```bash
docker-compose up -d
```

---

## ☁️ Deploy

### Render
- Build Command: `pip install -r backend/requirements.txt`
- Start Command: `uvicorn backend.app:app --host 0.0.0.0 --port $PORT`

### Railway
- Add `Procfile` with: `web: uvicorn backend.app:app --host 0.0.0.0 --port $PORT`

---

*Built for Mosaic Wellness — Competitor Ad War Room Challenge*
