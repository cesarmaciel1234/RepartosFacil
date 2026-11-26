import os
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta
import hashlib
from tempfile import TemporaryDirectory
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

test_database = TemporaryDirectory(prefix="repartofacil-test-")
os.environ["DATABASE_URL"] = f"sqlite:///{test_database.name}/test.db"

from app.main import app
from app.database import engine
from app.database import SessionLocal
from app.models.local import LoginThrottle


client = TestClient(app)

@pytest.fixture(scope="session", autouse=True)
def cleanup_database():
    yield
    engine.dispose()
    test_database.cleanup()


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["database"] == "sqlite"


def test_registration_preserves_client_role_and_rejects_admin():
    client_response = client.post(
        "/api/auth/register",
        json={
            "email": f"client-{uuid4()}@example.com",
            "password": "valid-password",
            "display_name": "Comprador de Prueba",
            "role": "Client",
        },
    )
    assert client_response.status_code == 200
    assert client_response.json()["user"]["role"] == "Client"

    admin_response = client.post(
        "/api/auth/register",
        json={
            "email": f"admin-{uuid4()}@example.com",
            "password": "valid-password",
            "display_name": "Admin de Prueba",
            "role": "Admin",
        },
    )
    assert admin_response.status_code == 400


def test_registration_rejects_short_passwords():
    response = client.post(
        "/api/auth/register",
        json={
            "email": f"short-{uuid4()}@example.com",
            "password": "1234567",
            "role": "Driver",
        },
    )
    assert response.status_code == 400


def test_registered_user_can_authenticate_and_invalid_token_is_rejected():
    email = f"auth-{uuid4()}@example.com"
    created = client.post(
        "/api/auth/register",
        json={"email": email, "password": "valid-password", "role": "Client"},
    )
    assert created.status_code == 200
    login = client.post("/api/auth/login", json={"email": email, "password": "valid-password"})
    assert login.status_code == 200
    token = login.json()["access_token"]
    current = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert current.status_code == 200
    assert current.json()["role"] == "Client"
    assert current.json()["isAnonymous"] is False
    assert client.get("/api/auth/me", headers={"Authorization": "Bearer invalid"}).status_code == 401


def test_login_limits_attempts_per_account_and_normalizes_alias():
    username = f"driver-{uuid4()}"
    email = f"{username}@repartofacil.com"
    assert client.post("/api/auth/register", json={
        "email": email, "password": "valid-password", "role": "Driver",
    }).status_code == 200
    for _ in range(5):
        assert client.post("/api/auth/login", json={"email": username, "password": "wrong"}).status_code == 401
    blocked = client.post("/api/auth/login", json={"email": email, "password": "valid-password"})
    assert blocked.status_code == 429
    assert int(blocked.headers["retry-after"]) > 0
    assert client.post("/api/auth/login", json={"email": "other@example.com", "password": "wrong"}).status_code == 401
    with SessionLocal() as db:
        key = hashlib.sha256(email.encode()).hexdigest()
        db.query(LoginThrottle).filter(LoginThrottle.account_key == key).update({
            LoginThrottle.expires_at: datetime.utcnow() - timedelta(seconds=1),
        })
        db.commit()
    assert client.post("/api/auth/login", json={"email": email, "password": "valid-password"}).status_code == 200


def test_successful_login_clears_failed_attempts():
    email = f"auth-{uuid4()}@example.com"
    assert client.post("/api/auth/register", json={
        "email": email, "password": "valid-password", "role": "Client",
    }).status_code == 200
    for _ in range(4):
        assert client.post("/api/auth/login", json={"email": email, "password": "wrong"}).status_code == 401
    assert client.post("/api/auth/login", json={"email": email, "password": "valid-password"}).status_code == 200
    assert client.post("/api/auth/login", json={"email": email, "password": "wrong"}).status_code == 401


def test_concurrent_login_attempts_share_the_limit():
    email = f"auth-{uuid4()}@example.com"
    assert client.post("/api/auth/register", json={
        "email": email, "password": "valid-password", "role": "Client",
    }).status_code == 200
    def attempt(_):
        with TestClient(app) as concurrent_client:
            return concurrent_client.post("/api/auth/login", json={"email": email, "password": "wrong"}).status_code
    with ThreadPoolExecutor(max_workers=8) as executor:
        results = list(executor.map(attempt, range(8)))
    assert results.count(401) == 5
    assert results.count(429) == 3


def test_legacy_orders_and_alerts_are_not_accessible():
    assert client.get("/api/db/orders").status_code == 410
    assert client.get("/api/db/orders/order-1/messages").status_code == 410
    assert client.get("/api/db/alerts").status_code == 410
    anonymous = client.post("/api/auth/anonymous", json={"display_name": "Prueba"}).json()
    headers = {"Authorization": f"Bearer {anonymous['access_token']}"}
    assert client.post("/api/db/orders", json={"status": "Pending"}, headers=headers).status_code == 410


def test_private_profiles_require_owner_and_matching_role():
    registered = client.post(
        "/api/auth/register",
        json={"email": f"driver-{uuid4()}@example.com", "password": "valid-password", "role": "Driver"},
    ).json()
    driver_id = registered["user"]["id"]
    headers = {"Authorization": f"Bearer {registered['access_token']}"}
    assert client.get(f"/api/db/driverProfiles/{driver_id}").status_code == 401
    assert client.patch(f"/api/db/driverProfiles/{driver_id}", json={"name": "Prueba"}, headers=headers).status_code == 200
    assert client.get(f"/api/db/driverProfiles/{driver_id}", headers=headers).status_code == 200
    assert client.get("/api/db/driverProfiles", headers=headers).status_code == 403
    assert client.get("/api/db/driverProfiles/other", headers=headers).status_code == 403
    assert client.patch(f"/api/db/clients/{driver_id}", json={"name": "Prueba"}, headers=headers).status_code == 403
