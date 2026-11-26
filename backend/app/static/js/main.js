// Cargar productos desde la API
async function loadProducts() {
    try {
        const response = await fetch('/api/products');
        const products = await response.json();

        const productsGrid = document.querySelector('.products-grid');
        productsGrid.innerHTML = products.map(product => `
            <div class="product-card">
                <div class="product-image">
                    ${product.image_url ? `<img src="${product.image_url}" alt="${product.name}">` : '📦'}
                </div>
                <h3>${product.name}</h3>
                <p class="description">${product.description || ''}</p>
                <p class="price">$${product.price}</p>
                <button class="btn-add" onclick="addToCart('${product.id}')">Agregar al carrito</button>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading products:', error);
    }
}

// Carrito de compras
let cart = [];

function addToCart(productId) {
    const product = cart.find(p => p.id === productId);
    if (product) {
        product.quantity++;
    } else {
        cart.push({ id: productId, quantity: 1 });
    }
    updateCartUI();
    showNotification('Producto agregado al carrito');
}

function updateCartUI() {
    const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
    const cartButton = document.querySelector('.cart-count');
    if (cartButton) {
        cartButton.textContent = cartCount;
    }
}

function showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Cargar productos al iniciar
document.addEventListener('DOMContentLoaded', loadProducts);
