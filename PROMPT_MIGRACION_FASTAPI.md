# Prompt para Migración de RepartoFacil-web a FastAPI (Python)

## Contexto General

Migrar el proyecto **RepartoFacil-web** (Next.js + Firebase + Genkit JavaScript) a una arquitectura **FastAPI + Python** manteniendo la funcionalidad completa. El proyecto es una aplicación de logística de reparto con:

- **Frontend actual:** Next.js 15 con React 19, shadcn/ui, Leaflet maps
- **Backend actual:** Firebase (Auth + Firestore) + Genkit (Google AI) en JavaScript
- **Funcionalidades:**
  - Sistema de autenticación de usuarios (Admin/Conductor)
  - Rastreo GPS en tiempo real de conductores
  - Gestión de pedidos (orders)
  - Sistema de alertas (SOS, tráfico, incidencias)
  - Copiloto IA "Copo" con:
    - Chat conversacional
    - Transcripción de voz
    - Generación de respuesta de audio (TTS)
    - Generación de imágenes de celebración
    - Optimización de rutas con IA
    - Búsqueda en base de conocimientos (RAG)
  - Mapas interactivos con flota de conductores

## Estrategia de Migración Propuesta

### 1. Arquitectura Objetivo

```
Frontend (Next.js - MANTENER)
   ↓ HTTP/REST API
Backend (FastAPI + Python)
   ↓
PostgreSQL (Neon) - Reemplazar Firestore
   ↓
Google GenAI (Python SDK) - Migrar flows de IA
```

**Decisiones:**
- **Frontend:** MANTENER Next.js/React (no migrar a plantillas Jinja2)
- **Backend:** CREAR API REST con FastAPI
- **Base de datos:** MIGRAR de Firestore a PostgreSQL (Neon)
- **IA:** MIGRAR Genkit JavaScript a Python SDK o LangChain
- **Autenticación:** MIGRAR de Firebase Auth a JWT con FastAPI

### 2. Estructura de Proyecto FastAPI

```
repartofacil-backend/
├── app/
│   ├── __init__.py
│   ├── main.py                 # Entry point FastAPI
│   ├── config.py               # Configuración (env vars, database)
│   ├── database.py             # Pool de conexiones PostgreSQL
│   ├── models/                 # Pydantic models
│   │   ├── __init__.py
│   │   ├── user.py             # User, DriverProfile, Company
│   │   ├── order.py            # Order, OrderStatus
│   │   ├── alert.py            # Alert, AlertType
│   │   ├── ai.py               # CopilotInput, CopilotOutput
│   │   └── location.py         # LocationUpdate
│   ├── schemas/                # SQLAlchemy ORM models
│   │   ├── __init__.py
│   │   ├── user.py
│   │   ├── order.py
│   │   ├── alert.py
│   │   └── location.py
│   ├── api/                    # Rutas API
│   │   ├── __init__.py
│   │   ├── auth.py             # /api/auth/* (login, register, refresh)
│   │   ├── users.py            # /api/users/*
│   │   ├── orders.py           # /api/orders/*
│   │   ├── alerts.py           # /api/alerts/*
│   │   ├── location.py         # /api/location/* (GPS updates)
│   │   └── ai.py               # /api/ai/copilot
│   ├── services/               # Lógica de negocio
│   │   ├── __init__.py
│   │   ├── auth_service.py     # JWT creation/validation
│   │   ├── order_service.py
│   │   ├── alert_service.py
│   │   └── location_service.py
│   ├── ai/                     # Módulo IA (reemplazo de Genkit JS)
│   │   ├── __init__.py
│   │   ├── client.py           # Google GenAI Python client
│   │   ├── flows/
│   │   │   ├── __init__.py
│   │   │   ├── driver_copilot.py      # Flow principal de Copo
│   │   │   ├── route_optimization.py # Optimización de rutas
│   │   │   └── business_insights.py
│   │   ├── tools/
│   │   │   ├── __init__.py
│   │   │   ├── knowledge_base.py      # RAG: búsqueda en docs
│   │   │   ├── image_generation.py    # Generación de imágenes
│   │   │   └── route_tool.py          # Herramienta de rutas
│   │   └── schemas.py          # Pydantic schemas para IA
│   ├── middleware/
│   │   ├── __init__.py
│   │   └── auth.py             # JWT verification middleware
│   └── utils/
│       ├── __init__.py
│       └── geo.py              # Utilidades geográficas
├── alembic/                    # Migraciones de base de datos
│   ├── versions/
│   └── env.py
├── tests/
│   ├── __init__.py
│   ├── test_auth.py
│   ├── test_orders.py
│   └── test_ai.py
├── requirements.txt
├── .env.example
├── pyproject.toml
└── render.yaml                 # Configuración Render
```

