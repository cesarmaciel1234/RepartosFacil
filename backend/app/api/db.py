import json
import uuid
from datetime import datetime
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.auth import bearer, get_current_user
from fastapi.security import HTTPAuthorizationCredentials
from app.database import get_db
from app.models.local import Document, LocalUser


router = APIRouter(prefix="/api/db", tags=["database"])


def authorize_document_path(path: str, user: Optional[LocalUser]) -> None:
    parts = [part for part in path.strip("/").split("/") if part]
    if not parts:
        raise HTTPException(status_code=400, detail="A collection path is required")
    if parts[0] in {"orders", "alerts"}:
        raise HTTPException(status_code=410, detail="Legacy collection is no longer available")
    expected_role = {"clients": "client", "driverProfiles": "driver"}.get(parts[0])
    if parts[0] in {"clients", "driverProfiles", "users"}:
        if not user or user.is_anonymous == "true":
            raise HTTPException(status_code=401, detail="Registered account required")
        if len(parts) < 2 or parts[1] != user.id or (expected_role and user.role.lower() != expected_role):
            raise HTTPException(status_code=403, detail="Document does not belong to this account")

ORDER_TRANSITIONS = {
    "Pending": {"Assigned"},
    "Assigned": {"Picked Up", "Pending", "In Transit"},
    "Picked Up": {"In Transit", "Delivered", "Pending"},
    "In Transit": {"Delivered", "Pending"},
    "Delivered": set(),
}


def validate_order_transition(
    current: dict,
    payload: dict,
    user: LocalUser,
) -> dict:
    if "status" not in payload:
        return payload

    old_status = str(current.get("status", "Pending"))
    new_status = str(payload["status"])
    if old_status == new_status:
        return payload
    if new_status not in ORDER_TRANSITIONS.get(old_status, set()):
        raise HTTPException(
            status_code=409,
            detail=f"Invalid order transition: {old_status} -> {new_status}",
        )

    is_admin = user.role.lower() == "admin"
    if new_status == "Assigned":
        driver_id = payload.get("driverId") or current.get("driverId")
        if not is_admin and driver_id != user.id:
            raise HTTPException(status_code=403, detail="The order must be assigned to the current driver")
    elif new_status in {"Picked Up", "In Transit", "Delivered"}:
        if not is_admin and current.get("driverId") != user.id:
            raise HTTPException(status_code=403, detail="Only the assigned driver can update this order")
    elif new_status == "Pending" and not is_admin and current.get("driverId") not in {None, user.id}:
        raise HTTPException(status_code=403, detail="Only the assigned driver or an admin can release this order")
    return payload


def split_path(path: str):
    parts = [part for part in path.strip("/").split("/") if part]
    if not parts:
        raise HTTPException(status_code=400, detail="A collection path is required")
    if len(parts) % 2 == 0:
        return "/".join(parts[:-1]), parts[-1]
    return "/".join(parts), None


def parse_data(raw: str) -> dict:
    data = json.loads(raw)
    data["id"] = data.get("id")
    return data


def apply_specials(current: dict, incoming: dict) -> dict:
    result = dict(current)
    for key, value in incoming.items():
        if isinstance(value, dict) and "__arrayUnion" in value:
            items = value["__arrayUnion"]
            existing = list(result.get(key, []) or [])
            for item in items:
                if item not in existing:
                    existing.append(item)
            result[key] = existing
        elif isinstance(value, dict) and "__arrayRemove" in value:
            items = value["__arrayRemove"]
            existing = list(result.get(key, []) or [])
            result[key] = [item for item in existing if item not in items]
        else:
            result[key] = value
    return result


