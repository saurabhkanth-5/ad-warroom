# ⬛ Competitor Ad War Room
### Mosaic Wellness — Competitive Intelligence Dashboard

Real-time competitor ad tracking for **Be Bodywise**, **Man Matters**, and **Little Joys** — powered by Meta Ad Library API + AI analysis.

---

## 🎯 What It Does

| Feature | Description |
|---|---|
| **Ad Tracking** | Fetches competitor ads from Meta Ad Library for all 3 brands |
| **Smart Filters** | Filter by brand, format (image/video/carousel), theme, status, date range |
| **AI Insights** | Theme detection, trend analysis, spending pattern signals |
| **Top Performers** | Identifies long-running ads (likely best-performing creatives) |
| **Gap Detection** | Finds creative formats competitors aren't using |
| **Weekly Brief** | AI-written Monday morning intel report for marketing managers |

---

## 🏢 Competitor Research

### Be Bodywise (Women's Health & Wellness)
| Competitor | Reason |
|---|---|
| Pilgrim | D2C skincare + supplements for Indian women; heavy Meta advertiser |
| Mamaearth | Largest D2C competitor; overlaps in skincare + hair supplements |
| Dot & Key | Women's skincare brand, Nykaa-backed, same audience |
| Plum Goodness | Vegan skincare targeting urban Indian women |
| Minimalist | Science-backed skincare; strong digital ads |
| WOW Skin Science | Heavy FB/Insta spender; overlaps in hair care |
| mCaffeine | D2C targeting young urban women; aggressive social ads |
| OZiva | Plant-based nutrition for women — direct supplement competitor |

### Man Matters (Men's Grooming, Health, Sexual Wellness)
| Competitor | Reason |
|---|---|
| The Man Company | Premium men's grooming; heavy digital spender |
| Bombay Shaving Company | Men's grooming + skincare; strong Meta presence |
| Beardo | Men's beard/grooming; Mamaearth-owned; major advertiser |
| USTRAA | Men's personal care; competes in hair, beard, skin |
| Traya Health | Direct competitor in hair fall solutions for men |
| Vedix | Ayurvedic personalized hair solutions |
| BoldFit | Men's fitness supplements; protein/nutrition category |

### Little Joys (Kids' Nutrition & Wellness)
| Competitor | Reason |
|---|---|
| Mamaearth Baby | Baby/kids care; same parent audience; D2C model |
| Himalaya Baby | Trusted baby wellness brand; supplements category |
| Bey Bee | D2C baby care brand; growing Meta ad presence |
| Chicco India | International baby brand; active in India |
| Horlicks | Dominant kids nutrition; Little Joys competes directly |
| Complan | Height/growth nutrition for kids 4-12; direct competitor |
| Pediasure | Premium kids nutrition; same parent segment |
| The Moms Co | D2C mom+baby brand; heavy Meta ads |

---

## 🚀 Quick Start

### Option 1: Local (No Docker)

```bash
# 1. Clone / download the project
cd competitor-ad-warroom

# 2. Set up environment
cp backend/.env.example backend/.env
# Edit backend/.env with your API keys

# 3. Install dependencies
cd backend
pip install -r requirements.txt

# 4. Run
python app.py
# OR
uvicorn app:app --reload --port 8000
```

Open `http://localhost:8000`

### Option 2: Docker

```bash
# Create .env file in root
cat > .env << EOF
META_ACCESS_TOKEN=your_token_here
OPENAI_API_KEY=your_openai_key_here
AI_PROVIDER=openai
EOF

docker-compose up -d
```

Open `http://localhost:8000`

---

## 🔑 API Keys Setup

### 1. Meta Access Token (for real ad data)

**Step 1:** Go to https://developers.facebook.com/apps/ → Create App

**Step 2:** Verify your identity (required for Ad Library API)
- Go to https://www.facebook.com/settings?tab=account&section=identity_confirmation
- Submit government ID → approval usually within hours

**Step 3:** Get your token
- Go to https://developers.facebook.com/tools/explorer/
- Select your app → Generate User Access Token
- Add permission: `ads_read`
- Click "Generate Access Token"

