from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.main import api_router

app = FastAPI(
    title=settings.PROJECT_NAME,
    version="0.1.0",
    description="SourceMind AI Backend",
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# Set all CORS enabled origins
if settings.BACKEND_CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[str(origin).rstrip("/") for origin in settings.BACKEND_CORS_ORIGINS],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

app.include_router(api_router, prefix=settings.API_V1_STR)

@app.on_event("startup")
async def on_startup():
    from app.db.init_db import init_models
    try:
        await init_models()
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Failed to auto-create DB tables on startup: {e}")

@app.get("/health")
def health_check():
    return {"status": "ok", "version": "0.1.0"}
