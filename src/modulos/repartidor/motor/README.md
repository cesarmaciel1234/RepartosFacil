# Subcarpeta: Motor Repartidor

**Ubicación:** `src/modulos/repartidor/motor/`  
**Rol:** Lógica de datos, sincronización y servicios para el perfil del repartidor: órdenes locales y de nube, telemetría y orientación fusionada, geocodificación y billetera virtual en tiempo real.

---

## 1. Qué hace
- Provee los contratos de datos en `tipos.ts` (DriverOrder, DriverProfile, OrderStatus, DriverWallet, WalletTransaction, TelemetryState, HeadingSource).
- Persiste pedidos locales en `driverService.ts` (`rf_orders_history`).
- `driverPendingActions.ts` guarda por repartidor y pedido las asignaciones y entregas pendientes, las reintenta al recuperar conexión y solo acredita la cartera después de la confirmación del servidor. Requiere Web Locks para evitar sincronizaciones simultáneas entre pestañas.
- Maneja la cartera del repartidor en `walletService.ts` (`rf_driver_wallet`), sumando ganancias netas acreditadas, registrando efectivo cobrado y emitiendo el evento reactivo `rf-wallet-updated`.
- Proporciona el hook `useDriverOrders.ts` para unificar órdenes locales y de Firestore, exponiendo `handleTakeOrder()`, `handleCompleteDelivery()` y `wallet`.
- **Motor de Telemetría y Orientación Fusionada (`telemetryEngine.ts` & `useDriverGps.ts`):** Fusión de sensores en tiempo real (GPS satelital de alta precisión + Brújula del móvil/magnetómetro) con conmutación dinámica por velocidad, promedio circular de buffer y filtro exponencial (EMA) para suavizado a 60fps sin temblores.

---

## 2. Componentes y Funciones Principales
- `tipos.ts`: Define las interfaces de órdenes con métricas Uber (`driverEarnings`, `distanceToStoreKm`, `distanceToDeliveryKm`, `destinationCoords`), perfiles, billetera (`DriverWallet`) y telemetría (`TelemetryState`, `HeadingSource`).
- `telemetryEngine.ts`: Motor matemático puro de orientación y geolocalización:
  - `calculateDistanceMeters(lat1, lon1, lat2, lon2)`: Distancia geodésica Haversine.
  - `calculateBearing(lat1, lon1, lat2, lon2)`: Rumbo geodésico inicial (Forward Azimuth).
  - `extractCompassHeading(event)`: Extrae el rumbo magnético/verdadero (soporte iOS `webkitCompassHeading` y Android `deviceorientationabsolute`).
  - `circularAverage(angles)`: Promedio vectorial trigonométrico sin error de discontinuidad 0°/360°.
  - `shortestAngularDifference(target, current)`: Camino angular más corto en `[-180, 180]`.
  - `smoothAngle(current, target, factor)`: Filtro EMA (Exponential Moving Average) para giro fluido.
- `useDriverGps.ts`: Hook reactivo que orquesta:
  1. `watchPosition` GPS con `enableHighAccuracy: true` (satélites + A-GPS celular/Wi-Fi).
  2. Listener de orientación del móvil (`deviceorientationabsolute` / `deviceorientation`).
  3. Bucle de animación en segundo plano (`requestAnimationFrame`) que suaviza el ángulo a 60fps.
  4. Sincronización continua de ubicación y rumbo en Firestore (`driverProfiles`).
- `driverService.ts`:
  - `loadLocalOrders()` / `saveLocalOrders()`: Persistencia en `localStorage`.
- `driverPendingActions.ts`: Encola y sincroniza acciones pendientes para el repartidor activo; los rechazos del servidor se muestran y no se acreditan.
- `walletService.ts`:
  - `loadDriverWallet()` / `saveDriverWallet()`: Persistencia reactiva de la cartera (`rf_driver_wallet`).
  - `creditDeliveryEarning(orderId, earningAmount, cashCollected)`: Acredita la ganancia y registra el efectivo recibido.
- `useDriverOrders.ts`: Hook reactivo que escucha eventos `rf-orders-updated` y `rf-wallet-updated`.

---

## 3. Cómo funciona la Orientación Fusionada (Flujo paso a paso)
1. **Detección de Movimiento:** Si la velocidad reportada por el GPS supera el umbral de movimiento (> 1.1 m/s o ~4 km/h), el sistema sabe que el vehículo está en marcha.
2. **Conmutación Inteligente:**
   - **En marcha (> 4 km/h):** Utiliza el **Rumbo GPS** (`pos.coords.heading` o cálculo entre coordenadas). Esto ignora imanes de soporte de celular y vibraciones del manillar.
   - **En parado o a pie (< 4 km/h):** Conmuta a la **Brújula digital** (`extractCompassHeading`). Al girar el repartidor sobre sus pies o rotar el teléfono, la flecha apunta hacia donde mira la cabeza del móvil.
3. **Buffer y Promedio Circular:** Las lecturas de la brújula pasan por una ventana deslizante con `circularAverage()` para disipar el ruido electromagnético.
4. **Interpolación EMA:** El bucle de animación interpola el ángulo actual hacia el objetivo sin giros de 360° no deseados (`shortestAngularDifference`), entregando una rotación cinematográfica en el mapa interactivo.

---

## 4. De dónde viene y A dónde va (Conexiones)
- **Viene de:** Sensores del hardware móvil (`navigator.geolocation`, `DeviceOrientationEvent`), acciones en `RepartidorPiramidal.tsx` y subcomponentes UI (`TabMiRuta`, `TabPedidosDisponibles`).
- **Va a:** `<InteractiveMap heading={heading} />`, `localStorage` (`rf_orders_history`, `rf_driver_wallet`) y Firestore (`orders`, `driverProfiles`).

---

## 5. Qué NO romper (Invariantes Sagrados)
- **Confirmación:** No mostrar una asignación o acreditar una entrega antes de la confirmación del servidor. El saldo sigue siendo local al dispositivo, no una liquidación central.
- **Eventos reactivos:** Emitir `rf-wallet-updated` y `rf-orders-updated` para actualización instantánea sin recarga.
- **Normalización angular:** Jamás promediar ángulos aritméticamente como `(a + b)/2` (genera desastres en 359° y 1°); siempre usar `circularAverage` o `shortestAngularDifference`.