**Step 4:** For long-lived token (60 days):
```
GET https://graph.facebook.com/v18.0/oauth/access_token?
  grant_type=fb_exchange_token&
  client_id={app_id}&
  client_secret={app_secret}&
  fb_exchange_token={short_lived_token}
```

**⚠️ Important:** The Meta Ad Library API primarily returns EU/Political ads. For Indian D2C brands, results may be limited. The dashboard will use sample data as fallback.

### 2. OpenAI API Key (for AI analysis)
- Get from: https://platform.openai.com/api-keys
- Uses `gpt-4o-mini` for cost efficiency (~$0.01 per analysis run)

### 3. Anthropic API Key (alternative to OpenAI)
- Get from: https://console.anthropic.com/
- Set `AI_PROVIDER=anthropic` in .env
- Uses Claude Haiku (cheapest + fastest)

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Health check |
| GET | `/api/brands` | All brands + competitor configs |
| GET | `/api/stats?brand_key=X` | Dashboard statistics |
| GET | `/api/ads?brand_key=X&media_type=Y` | Ad feed with filters |
| GET | `/api/ads/top-performers` | Long-running winning ads |
| GET | `/api/insights?brand_key=X` | AI-generated insights |
| GET | `/api/brief/{brand_key}` | Get latest weekly brief |
| POST | `/api/brief/{brand_key}/generate` | Generate new weekly brief |
| POST | `/api/fetch?brand_key=X` | Trigger Meta API fetch |
| POST | `/api/reseed` | Reset and reseed sample data |

---

## ☁️ Cloud Deployment

### Deploy to Railway (Recommended — Free tier available)

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway init
railway up
```

### Deploy to Render

1. Connect GitHub repo
2. New Web Service → Docker
3. Add environment variables
4. Deploy

### Deploy to Fly.io

```bash
fly launch --name warroom
fly secrets set META_ACCESS_TOKEN=xxx OPENAI_API_KEY=xxx
fly deploy
```

---

## 🗂️ Project Structure

```
competitor-ad-warroom/
├── backend/
│   ├── app.py              # FastAPI app — all API routes
│   ├── meta_api.py         # Meta Ad Library API client
│   ├── ai_analyzer.py      # OpenAI/Anthropic AI layer
│   ├── database.py         # SQLite database (SQLAlchemy)
│   ├── competitors.py      # Competitor config + justification
│   ├── sample_data.py      # Realistic mock data generator
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── index.html          # Single-page dashboard
│   ├── styles.css          # War room dark theme
│   └── dashboard.js        # Full SPA logic + charts
├── docker-compose.yml
├── Dockerfile
└── README.md
```

---

## 📊 Dashboard Features

- **Brand Selector** — Toggle between Be Bodywise, Man Matters, Little Joys, or All
- **KPI Cards** — Total ads, active ads, top performers, competitors tracked
- **Format Chart** — Donut chart: Image vs Video vs Carousel distribution
- **Theme Chart** — Bar chart: UGC vs Doctor Authority vs Promo vs Science, etc.
- **Competitor Activity** — Bar chart showing ad volume per competitor
- **Top Performers** — Ads running 30+ days (likely scaled winning creatives)
- **AI Insights** — 5-7 specific findings with recommended actions
- **Weekly Brief** — Markdown report: TL;DR, what's working, gaps, 3 actions

---

## ⚠️ Known Limitations

1. **Meta API geographic scope** — Official API works best for EU ads and political ads. Indian brand data may be limited. Sample data provides demo functionality.

2. **Rate limits** — Meta API has undisclosed rate limits. The client sleeps 1s between requests.

3. **Token expiry** — User tokens expire in ~60 days. Long-lived tokens last 60 days. For production, implement automated refresh.

4. **Image/video assets** — The API doesn't return raw media files, only `ad_snapshot_url` links.

---

*Built for Mosaic Wellness — Competitor Ad War Room Challenge*#   c o m p e t i t o r - a d - w a r r o o m 
 
 #   a d - w a r r o o m 
 
 #   a d - w a r r o o m 
 
 
