from app.database import engine, Base, SessionLocal
from app.models.user import User, DriverProfile
from app.models.product import Product, Category
from app.models.order import Order, OrderItem
from app.services.auth_service import get_password_hash

def init_db():
    Base.metadata.create_all(bind=engine)

    session = SessionLocal()

    # Crear categoría de ejemplo
    category = Category(name="Bebidas", description="Bebidas variadas")
    session.add(category)
    session.commit()
    session.refresh(category)

    # Crear productos de ejemplo
    products = [
        Product(
            name="Coca Cola 500ml",
            description="Bebida gaseosa cola",
            price=1500,
            category_id=category.id,
            stock=100
        ),
        Product(
            name="Agua Mineral 1L",
            description="Agua mineral sin gas",
            price=800,
            category_id=category.id,
            stock=150
        ),
        Product(
            name="Jugo de Naranja 1L",
            description="Jugo natural de naranja",
            price=1200,
            category_id=category.id,
            stock=80
        ),
    ]
    for product in products:
        session.add(product)
    session.commit()

    # Crear usuario admin de ejemplo
    admin_user = User(
        email="admin@repartofacil.com",
        password_hash=get_password_hash("admin123"),
        first_name="Admin",
        last_name="System",
        role="admin"
    )
    session.add(admin_user)
    session.commit()

    session.close()

    print("✅ Base de datos inicializada con datos de ejemplo")
    print("📧 Email admin: admin@repartofacil.com")
    print("🔑 Password admin: admin123")

if __name__ == "__main__":
    init_db()