### 3. Pasos de Migración Detallados

#### Paso 1: Configuración Inicial FastAPI

1. Crear estructura de carpetas
2. Configurar `requirements.txt` con:
   - `fastapi`
   - `uvicorn[standard]`
   - `sqlalchemy`
   - `asyncpg` (PostgreSQL async)
   - `pydantic`
   - `pydantic-settings`
   - `python-jose[cryptography]` (JWT)
   - `passlib[bcrypt]` (password hashing)
   - `python-multipart`
   - `google-genai` (GenAI Python SDK)
   - `langchain` (opcional, para RAG)
   - `alembic` (migraciones DB)
   - `pytest` + `pytest-asyncio` (tests)

3. Configurar `main.py`:
   ```python
   from fastapi import FastAPI
   from fastapi.middleware.cors import CORSMiddleware
   from app.api import auth, users, orders, alerts, location, ai

   app = FastAPI(title="RepartoFacil API")

   app.add_middleware(
       CORSMiddleware,
       allow_origins=["http://localhost:3000"], # Frontend URL
       allow_credentials=True,
       allow_methods=["*"],
       allow_headers=["*"],
   )

   app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
   app.include_router(users.router, prefix="/api/users", tags=["users"])
   app.include_router(orders.router, prefix="/api/orders", tags=["orders"])
   app.include_router(alerts.router, prefix="/api/alerts", tags=["alerts"])
   app.include_router(location.router, prefix="/api/location", tags=["location"])
   app.include_router(ai.router, prefix="/api/ai", tags=["ai"])
   ```

#### Paso 2: Migración de Base de Datos (Firestore → PostgreSQL)

**Modelos de datos actuales en Firestore:**
- `users/{uid}`: Información de usuario (role, firstName, etc.)
- `driverProfiles/{uid}`: Ubicación GPS en tiempo real
- `orders/{id}`: Pedidos con status, driverId, companyId
- `alerts/{id}`: Alertas (SOS, tráfico, etc.)

**Crear esquemas SQLAlchemy equivalentes:**

```python
# app/schemas/user.py
from sqlalchemy import Column, String, DateTime, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime
import uuid
import enum

class UserRole(str, enum.Enum):
    ADMIN = "Admin"
    DRIVER = "Driver"

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, nullable=False)
    password_hash = Column(String, nullable=False)  # New: for JWT auth
    first_name = Column(String)
    last_name = Column(String)
    role = Column(SQLEnum(UserRole), nullable=False)
    phone = Column(String)
    photo_url = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class DriverProfile(Base):
    __tablename__ = "driver_profiles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    current_latitude = Column(Float)
    current_longitude = Column(Float)
    last_location_update = Column(DateTime)
    is_online = Column(Boolean, default=True)
```

**Crear migraciones con Alembic:**
1. Inicializar Alembic: `alembic init alembic`
2. Configurar `alembic.ini` con URL de PostgreSQL
3. Crear migración: `alembic revision --autogenerate -m "Initial schema"`
4. Aplicar migración: `alembic upgrade head`

#### Paso 3: Migración de Autenticación (Firebase Auth → JWT)

**Implementar JWT authentication:**

```python
# app/services/auth_service.py
from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext

SECRET_KEY = os.getenv("JWT_SECRET_KEY")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 horas

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: timedelta = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def verify_token(token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None
```

**Endpoints de autenticación:**

