import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from app.database import Base, engine, is_sqlite
from app.api import auth, db, cobrofacil
from app.models.local import Document, LocalUser


app = FastAPI(title="RepartoFacil Local API", version="2.0")

cors_origins_env = os.getenv("CORS_ORIGINS", "")
allowed_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://repartofacil.onrender.com",
    "https://repartofacil-web.onrender.com",
]
if cors_origins_env:
    for o in cors_origins_env.split(","):
        stripped = o.strip()
        if stripped and stripped not in allowed_origins:
            allowed_origins.append(stripped)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins if "*" not in allowed_origins else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Base.metadata.create_all(bind=engine)

app.include_router(auth.router)
app.include_router(db.router)
app.include_router(cobrofacil.router)

static_dir = os.path.join(os.path.dirname(__file__), "static")
if os.path.isdir(static_dir):
    app.mount("/static", StaticFiles(directory=static_dir), name="static")


@app.get("/health")
def health():
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except Exception:
        return JSONResponse(
            {"status": "degraded", "database": "unavailable", "service": "repartofacil-local"},
            status_code=503,
        )
    return {
        "status": "ok",
        "database": "sqlite" if is_sqlite else "external",
        "service": "repartofacil-local",
    }
