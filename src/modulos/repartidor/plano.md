# Plano de Rama: Perfil Repartidor (Logística y Reparto)

**Ubicación de la rama:** `src/modulos/repartidor/`  
**Propósito:** Proporciona la interfaz operativa para el repartidor: mapa Leaflet, métricas estimadas, aceptación y entrega de pedidos, mensajería y cartera local.

---

## 1. De dónde viene (Entradas / Triggers)
- **Disparador:** Botón "Modo Repartidor" desde el encabezado de la tienda o alternancia en `src/app/page.tsx`.
- **Ruta de entrada:** `src/app/page.tsx -> <RepartidorPiramidal onSwitchToStore={...} />`.
- **Parámetros recibidos:** `onSwitchToStore: () => void`.

---

## 2. Frente (Interfaz Visual)
- **Qué ve el usuario:**
  - Barra superior fija con estado GPS en vivo, botón de Cartera (`💼 $X.XXX`), botón de regreso inmediato a la Tienda, acceso al Copiloto IA ("Copo") y menú de conductor.
  - Mapa interactivo de pantalla completa (Leaflet) con radar de pedidos y posición del móvil en tiempo real.
  - Botones flotantes para centrado rápido del mapa y modo navegación.
  - Panel táctil inferior deslizable con 4 pestañas:
    - **"Disponibles":** Tarjetas estilo Uber con ganancia neta destacada (`+$X.XXX`), badge de tarifa dinámica pico (`⚡ 1.35x`), desglose dual (distancia al market + distancia al domicilio), aviso de cobro en efectivo en mano (`💵 Cobrar en efectivo al cliente`) y botón "Aceptar Pedido".
    - **"Mi Ruta":** Entregas asignadas con accesos a GPS, llamada y chat. La confirmación actual no implementa una geocerca.
    - **"Alertas":** Estado del tráfico y avisos de entrega.
    - **"Mensajes":** Bandeja de conversaciones de pedidos y contacto Copo. Los accesos superiores y el botón Chat de cada pedido abren esta misma bandeja o conversación; el panel ocupa el 60 % de la altura para conservar visible el mapa.
  - Diálogo modal de identificación rápida (`ModalDriverAuth`) que solicita nombre y vehículo (Moto, Bici, Auto).
  - Modal de Cartera de Repartidor (`ModalCarteraRepartidor`) con ganancias netas, efectivo cobrado en mano y movimientos recientes.
  - Conversación `DriverCopilotSheet` integrada en la bandeja. Actualmente es un asistente de prueba con respuestas locales, sin análisis real de rutas ni tráfico.

---

## 3. Fondo (Lógica y Motores)
- **Controlador principal:** `RepartidorPiramidal.tsx` orquesta la interacción entre el mapa y el panel táctil.
- **Motores auxiliares:**
  - `motor/useDriverOrders.ts`: Unifica los pedidos de Firestore y `localStorage`, expone `handleTakeOrder()`, `handleCompleteDelivery()` y `wallet`, y reacciona al evento `rf-orders-updated` y `rf-wallet-updated`.
  - `motor/driverService.ts`: Persiste pedidos y perfiles locales.
  - `motor/driverPendingActions.ts`: Encola asignaciones y entregas hasta la confirmación del servidor; evita acreditar dos veces una entrega en el mismo dispositivo.
  - `motor/useDriverChatSummaries.ts`: Consulta y ordena conversaciones autorizadas del repartidor; no usa el historial local compartido.
  - `motor/walletService.ts`: Administra `rf_driver_wallet`, acreditando las ganancias y registrando efectivo en mano.
  - `motor/useDriverGps.ts`: Monitorea la posición del GPS con `navigator.geolocation.watchPosition` de alta precisión.
- **Flujo de ejecución:**
  1. Paso 1: El conductor ingresa y visualiza pedidos con ganancias y distancias sin restricciones.
  2. Paso 2: Al tocar "Aceptar Pedido" (con identificación justa a tiempo), la orden pasa a "Mi Ruta".
  3. Si no hay conexión, la acción queda pendiente y se reintenta al reconectar con la aplicación abierta.
  4. Solo una respuesta exitosa del servidor confirma la asignación o acredita la entrega en la cartera local.

---

## 4. A dónde va (Salidas e Impacto)
- **Destino inmediato:** Trazado de ruta en el mapa, pestaña "Mi Ruta" y Cartera de Repartidor.
- **Persistencia:** `localStorage` (`rf_orders_history`, `repartofacil_user`, `rf_driver_wallet`) y Firestore (`orders`, `driverProfiles`).

---

## 5. Qué NO romper (Invariantes Sagrados)
1. **Acceso Abierto Inicial:** Nunca bloquear la pantalla del repartidor con un login previo.
2. **Confirmación del servidor:** No considerar asignado o entregado un pedido pendiente.
3. **Cartera local:** Acreditar cada entrega confirmada como máximo una vez en el dispositivo.
4. **Límite de líneas:** Ningún archivo debe exceder las 500 líneas de código.
5. **Chat por asignación:** No mostrar al repartidor mensajes locales antiguos sin comprobar su acceso en el servidor; cerrar el chat al cambiar de sesión o finalizar la entrega.