```python
# app/api/auth.py
from fastapi import APIRouter, Depends, HTTPException, status
from app.models.user import UserCreate, UserLogin, Token
from app.services.auth_service import create_access_token, verify_password

router = APIRouter()

@router.post("/register", response_model=Token)
async def register(user: UserCreate, db: Session = Depends(get_db)):
    # Verificar si email existe
    # Hashear password
    # Crear usuario en DB
    # Retornar JWT token
    pass

@router.post("/login", response_model=Token)
async def login(credentials: UserLogin, db: Session = Depends(get_db)):
    # Verificar usuario
    # Verificar password
    # Retornar JWT token
    pass

@router.post("/refresh", response_model=Token)
async def refresh_token(token: str, db: Session = Depends(get_db)):
    # Verificar token
    # Retornar nuevo token
    pass
```

**Middleware para verificar JWT:**

```python
# app/middleware/auth.py
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

security = HTTPBearer()

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security), db: Session = Depends(get_db)):
    token = credentials.credentials
    payload = verify_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    user_id = payload.get("sub")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user
```

#### Paso 4: Migración de Endpoints API

**Reemplazar llamadas a Firestore con endpoints FastAPI:**

| Funcionalidad | Firebase Call Actual | Endpoint FastAPI Equivalente |
|---------------|---------------------|------------------------------|
| Login | `signInWithEmailAndPassword` | `POST /api/auth/login` |
| Get user data | `doc(firestore, "users", uid)` | `GET /api/users/me` |
| Get driver orders | `query(collection("orders"), where("driverId", "==", uid))` | `GET /api/orders?driver_id={uid}` |
| Get fleet (admin) | `query(collection("driverProfiles"))` | `GET /api/users/drivers` |
| Update GPS location | `setDocumentNonBlocking(driverRef, {lat, lng})` | `POST /api/location/update` |
| Get alerts | `query(collection("alerts"))` | `GET /api/alerts` |
| Create alert | `addDocumentNonBlocking(alertsRef, {...})` | `POST /api/alerts` |
| AI Copilot | `driverCopilot({...})` | `POST /api/ai/copilot` |

**Ejemplo de endpoint - Orders:**

```python
# app/api/orders.py
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.models.order import Order, OrderStatus
from app.database import get_db
from app.middleware.auth import get_current_user

router = APIRouter()

@router.get("/")
async def get_orders(
    driver_id: str = Query(None),
    company_id: str = Query(None),
    status: OrderStatus = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Order)

    if driver_id:
        query = query.filter(Order.driver_id == driver_id)
    if company_id:
        query = query.filter(Order.company_id == company_id)
    if status:
        query = query.filter(Order.status == status)

    return query.all()

@router.post("/")
async def create_order(order: OrderCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    new_order = Order(**order.dict())
    db.add(new_order)
    db.commit()
    db.refresh(new_order)
    return new_order
```

#### Paso 5: Migración de IA (Genkit JavaScript → Python)

**Opción A: Usar Google GenAI Python SDK (recomendado para consistencia)**

```python
# app/ai/client.py
import google.generativeai as genai
import os

genai.configure(api_key=os.getenv("GOOGLE_GENAI_API_KEY"))

class GenAIClient:
    def __init__(self):
        self.model = genai.GenerativeModel('gemini-2.5-flash')
        self.tts_model = genai.GenerativeModel('gemini-2.5-flash-preview-tts')

    async def generate_text(self, prompt: str) -> str:
        response = await self.model.generate_content_async(prompt)
        return response.text

    async def generate_audio(self, text: str) -> bytes:
        # Implementar TTS
        pass

    async def generate_image(self, prompt: str) -> str:
        # Implementar generación de imagen
        pass
```

**Migrar flow de Copilot:**

```python
# app/ai/flows/driver_copilot.py
from app.ai.client import GenAIClient
from app.ai.tools.knowledge_base import search_knowledge_base
from app.ai.tools.route_optimization import optimize_route
from app.ai.tools.image_generation import generate_completion_image

class DriverCopilotFlow:
    def __init__(self):
        self.client = GenAIClient()

    async def execute(self, input: DriverCopilotInput) -> DriverCopilotOutput:
        # Construir prompt similar al de Genkit JS
        prompt = self._build_prompt(input)

        # Detectar si requiere herramientas
        if self._requires_knowledge_search(input.conversation_history[-1]):
            kb_result = await search_knowledge_base(input.conversation_history[-1].content)
            prompt += f"\n\nBase de Conocimientos: {kb_result}"

        if self._requires_route_optimization(input.conversation_history[-1]):
            route_result = await optimize_route(input.active_orders, input.current_location)
            prompt += f"\n\nRuta Optimizada: {route_result}"

        # Generar respuesta
        response = await self.client.generate_text(prompt)

        # Generar audio si es necesario
        audio_url = None
        if response:
            audio_data = await self.client.generate_audio(response)
            audio_url = self._audio_to_base64(audio_data)

        # Generar imagen de celebración si el conductor completó una entrega
        image_url = None
        if self._is_completion_message(input.conversation_history[-1].content):
            image_url = await generate_completion_image()

        return DriverCopilotOutput(
            response=response,
            user_transcription=input.user_transcription,
            image_url=image_url,
            audio_url=audio_url
        )

    def _build_prompt(self, input: DriverCopilotInput) -> str:
        # Construir prompt idéntico al de Genkit JS
        # Copiar el prompt completo del archivo driver-copilot-flow.ts
        pass
```

