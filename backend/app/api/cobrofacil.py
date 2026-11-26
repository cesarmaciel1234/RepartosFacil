import json
import secrets
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.local import Document

router = APIRouter(prefix="/api/cobrofacil", tags=["cobrofacil"])


class CobroFacilProductItem(BaseModel):
    id: Optional[str] = None
    name: str
    price: float
    unit: Optional[str] = "kg"
    description: Optional[str] = ""
    category: Optional[str] = "vacuno"
    stockKg: Optional[float] = 0.0
    image: Optional[str] = None
    badge: Optional[str] = None


class CobroFacilSyncPayload(BaseModel):
    companyId: str
    companyName: str
    branchName: Optional[str] = None
    terminalId: Optional[str] = None
    category: Optional[str] = "Carnes y Pescados"
    address: Optional[str] = "Tucumán 2130, Rosario"
    phone: Optional[str] = "+54 9 341 555-1234"
    items: List[CobroFacilProductItem]


@router.post("/sync-inventory")
def sync_inventory(payload: CobroFacilSyncPayload, db: Session = Depends(get_db)):
    """
    Recibe la auditoría de inventario automático de una empresa desde Cobro Fácil (TPV / Render),
    crea o actualiza la empresa y sincroniza su catálogo en la base de datos de Reparto Fácil.
    """
    now_iso = datetime.utcnow().isoformat()
    now_dt = datetime.utcnow()

    # 1. Registrar / Actualizar Empresa
    company_data = {
        "id": payload.companyId,
        "name": payload.companyName,
        "branch": payload.branchName or f"{payload.companyName} - {payload.terminalId or 'TPV-01'}",
        "terminalId": payload.terminalId,
        "category": payload.category or "Carnes y Pescados",
        "categorySlug": "carnes" if "carne" in (payload.category or "").lower() else "kioscos",
        "address": payload.address,
        "phone": payload.phone,
        "rating": 4.8,
        "ratingCount": 350,
        "deliveryTimeMin": 15,
        "deliveryTimeMax": 40,
        "deliveryFee": 1605,
        "badges": [
            f"TPV Cobro Fácil: {payload.terminalId or 'Activo'}",
            "Stock auditado en tiempo real",
        ],
        "cobroFacilTerminal": payload.terminalId or "MACIEL - DESKTOP-7Q2Q4VD",
        "cobroFacilApiEndpoint": "https://cobrofacil.onrender.com",
        "isOpen": True,
        "lastInventorySync": now_iso,
    }

    company_doc = (
        db.query(Document)
        .filter(Document.collection == "companies", Document.document_id == payload.companyId)
        .first()
    )

    if company_doc:
        company_doc.data = json.dumps(company_data)
        company_doc.updated_at = now_dt
    else:
        new_doc = Document(
            id=str(secrets.token_hex(16)),
            collection="companies",
            document_id=payload.companyId,
            data=json.dumps(company_data),
            created_at=now_dt,
            updated_at=now_dt,
        )
        db.add(new_doc)

    # 2. Registrar / Actualizar Catálogo de Productos
    synced_product_ids = []
    for item in payload.items:
        prod_id = item.id or f"{payload.companyId}-{item.name.lower().replace(' ', '-')}"
        prod_data = {
            "id": prod_id,
            "name": item.name,
            "category": item.category or "vacuno",
            "price": item.price,
            "unit": item.unit or "kg",
            "description": item.description or f"{item.name} auditado en sistema de Cobro Fácil.",
            "image": item.image
            or "https://images.unsplash.com/photo-1544025162-d76694265947?w=600&auto=format&fit=crop&q=80",
            "stockKg": item.stockKg,
            "companyId": payload.companyId,
            "companyName": payload.companyName,
            "badge": item.badge or "TPV Cobro Fácil",
            "distanceKm": 1.2,
            "lastSynced": now_iso,
        }

        prod_doc = (
            db.query(Document)
            .filter(Document.collection == "products", Document.document_id == prod_id)
            .first()
        )

        if prod_doc:
            prod_doc.data = json.dumps(prod_data)
            prod_doc.updated_at = now_dt
        else:
            new_prod = Document(
                id=str(secrets.token_hex(16)),
                collection="products",
                document_id=prod_id,
                data=json.dumps(prod_data),
                created_at=now_dt,
                updated_at=now_dt,
            )
            db.add(new_prod)

        synced_product_ids.append(prod_id)

    db.commit()

    return {
        "status": "success",
        "companyId": payload.companyId,
        "companyName": payload.companyName,
        "terminal": payload.terminalId,
        "syncedItemsCount": len(synced_product_ids),
        "syncedProductIds": synced_product_ids,
        "message": f"Inventario de {payload.companyName} auditado y sincronizado automáticamente con Reparto Fácil.",
    }
