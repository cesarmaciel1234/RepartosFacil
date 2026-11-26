import hashlib
import secrets
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import case, update
from sqlalchemy.exc import IntegrityError

from app.database import get_db
from app.config import settings
from app.models.local import LocalUser, LoginThrottle


router = APIRouter(prefix="/api/auth", tags=["auth"])
bearer = HTTPBearer(auto_error=False)
LOGIN_ATTEMPTS = 5
LOGIN_WINDOW = timedelta(minutes=15)


class LoginRequest(BaseModel):
    email: str
    password: str
    display_name: Optional[str] = None
    role: str = "Driver"


class AnonymousRequest(BaseModel):
    display_name: str


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 120_000).hex()
    return f"{salt}${digest}"


def verify_password(password: str, stored: str) -> bool:
    try:
        salt, digest = stored.split("$", 1)
    except ValueError:
        return False
    actual = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 120_000).hex()
    return secrets.compare_digest(actual, digest)


def create_token(user_id: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "role": role,
        "exp": datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: Session = Depends(get_db),
) -> LocalUser:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
        user_id = payload.get("sub")
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    user = db.query(LocalUser).filter(LocalUser.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


def user_data(user: LocalUser) -> dict:
    return {
        "uid": user.id,
        "id": user.id,
        "email": user.email,
        "displayName": user.display_name,
        "firstName": user.display_name,
        "role": user.role,
        "isAnonymous": user.is_anonymous == "true",
    }


@router.post("/anonymous", response_model=AuthResponse)
def anonymous_login(request: AnonymousRequest, db: Session = Depends(get_db)):
    user_id = str(secrets.uuid4()) if hasattr(secrets, "uuid4") else str(__import__("uuid").uuid4())
    email = f"{user_id}@rutarapida.local"
    user = LocalUser(
        id=user_id,
        email=email,
        password_hash=None,
        display_name=request.display_name,
        role="Driver",
        is_anonymous="true",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return AuthResponse(access_token=create_token(user.id, user.role), user=user_data(user))


@router.post("/register", response_model=AuthResponse)
def register(request: LoginRequest, db: Session = Depends(get_db)):
    existing = db.query(LocalUser).filter(LocalUser.email == request.email.lower()).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    if len(request.password) < 8:
        raise HTTPException(status_code=400, detail="Password must contain at least 8 characters")
    user_id = str(__import__("uuid").uuid4())
    requested_role = request.role.strip().lower()
    roles = {"client": "Client", "driver": "Driver"}
    role = roles.get(requested_role)
    if role is None:
        raise HTTPException(status_code=400, detail="Role must be Client or Driver")
    user = LocalUser(
        id=user_id,
        email=request.email.lower(),
        password_hash=hash_password(request.password),
        display_name=request.display_name,
        role=role,
        is_anonymous="false",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return AuthResponse(access_token=create_token(user.id, user.role), user=user_data(user))


@router.post("/login", response_model=AuthResponse)
def login(request: LoginRequest, db: Session = Depends(get_db)):
    ident = request.email.lower().strip()
    canonical = ident if "@" in ident else f"{ident}@repartofacil.com"
    key = hashlib.sha256(canonical.encode()).hexdigest()
    now = datetime.utcnow()
    expires = now + LOGIN_WINDOW

    def increment():
        return db.execute(
            update(LoginThrottle)
            .where(LoginThrottle.account_key == key)
            .values(
                attempts=case((LoginThrottle.expires_at <= now, 1), else_=LoginThrottle.attempts + 1),
                expires_at=case((LoginThrottle.expires_at <= now, expires), else_=LoginThrottle.expires_at),
            )
            .returning(LoginThrottle.attempts, LoginThrottle.expires_at)
        ).first()

    attempt = increment()
    if attempt is None:
        db.add(LoginThrottle(account_key=key, attempts=1, expires_at=expires))
        try:
            db.commit()
            attempt = (1, expires)
        except IntegrityError:
            db.rollback()
            attempt = increment()
            db.commit()
    else:
        db.commit()
    if attempt is None:
        raise HTTPException(status_code=503, detail="No se pudo verificar el límite de acceso")
    if attempt[0] > LOGIN_ATTEMPTS:
        retry = max(1, int((attempt[1] - now).total_seconds()))
        raise HTTPException(
            status_code=429,
            detail="Demasiados intentos. Intentá nuevamente más tarde.",
            headers={"Retry-After": str(retry)},
        )
    user = db.query(LocalUser).filter(
        (LocalUser.email == ident) | (LocalUser.email == f"{ident}@repartofacil.com")
    ).first()
    if not user or not user.password_hash or not verify_password(request.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    db.query(LoginThrottle).filter(LoginThrottle.account_key == key).delete()
    db.commit()
    return AuthResponse(access_token=create_token(user.id, user.role), user=user_data(user))


@router.get("/me")
def me(user: LocalUser = Depends(get_current_user)):
    try:
        return user_data(user)
    except Exception as e:
        import logging
        logging.error(f"Error en /api/auth/me: {e}")
        raise HTTPException(status_code=500, detail="Error interno del servidor")