**Opción B: Usar LangChain (alternativa más flexible)**

```python
# app/ai/langchain_copilot.py
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.agents import AgentExecutor, create_tool_calling_agent
from langchain.tools import tool

llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash", api_key=os.getenv("GOOGLE_GENAI_API_KEY"))

@tool
def search_knowledge_base(query: str) -> str:
    """Busca en la base de conocimientos de la empresa."""
    # Implementar búsqueda
    pass

@tool
def optimize_route(stops: list, current_location: dict) -> str:
    """Optimiza la ruta de entrega."""
    # Implementar optimización
    pass

tools = [search_knowledge_base, optimize_route]
agent = create_tool_calling_agent(llm, tools)
agent_executor = AgentExecutor(agent=agent, tools=tools)

async def driver_copilot(input: DriverCopilotInput) -> DriverCopilotOutput:
    result = await agent_executor.ainvoke({"input": input.conversation_history[-1].content})
    return DriverCopilotOutput(response=result["output"])
```

#### Paso 6: Migración de Frontend (Actualizar llamadas API)

**Reemplazar hooks de Firebase con fetch/axios:**

```typescript
// Antes (Firebase):
const { data: userData } = useDoc(userDocRef)

// Después (FastAPI):
const { data: userData } = useQuery({
  queryKey: ['user'],
  queryFn: async () => {
    const token = localStorage.getItem('token')
    const response = await fetch('/api/users/me', {
      headers: { Authorization: `Bearer ${token}` }
    })
    return response.json()
  }
})
```

**Actualizar service de ubicación GPS:**

```typescript
// Antes:
setDocumentNonBlocking(dRef, {
  currentLatitude: coords.lat,
  currentLongitude: coords.lng,
  lastLocationUpdate: new Date().toISOString()
}, { merge: true })

// Después:
await fetch('/api/location/update', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    latitude: coords.lat,
    longitude: coords.lng
  })
})
```

**Actualizar llamada a Copilot:**

```typescript
// Antes:
const result = await driverCopilot({...})

// Después:
const result = await fetch('/api/ai/copilot', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    driver_id: user.uid,
    current_location: currentCoords,
    active_orders: driverActiveOrders,
    nearby_alerts: alerts,
    conversation_history: copilotConversation
  })
}).then(r => r.json())
```

#### Paso 7: Actualización de render.yaml

```yaml
services:
  - type: web
    name: repartofacil-backend
    env: python
    plan: free
    buildCommand: pip install -r requirements.txt
    startCommand: uvicorn app.main:app --host 0.0.0.0 --port $PORT
    envVars:
      - key: DATABASE_URL
        sync: false
      - key: JWT_SECRET_KEY
        sync: false
      - key: GOOGLE_GENAI_API_KEY
        sync: false
      - key: CORS_ORIGINS
        value: http://localhost:3000,https://repartofacil-web.onrender.com
```

### 4. Lista de Tareas Prioritarias

1. **Fase 1 - Setup (1-2 días)**
   - [ ] Crear estructura de proyecto FastAPI
   - [ ] Configurar requirements.txt
   - [ ] Configurar conexión PostgreSQL (Neon)
   - [ ] Configurar Alembic para migraciones

2. **Fase 2 - Base de Datos (2-3 días)**
   - [ ] Definir modelos SQLAlchemy (User, DriverProfile, Order, Alert)
   - [ ] Crear migraciones iniciales
   - [ ] Implementar pool de conexiones async
   - [ ] Script de migración de datos de Firestore a PostgreSQL (opcional)