@router.get("/{path:path}")
def read_path(
    path: str,
    where: Optional[list[str]] = Query(default=None),
    orderBy: Optional[str] = None,
    limit: Optional[int] = None,
    db: Session = Depends(get_db),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer),
):
    root = path.strip("/").split("/", 1)[0]
    user = get_current_user(credentials, db) if root in {"clients", "driverProfiles", "users"} else None
    authorize_document_path(path, user)
    collection, document_id = split_path(path)
    if document_id:
        row = db.query(Document).filter(
            Document.collection == collection,
            Document.document_id == document_id,
        ).first()
        if not row:
            raise HTTPException(status_code=404, detail="Document not found")
        data = parse_data(row.data)
        data.setdefault("id", document_id)
        return data

    rows = db.query(Document).filter(Document.collection == collection).all()
    result = []
    for row in rows:
        data = parse_data(row.data)
        data.setdefault("id", row.document_id)
        keep = True
        for expression in where or []:
            if ":" not in expression:
                continue
            field, operator, value = expression.split(":", 2)
            actual = data.get(field)
            if operator == "==" and str(actual) != value:
                keep = False
            elif operator == "!=" and str(actual) == value:
                keep = False
            elif operator == "in":
                choices = value.split(",")
                if str(actual) not in choices:
                    keep = False
        if keep:
            result.append(data)

    if orderBy:
        field, direction = (orderBy.rsplit(":", 1) + ["asc"])[:2]
        result.sort(key=lambda item: str(item.get(field, "")), reverse=direction == "desc")
    if limit:
        result = result[:limit]
    return result


@router.post("/{path:path}")
def add_document(
    path: str,
    payload: dict[str, Any],
    db: Session = Depends(get_db),
    user: LocalUser = Depends(get_current_user),
):
    authorize_document_path(path, user)
    collection, document_id = split_path(path)
    if document_id:
        raise HTTPException(status_code=400, detail="Use PUT or PATCH to write a document")
    document_id = str(payload.get("id") or uuid.uuid4())
    payload = dict(payload)
    payload["id"] = document_id
    payload.setdefault("createdAt", datetime.utcnow().isoformat())
    payload.setdefault("updatedAt", datetime.utcnow().isoformat())
    row = Document(collection=collection, document_id=document_id, data=json.dumps(payload))
    db.add(row)
    db.commit()
    db.refresh(row)
    return {"id": document_id, **payload}


@router.put("/{path:path}")
@router.patch("/{path:path}")
def write_document(
    path: str,
    payload: dict[str, Any],
    db: Session = Depends(get_db),
    user: LocalUser = Depends(get_current_user),
):
    authorize_document_path(path, user)
    collection, document_id = split_path(path)
    if not document_id:
        raise HTTPException(status_code=400, detail="A document path is required")
    payload = dict(payload)
    payload["id"] = document_id
    payload["updatedAt"] = datetime.utcnow().isoformat()

    row = db.query(Document).filter(
        Document.collection == collection,
        Document.document_id == document_id,
    ).first()
    if row:
        current = parse_data(row.data)
        if collection == "orders":
            payload = validate_order_transition(current, payload, user)
        merged = apply_specials(current, payload)
        merged["id"] = document_id
        merged.setdefault("createdAt", datetime.utcnow().isoformat())
        row.data = json.dumps(merged)
    else:
        if collection == "orders" and "status" in payload:
            payload = validate_order_transition(
                {"status": "Pending", "driverId": None},
                payload,
                user,
            )
        payload.setdefault("createdAt", datetime.utcnow().isoformat())
        row = Document(collection=collection, document_id=document_id, data=json.dumps(payload))
        db.add(row)
    db.commit()
    db.refresh(row)
    data = parse_data(row.data)
    data.setdefault("id", document_id)
    return data


@router.delete("/{path:path}")
def delete_document(
    path: str,
    db: Session = Depends(get_db),
    user: LocalUser = Depends(get_current_user),
):
    authorize_document_path(path, user)
    collection, document_id = split_path(path)
    if not document_id:
        raise HTTPException(status_code=400, detail="A document path is required")
    row = db.query(Document).filter(
        Document.collection == collection,
        Document.document_id == document_id,
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="Document not found")
    db.delete(row)
    db.commit()
    return {"deleted": True}
