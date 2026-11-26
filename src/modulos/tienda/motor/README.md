# Subcarpeta: Motor Tienda

**Ubicación:** `src/modulos/tienda/motor/`  
**Rol:** Lógica reutilizable del dominio de compra: carrito, tarifas, pedidos y tipos.

---

## 1. Qué hace
- Gestiona el carrito en memoria y `localStorage` con `useCart.ts`.
- Modela las tarifas dinámicas de delivery con `tarifaUberService.ts` (base fija, precio por km, horario pico y ganancias del repartidor).
- Procesa el checkout y genera órdenes con `pedidoService.ts`.
- Modela los tipos de datos en `tipos.ts`.
- Define `DeliveryCoordinates` para conservar juntos la dirección y el punto elegido.

---

## 2. Componentes y Funciones Principales
- `tarifaUberService.ts`:
  - `MARKET_CENTRAL`: Coordenadas centrales (`lat: -32.9372, lng: -60.6542`, `Tucumán 2130, Rosario`).
  - `haversineKm()`: Cálculo trigonométrico de distancia esférica.
  - `isPeakHourNow()`: Determina si rige horario pico (12:00-14:30 o 20:00-23:30).
  - `estimateAddressCoords()`: Resuelve coordenadas y distancia aproximada para direcciones de prueba.
  - `calcularTarifaEnvio()`: Tarifa base ($1.200) + distancia ($450/km) * multiplicador (1.35x pico o 1.0x normal). Retorna flete y ganancia garantizada del repartidor ($1.600+).
- `pedidoService.ts`:
  - `createOrder()`: Genera pedido `#RF-XXXX` con métricas Uber (`driverEarnings`, distancias, coordenadas), requiere guardarlo en `/api/orders` antes de persistirlo en `rf_orders_history` y emitir `rf-orders-updated`.
  - `buildWhatsAppLink()`: Arma mensaje formateado para enviar a la central de carnicería.
- `useCart.ts`: Hook reactivo para agregar, remover y modificar cantidades con persistencia en `rf_cart`.
- `tipos.ts`: Tipos de pedido, carrito, checkout y ubicación compartidos por los dominios.

---

## 3. Cómo funciona (Flujo paso a paso)
1. `useCart` gestiona el array de `CartItem` y calcula subtotales.
2. El carrito y el checkout calculan el flete con `calcularTarifaEnvio`, según el domicilio y la hora. Si el subtotal >= $35.000, el envío es gratis para el cliente.
3. Al confirmar, `createOrder` genera el pedido `#RF-XXXX` y lo guarda primero en `/api/orders`. Si el servidor falla, el checkout muestra un error y conserva el carrito; si se guarda, lo agrega a `rf_orders_history`, emite `rf-orders-updated` y lo envía a Firestore si está conectado.

---

## 4. De dónde viene y A dónde va (Conexiones)
- **Viene de:** `TiendaPiramidal.tsx` y `ModalCheckout.tsx`.
- **Va a:** `localStorage` (`rf_cart`, `rf_customer_data`, `rf_orders_history`), Firestore (`orders`), y el radar del repartidor.

---

## 5. Qué NO romper (Invariantes Sagrados)
- **Subsidio de envío gratis:** Si la compra es >= $35.000, el flete es $0 para el cliente pero el repartidor siempre cobra su ganancia estipulada.
- **Formato de moneda:** Precios en pesos argentinos (`es-AR`).
- **Dependencias:** `motor/` no importa pantallas ni componentes visuales.