3. **Fase 3 - Autenticación (1-2 días)**
   - [ ] Implementar JWT service
   - [ ] Crear endpoints /api/auth/login, /register, /refresh
   - [ ] Implementar middleware de autenticación
   - [ ] Migrar LoginScreen.tsx para usar JWT

4. **Fase 4 - Endpoints Core (3-4 días)**
   - [ ] /api/users/* (perfiles, conductores)
   - [ ] /api/orders/* (CRUD de pedidos)
   - [ ] /api/alerts/* (CRUD de alertas)
   - [ ] /api/location/* (actualización GPS en tiempo real)

5. **Fase 5 - IA Copilot (3-4 días)**
   - [ ] Configurar Google GenAI Python SDK
   - [ ] Migrar flow driverCopilot a Python
   - [ ] Implementar herramientas (knowledge base, route optimization, image generation)
   - [ ] Implementar TTS en Python
   - [ ] Crear endpoint /api/ai/copilot

6. **Fase 6 - Frontend Integration (2-3 días)**
   - [ ] Reemplazar todos los hooks de Firebase con fetch/axios
   - [ ] Actualizar manejo de errores
   - [ ] Actualizar AuthProvider para usar JWT
   - [ ] Probar integración completa

7. **Fase 7 - Testing & Deploy (2-3 días)**
   - [ ] Escribir tests pytest para endpoints
   - [ ] Configurar CI/CD (GitHub Actions)
   - [ ] Desplegar backend en Render
   - [ ] Actualizar frontend CORS para apuntar a nuevo backend
   - [ ] Testing E2E

### 5. Consideraciones Especiales

1. **Migración de Datos de Firestore:**
   - Crear script Python que exporte datos de Firestore a PostgreSQL
   - Considerar usar `firebase-admin` SDK en Python para exportar

2. **WebSockets para Tiempo Real:**
   - Firestore tiene listeners en tiempo real
   - FastAPI necesita WebSockets para GPS en tiempo real
   - Implementar `/ws/location/{driver_id}` para streaming de ubicación

3. **Optimización de Rutas:**
   - El flow actual usa una herramienta personalizada
   - Migrar la lógica de cálculo de rutas a Python
   - Considerar usar Google Routes API o OSRM

4. **TTS (Text-to-Speech):**
   - Genkit JS usa `googleai/gemini-2.5-flash-preview-tts`
   - Python puede usar `gTTS` o la API de Google Cloud TTS

5. **RAG (Base de Conocimientos):**
   - Implementar con LangChain + vector store (Chroma, Pinecone, o PostgreSQL pgvector)
   - Migrar documentos de la base de conocimientos actual

### 6. Archivos a Migrar Prioritarios

**Backend (crear de cero):**
- [ ] `app/main.py`
- [ ] `app/database.py`
- [ ] `app/models/*.py`
- [ ] `app/schemas/*.py`
- [ ] `app/api/*.py`
- [ ] `app/services/*.py`
- [ ] `app/ai/*.py`

**Frontend (modificar):**
- [ ] `src/firebase/index.ts` → Reemplazar con `src/api/client.ts` (axios)
- [ ] `src/firebase/provider.tsx` → Reemplazar con AuthContext para JWT
- [ ] `src/app/page.tsx` → Actualizar llamadas a API
- [ ] `src/components/auth/LoginScreen.tsx` → Usar JWT login
- [ ] Todos los hooks `useDoc`, `useCollection` → Reemplazar con React Query

### 7. Recursos Útiles

- **FastAPI Docs:** https://fastapi.tiangolo.com/
- **SQLAlchemy Async:** https://docs.sqlalchemy.org/en/20/orm/extensions/asyncio.html
- **Google GenAI Python:** https://ai.google.dev/gemini-api/docs
- **LangChain:** https://python.langchain.com/
- **PostgreSQL on Neon:** https://neon.tech/docs
- **JWT with FastAPI:** https://fastapi.tiangolo.com/tutorial/security/oauth2-jwt/

---

## Prompt para IA (para ejecutar la migración)

Copia y pega este prompt completo en la IA para que guíe la migración paso a paso:
