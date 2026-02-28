"""
Competitor Ad War Room — FastAPI Backend
=========================================
Main API endpoints for the dashboard.
"""

import os
import json
import logging
from datetime import datetime, timedelta
from typing import Optional, List
from contextlib import asynccontextmanager

from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy.orm import Session

from database import init_db, get_db, get_ads, get_stats, upsert_ad, save_weekly_brief, get_latest_brief, save_run, AdRecord
from competitors import BRANDS, get_all_competitors, get_competitors_for_brand
from sample_data import seed_all_sample_data, generate_sample_ads
from meta_api import MetaAdLibraryClient
from ai_analyzer import analyze_batch, generate_weekly_brief, classify_ad

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

META_ACCESS_TOKEN = os.environ.get("META_ACCESS_TOKEN", "")

_base = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.join(_base, "..", "frontend")
if not os.path.exists(FRONTEND_DIR):
    FRONTEND_DIR = os.path.join(_base, "frontend")
if not os.path.exists(FRONTEND_DIR):
    FRONTEND_DIR = "/app/frontend"


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize DB and seed sample data on startup."""
    init_db()
    db = next(get_db())
    # Check if we need to seed
    from sqlalchemy import func
    count = db.query(func.count(AdRecord.id)).scalar()
    if count == 0:
        logger.info("DB empty — seeding sample data...")
        _seed_sample_data(db)
        logger.info(f"Seeded complete.")
    db.close()
    yield


app = FastAPI(
    title="Competitor Ad War Room",
    description="Real-time competitive intelligence dashboard for Mosaic Wellness brands",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def _seed_sample_data(db: Session):
    """Seed database with sample ads for all brands."""
    all_ads = seed_all_sample_data(BRANDS)
    for ad_raw in all_ads:
        ad_data = _normalize_ad(ad_raw, ad_raw["_brand_key"], ad_raw["_competitor"])
        try:
            upsert_ad(db, ad_data)
        except Exception as e:
            logger.error(f"Seed error: {e}")


def _normalize_ad(ad: dict, brand_key: str, competitor_name: str) -> dict:
    """Convert raw Meta API or sample ad to DB-ready format."""
    def parse_dt(s):
        if not s:
            return None
        try:
            return datetime.fromisoformat(s.replace("+0000", "+00:00").replace("Z", "+00:00")).replace(tzinfo=None)
        except Exception:
            return None

    def parse_spend(spend_dict):
        if not spend_dict or not isinstance(spend_dict, dict):
            return None, None
        try:
            return int(spend_dict.get("lower_bound", 0)), int(spend_dict.get("upper_bound", 0))
        except Exception:
            return None, None

    spend_lower, spend_upper = parse_spend(ad.get("spend"))
    imp_lower, imp_upper = parse_spend(ad.get("impressions"))

    bodies = ad.get("ad_creative_bodies") or []
    titles = ad.get("ad_creative_link_titles") or []
    descs = ad.get("ad_creative_link_descriptions") or []

    start_time = parse_dt(ad.get("ad_delivery_start_time") or ad.get("ad_creation_time"))
    stop_time = parse_dt(ad.get("ad_delivery_stop_time"))
    
    is_active = ad.get("_is_active", stop_time is None)
    run_days = ad.get("_run_days")
    if run_days is None and start_time:
        end = stop_time or datetime.utcnow()
        run_days = (end - start_time).days

    media_type = ad.get("media_type", "IMAGE")
    if not media_type or media_type == "unknown":
        media_type = "IMAGE"

    return {
        "id": ad.get("id", f"ad_{int(datetime.utcnow().timestamp())}_{competitor_name}"),
        "page_name": ad.get("page_name", competitor_name),
        "page_id": ad.get("page_id", ""),
        "brand_key": brand_key,
        "competitor_name": competitor_name,
        "ad_body": bodies[0] if bodies else "",
        "ad_title": titles[0] if titles else "",
        "ad_description": descs[0] if descs else "",
        "media_type": media_type,
        "publisher_platforms": json.dumps(ad.get("publisher_platforms", ["facebook"])),
        "languages": json.dumps(ad.get("languages", ["en"])),
        "ad_creation_time": parse_dt(ad.get("ad_creation_time")),
        "ad_delivery_start_time": start_time,
        "ad_delivery_stop_time": stop_time,
        "spend_lower": spend_lower,
        "spend_upper": spend_upper,
        "impressions_lower": imp_lower,
        "impressions_upper": imp_upper,
        "ad_snapshot_url": ad.get("ad_snapshot_url"),
        "theme": ad.get("theme") or ad.get("_theme"),
        "is_active": is_active,
        "run_days": run_days or 0,
        "is_top_performer": run_days > 30 if run_days else False,
        "is_sample": ad.get("_is_sample", False),
    }


# ===== API ROUTES =====

@app.get("/api/health")
def health():
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}


@app.get("/api/brands")
def get_brands():
    """Return all brand configs with competitor lists."""
    return {
        "brands": [
            {
                "key": k,
                "display_name": v["display_name"],
                "category": v["category"],
                "target_audience": v["target_audience"],
                "competitor_count": len(v["competitors"]),
                "competitors": v["competitors"]
            }
            for k, v in BRANDS.items()
        ]
    }


@app.get("/api/stats")
def get_dashboard_stats(
    brand_key: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """Dashboard stats — totals, media breakdown, theme breakdown."""
    stats = get_stats(db, brand_key)
    
    # Add per-brand breakdown
    brand_stats = {}
    for bk in BRANDS.keys():
        brand_stats[bk] = get_stats(db, bk)

    return {"overall": stats, "by_brand": brand_stats}


@app.get("/api/ads")
def list_ads(
    brand_key: Optional[str] = Query(None),
    competitor_name: Optional[str] = Query(None),
    media_type: Optional[str] = Query(None),
    theme: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    days_back: Optional[int] = Query(None),
    limit: int = Query(100, le=500),
    db: Session = Depends(get_db)
):
    """List ads with filters."""
    ads = get_ads(db, brand_key, competitor_name, media_type, theme, is_active, days_back, limit)
    return {
        "ads": [_ad_to_dict(ad) for ad in ads],
        "total": len(ads)
    }


@app.get("/api/ads/top-performers")
def get_top_performers(
    brand_key: Optional[str] = Query(None),
    limit: int = Query(20),
    db: Session = Depends(get_db)
):
    """Get long-running top performer ads. Falls back to longest-running ads if none marked as top performer."""
    q = db.query(AdRecord).filter(AdRecord.is_top_performer == True)
    if brand_key:
        q = q.filter(AdRecord.brand_key == brand_key)
    ads = q.order_by(AdRecord.run_days.desc()).limit(limit).all()
    # Fallback: if no top performers found, return longest running ads
    if not ads:
        q2 = db.query(AdRecord)
        if brand_key:
            q2 = q2.filter(AdRecord.brand_key == brand_key)
        ads = q2.order_by(AdRecord.run_days.desc()).limit(limit).all()
    return {"top_performers": [_ad_to_dict(ad) for ad in ads]}


@app.get("/api/insights")
def get_insights(
    brand_key: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """Get AI-generated insights for a brand or all brands."""
    brands_to_analyze = [brand_key] if brand_key else list(BRANDS.keys())
    results = {}

    for bk in brands_to_analyze:
        ads_raw = get_ads(db, brand_key=bk, limit=100)
        ads_dicts = [_ad_to_dict(ad) for ad in ads_raw]
        brand_display = BRANDS[bk]["display_name"]
        analysis = analyze_batch(ads_dicts, bk, brand_display)
        results[bk] = {
            "brand": brand_display,
            "analysis": analysis,
            "ad_count": len(ads_dicts)
        }

    return results


@app.get("/api/brief/{brand_key}")
def get_weekly_brief(brand_key: str, db: Session = Depends(get_db)):
    """Get the latest weekly brief for a brand."""
    brief = get_latest_brief(db, brand_key)
    if brief:
        return {
            "brand_key": brand_key,
            "generated_at": brief.generated_at.isoformat(),
            "brief_text": brief.brief_text,
            "insights": json.loads(brief.insights_json) if brief.insights_json else [],
            "ad_count": brief.ad_count
        }
    return {"brand_key": brand_key, "brief_text": "No brief generated yet. Run a refresh first.", "generated_at": None}


@app.post("/api/brief/{brand_key}/generate")
def generate_brief(brand_key: str, db: Session = Depends(get_db)):
    """Generate a new weekly brief for a brand using AI."""
    if brand_key not in BRANDS:
        raise HTTPException(status_code=404, detail=f"Brand '{brand_key}' not found")

    ads_raw = get_ads(db, brand_key=brand_key, limit=100)
    ads_dicts = [_ad_to_dict(ad) for ad in ads_raw]
    brand_display = BRANDS[brand_key]["display_name"]

    analysis = analyze_batch(ads_dicts, brand_key, brand_display)
    brief_text = generate_weekly_brief(brand_key, brand_display, ads_dicts, analysis)

    now = datetime.utcnow()
    save_weekly_brief(db, {
        "brand_key": brand_key,
        "generated_at": now,
        "week_start": now - timedelta(days=7),
        "week_end": now,
        "brief_text": brief_text,
        "insights_json": json.dumps(analysis.get("insights", [])),
        "ad_count": len(ads_dicts)
    })

    return {
        "brand_key": brand_key,
        "brief_text": brief_text,
        "insights": analysis.get("insights", []),
        "generated_at": now.isoformat()
    }


@app.post("/api/fetch")
async def fetch_ads(
    brand_key: Optional[str] = Query(None),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: Session = Depends(get_db)
):
    """
    Trigger a Meta API fetch for a brand's competitors.
    Falls back to fresh sample data if token missing or API fails.
    """
    brands_to_fetch = [brand_key] if brand_key else list(BRANDS.keys())
    
    if not META_ACCESS_TOKEN:
        # No token: reseed fresh sample data
        logger.info("No META_ACCESS_TOKEN — using sample data")
        count = 0
        for bk in brands_to_fetch:
            brand_data = BRANDS[bk]
            for comp in brand_data["competitors"]:
                ads = generate_sample_ads(comp["name"], bk, count=15)
                for ad in ads:
                    ad_data = _normalize_ad(ad, bk, comp["name"])
                    upsert_ad(db, ad_data)
                    count += 1
        return {"status": "success", "source": "sample_data", "ads_loaded": count, "message": "Sample data refreshed. Add META_ACCESS_TOKEN to .env to fetch real ads."}

    # Has token: try real API
    client = MetaAdLibraryClient(META_ACCESS_TOKEN)
    if not client.validate_token():
        raise HTTPException(status_code=401, detail="Meta access token is invalid or expired.")

    count = 0
    errors = []
    for bk in brands_to_fetch:
        brand_data = BRANDS[bk]
        for comp in brand_data["competitors"]:
            try:
                ads = client.fetch_all_ads_for_competitor(
                    search_term=comp["page_search_term"],
                    country="IN",
                    days_back=90
                )
                
                if not ads:
                    # Fallback to sample for this competitor
                    ads = generate_sample_ads(comp["name"], bk, count=10)
                    for ad in ads:
                        ad["_is_sample"] = True

                for ad in ads:
                    ad_data = _normalize_ad(ad, bk, comp["name"])
                    upsert_ad(db, ad_data)
                    count += 1

            except Exception as e:
                errors.append(f"{comp['name']}: {str(e)}")
                logger.error(f"Fetch failed for {comp['name']}: {e}")

    return {
        "status": "success" if not errors else "partial",
        "ads_loaded": count,
        "errors": errors[:5]
    }


@app.post("/api/reseed")
def reseed_data(db: Session = Depends(get_db)):
    """Reset and reseed all sample data."""
    db.query(AdRecord).delete()
    db.commit()
    _seed_sample_data(db)
    count = db.query(AdRecord).count()
    return {"status": "ok", "ads_seeded": count}


@app.get("/api/themes")
def get_themes():
    """Return all available ad themes for filter UI."""
    return {
        "themes": [
            {"key": "ugc_testimonial", "label": "UGC / Testimonial", "description": "Real customer stories"},
            {"key": "doctor_authority", "label": "Doctor / Expert Authority", "description": "Clinical/professional backing"},
            {"key": "offer_promo", "label": "Offer / Promo", "description": "Discounts and deals"},
            {"key": "ingredient_science", "label": "Ingredient Science", "description": "Science-backed claims"},
            {"key": "community_story", "label": "Community Story", "description": "Social proof at scale"},
            {"key": "before_after", "label": "Before / After", "description": "Transformation results"},
            {"key": "parent_reassurance", "label": "Parent Reassurance", "description": "Parenting/safety focused"},
        ]
    }


def _ad_to_dict(ad: AdRecord) -> dict:
    return {
        "id": ad.id,
        "page_name": ad.page_name,
        "brand_key": ad.brand_key,
        "competitor_name": ad.competitor_name,
        "ad_body": ad.ad_body,
        "ad_title": ad.ad_title,
        "media_type": ad.media_type,
        "theme": ad.theme,
        "is_active": ad.is_active,
        "run_days": ad.run_days,
        "is_top_performer": ad.is_top_performer,
        "is_sample": ad.is_sample,
        "ad_delivery_start_time": ad.ad_delivery_start_time.isoformat() if ad.ad_delivery_start_time else None,
        "ad_delivery_stop_time": ad.ad_delivery_stop_time.isoformat() if ad.ad_delivery_stop_time else None,
        "spend_lower": ad.spend_lower,
        "spend_upper": ad.spend_upper,
        "impressions_lower": ad.impressions_lower,
        "impressions_upper": ad.impressions_upper,
        "ad_snapshot_url": ad.ad_snapshot_url,
        "publisher_platforms": json.loads(ad.publisher_platforms) if ad.publisher_platforms else [],
    }


# Serve frontend
if os.path.exists(FRONTEND_DIR):
    app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")

    @app.get("/")
    def serve_frontend():
        return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)