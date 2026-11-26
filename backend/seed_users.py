import secrets
import hashlib
import sqlite3
import json
import os
import sys
from datetime import datetime

# Asegurar importación de app
sys.path.insert(0, os.path.dirname(__file__))
from app.database import engine, Base
from app.models.local import LocalUser, Document

# Crear tablas si no existen
Base.metadata.create_all(bind=engine)

db_path = os.path.join(os.path.dirname(__file__), "repartofacil.db")
con = sqlite3.connect(db_path)
cur = con.cursor()

def hash_pw(pw: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", pw.encode(), salt.encode(), 120_000).hex()
    return f"{salt}${digest}"

# 1. Eliminar anteriores
cur.execute("DELETE FROM local_users WHERE email IN ('repartidor@repartofacil.com', 'cliente@repartofacil.com', 'repartidor', 'cliente')")
cur.execute("DELETE FROM documents WHERE document_id IN ('repartidor-01', 'cliente-01')")

pw_hash = hash_pw("12345678")

# 2. Insertar Repartidor (con email completo y con alias simple)
rep_id = "repartidor-01"
cur.execute(
    "INSERT INTO local_users (id, email, password_hash, display_name, role, is_anonymous, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    (rep_id, "repartidor@repartofacil.com", pw_hash, "Lucas Motomensajero", "Driver", "false", datetime.utcnow())
)
cur.execute(
    "INSERT INTO local_users (id, email, password_hash, display_name, role, is_anonymous, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ("repartidor-alias", "repartidor", pw_hash, "Lucas Motomensajero", "Driver", "false", datetime.utcnow())
)

rep_data = json.dumps({
    "id": rep_id,
    "uid": rep_id,
    "firstName": "Lucas Motomensajero",
    "email": "repartidor@repartofacil.com",
    "role": "Driver",
    "vehicleType": "Motorcycle",
    "availabilityStatus": "Available",
    "currentLatitude": -32.9372,
    "currentLongitude": -60.6542,
    "rating": 4.95,
    "completedDeliveries": 142,
    "createdAt": datetime.utcnow().isoformat(),
    "updatedAt": datetime.utcnow().isoformat()
})
cur.execute(
    "INSERT OR REPLACE INTO documents (id, collection, document_id, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    (str(secrets.token_hex(16)), "driverProfiles", rep_id, rep_data, datetime.utcnow(), datetime.utcnow())
)

# 3. Insertar Cliente (con email completo y con alias simple)
cli_id = "cliente-01"
cur.execute(
    "INSERT INTO local_users (id, email, password_hash, display_name, role, is_anonymous, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    (cli_id, "cliente@repartofacil.com", pw_hash, "Cliente Frecuente", "Client", "false", datetime.utcnow())
)
cur.execute(
    "INSERT INTO local_users (id, email, password_hash, display_name, role, is_anonymous, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ("cliente-alias", "cliente", pw_hash, "Cliente Frecuente", "Client", "false", datetime.utcnow())
)

cli_data = json.dumps({
    "id": cli_id,
    "uid": cli_id,
    "displayName": "Cliente Frecuente",
    "email": "cliente@repartofacil.com",
    "role": "Client",
    "phone": "+54 9 341 555-1234",
    "address": "Bv. Oroño 1200, Rosario",
    "savedAddresses": ["Bv. Oroño 1200, Rosario", "San Lorenzo 2040, Rosario"],
    "ordersCount": 12,
    "createdAt": datetime.utcnow().isoformat(),
    "updatedAt": datetime.utcnow().isoformat()
})
cur.execute(
    "INSERT OR REPLACE INTO documents (id, collection, document_id, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    (str(secrets.token_hex(16)), "clients", cli_id, cli_data, datetime.utcnow(), datetime.utcnow())
)

# 4. Insertar Empresas (Conectadas automáticamente a Cobro Fácil TPV)
companies = [
    {
        "id": "frigorifico-maciel",
        "name": "Frigorífico Maciel",
        "branch": "MACIEL · MACIEL - DESKTOP-7Q2Q4VD",
        "category": "Carnes y Pescados",
        "categorySlug": "carnes",
        "rating": 4.8,
        "ratingCount": 342,
        "deliveryTimeMin": 15,
        "deliveryTimeMax": 40,
        "deliveryFee": 1605,
        "freeDeliveryThreshold": 35000,
        "badges": ["TPV Cobro Fácil: MACIEL - DESKTOP-7Q2Q4VD", "Mismo precio que en local"],
        "address": "Tucumán 2130, Rosario",
        "phone": "+54 9 341 555-1234",
        "cobroFacilTerminal": "MACIEL - DESKTOP-7Q2Q4VD",
        "cobroFacilApiEndpoint": "https://cobrofacil.onrender.com",
        "isOpen": True
    },
    {
        "id": "kiosco-al-toque",
        "name": "Kiosco Al Toque - 24hs",
        "branch": "AL TOQUE · TPV-01",
        "category": "Kioscos y Golosinas",
        "categorySlug": "kioscos",
        "rating": 4.6,
        "ratingCount": 189,
        "deliveryTimeMin": 15,
        "deliveryTimeMax": 30,
        "deliveryFee": 1359,
        "freeDeliveryThreshold": 25000,
        "badges": ["Abierto 24hs", "Bebidas frías"],
        "address": "San Lorenzo 1920, Rosario",
        "phone": "+54 9 341 444-5678",
        "cobroFacilTerminal": "AL TOQUE - TPV-01",
        "cobroFacilApiEndpoint": "https://cobrofacil.onrender.com",
        "isOpen": True
    },
    {
        "id": "res-boutique",
        "name": "Res - Carnes y Cortes Especiales",
        "branch": "RES · BOUTIQUE-01",
        "category": "Carnes y Pescados",
        "categorySlug": "carnes",
        "rating": 4.7,
        "ratingCount": 215,
        "deliveryTimeMin": 20,
        "deliveryTimeMax": 45,
        "deliveryFee": 2109,
        "freeDeliveryThreshold": 40000,
        "badges": ["Hasta 30% OFF", "Novillito de Campo"],
        "address": "Santa Fe 1850, Rosario",
        "phone": "+54 9 341 666-7890",
        "cobroFacilTerminal": "RES · BOUTIQUE-01",
        "cobroFacilApiEndpoint": "https://cobrofacil.onrender.com",
        "isOpen": True
    },
    {
        "id": "minimercado-pellegrini",
        "name": "Minimercado & Fiambrería Pellegrini",
        "branch": "PELLEGRINI · TPV-MAIN",
        "category": "Minimercados y Almacén",
        "categorySlug": "minimercados",
        "rating": 4.5,
        "ratingCount": 98,
        "deliveryTimeMin": 20,
        "deliveryTimeMax": 40,
        "deliveryFee": 1500,
        "freeDeliveryThreshold": 30000,
        "badges": ["Quesos y Fiambres al corte"],
        "address": "Av. Pellegrini 2210, Rosario",
        "phone": "+54 9 341 777-4321",
        "cobroFacilTerminal": "PELLEGRINI · TPV-MAIN",
        "cobroFacilApiEndpoint": "https://cobrofacil.onrender.com",
        "isOpen": True
    }
]

for comp in companies:
    cur.execute(
        "INSERT OR REPLACE INTO documents (id, collection, document_id, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
        (str(secrets.token_hex(16)), "companies", comp["id"], json.dumps(comp), datetime.utcnow(), datetime.utcnow())
    )

# 5. Insertar Productos de Auditoría Cobro Fácil (Captura 2 del usuario)
audited_products = [
    {
        "id": "maciel-suprema",
        "name": "Suprema",
        "category": "pollo",
        "price": 6800,
        "unit": "kg",
        "description": "Suprema fresca de pollo en sistema Cobro Fácil.",
        "image": "https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=600&auto=format&fit=crop&q=80",
        "stockKg": 999584.63,
        "companyId": "frigorifico-maciel",
        "companyName": "Frigorífico Maciel",
        "badge": "TPV: 999.584 kg",
        "distanceKm": 1.2
    },
    {
        "id": "maciel-asado",
        "name": "Asado",
        "category": "vacuno",
        "price": 9800,
        "unit": "kg",
        "description": "Corte de asado vacuno parrillero en sistema Cobro Fácil.",
        "image": "https://images.unsplash.com/photo-1544025162-d76694265947?w=600&auto=format&fit=crop&q=80",
        "stockKg": 999804.14,
        "companyId": "frigorifico-maciel",
        "companyName": "Frigorífico Maciel",
        "badge": "TPV: 999.804 kg",
        "isPopular": True,
        "distanceKm": 1.2
    },
    {
        "id": "maciel-vacio",
        "name": "Vacio",
        "category": "vacuno",
        "price": 10400,
        "unit": "kg",
        "description": "Vacío fino de novillo auditado en Cobro Fácil.",
        "image": "https://images.unsplash.com/photo-1558030006-450675393462?w=600&auto=format&fit=crop&q=80",
        "stockKg": 999908.80,
        "companyId": "frigorifico-maciel",
        "companyName": "Frigorífico Maciel",
        "badge": "TPV: 999.908 kg",
        "isPopular": True,
        "distanceKm": 1.2
    },
    {
        "id": "maciel-oferta-vacio",
        "name": "Oferta De Vacio",
        "category": "vacuno",
        "price": 9900,
        "unit": "kg",
        "description": "Oferta especial de vacío en mostrador TPV Cobro Fácil.",
        "image": "https://images.unsplash.com/photo-1558030006-450675393462?w=600&auto=format&fit=crop&q=80",
        "stockKg": 999999.00,
        "companyId": "frigorifico-maciel",
        "companyName": "Frigorífico Maciel",
        "badge": "Oferta TPV: 999.999 kg",
        "distanceKm": 1.2
    },
    {
        "id": "maciel-tapa-nalga",
        "name": "Tapa De Nalga",
        "category": "vacuno",
        "price": 8900,
        "unit": "kg",
        "description": "Tapa de nalga tierna para horno o parrilla.",
        "image": "https://images.unsplash.com/photo-1588347818036-558601350947?w=600&auto=format&fit=crop&q=80",
        "stockKg": 999991.40,
        "companyId": "frigorifico-maciel",
        "companyName": "Frigorífico Maciel",
        "badge": "TPV: 999.991 kg",
        "distanceKm": 1.2
    },
    {
        "id": "maciel-matambre",
        "name": "Matambre",
        "category": "vacuno",
        "price": 9200,
        "unit": "kg",
        "description": "Matambre vacuno tierno auditado en sistema.",
        "image": "https://images.unsplash.com/photo-1588168333986-5078d3ae3976?w=600&auto=format&fit=crop&q=80",
        "stockKg": 999850.00,
        "companyId": "frigorifico-maciel",
        "companyName": "Frigorífico Maciel",
        "badge": "TPV: 999.850 kg",
        "distanceKm": 1.2
    }
]

for prod in audited_products:
    cur.execute(
        "INSERT OR REPLACE INTO documents (id, collection, document_id, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
        (str(secrets.token_hex(16)), "products", prod["id"], json.dumps(prod), datetime.utcnow(), datetime.utcnow())
    )

con.commit()
con.close()
print("✅ Empresas y auditoría de catálogo de Cobro Fácil sembradas en SQLite exitosamente")
