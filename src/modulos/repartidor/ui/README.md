# Subcarpeta: UI Repartidor

**Ubicación:** `src/modulos/repartidor/ui/`  
**Rol:** Componentes visuales de la interfaz de repartidor/motomensajero: barra de navegación con cartera, listas de pedidos disponibles con indicadores de ganancia, gestión de ruta con velocímetro GPS y geocerca de 100m, diálogos de identificación y modal de cartera.

---

## 1. Qué hace
- Renderiza la barra superior de conductor con estado del GPS, saldo de la cartera en tiempo real y accesos rápidos.
- Muestra el listado de pedidos disponibles con métricas de conveniencia (ganancia neta, distancias, cobro en efectivo).
- Presenta las órdenes en ruta con velocímetro, simulación en marcha y botón de entrega con candado de geocerca (desbloqueo a <= 100m).
- Despliega el diálogo modal de identificación (`ModalDriverAuth`) y el modal de la cartera (`ModalCarteraRepartidor`).
- El menú lateral muestra la versión instalada y si coincide con la publicada.

---

## 2. Componentes Principales
- `DriverTopBar.tsx`: Accesos rápidos al perfil, Copo, mensajería y pedido activo.
- `CentroMensajeriaDriverSheet.tsx`: Bandeja integrada con conversaciones autorizadas y el contacto Copo. `motor/useDriverChatSummaries.ts` consulta y ordena los resúmenes; si falla, muestra un aviso.
- `OrderChatSheet.tsx`: Chat del pedido. El repartidor consulta los mensajes en línea sin leer ni guardar la caché compartida antigua; el comprador conserva su copia local por cuenta y pedido.
- `DriverCopilotSheet.tsx`: Conversación de prueba de Copo integrada en la bandeja; no analiza rutas ni tráfico real.
- `TabPedidosDisponibles.tsx`: Listado de pedidos listos con ganancia estimada para el bolsillo (`+$X.XXX`), badge de tarifa dinámica pico (`⚡ 1.35x`), trayecto al market y trayecto al cliente.
- `TabMiRuta.tsx`: Tarjetas de pedidos en curso con simulación GPS en marcha, velocímetro, barra de proximidad y botón bloqueado con candado hasta estar a menos de 100 metros del domicilio.
- `ModalCarteraRepartidor.tsx`: Diálogo con el desglose de ganancias del repartidor, efectivo cobrado en mano, liquidación neta a rendir a la central y movimientos recientes.
- `ModalDriverAuth.tsx`: Diálogo para que el repartidor ingrese su nombre y elija vehículo (Moto, Bici, Auto) únicamente al tomar un pedido.
- `DriverCopilotSheet.tsx`: Panel lateral con sugerencias de ruta y asistencia de despacho.

---

## 3. Cómo funciona (Flujo visual)
1. El usuario abre el modo repartidor y consulta las oportunidades en `TabPedidosDisponibles`.
2. Al pulsar "ACEPTAR PEDIDO", si no está registrado, se abre `ModalDriverAuth`.
3. Al confirmarse, se conmuta a la pestaña `TabMiRuta`.
4. El repartidor pulsa "Simular en Marcha" o "Llegar (60m)". La distancia baja en tiempo real y el botón cambia de gris con candado a verde esmeralda con `animate-pulse`.
5. Al pulsar "CONFIRMAR ENTREGA", se notifica el éxito y el saldo de la cartera en el botón superior aumenta inmediatamente.
6. Al pulsar el botón de cartera en la barra superior, se abre `ModalCarteraRepartidor`.

---

## 4. De dónde viene y A dónde va (Conexiones)
- **Viene de:** `RepartidorPiramidal.tsx` y hooks `useDriverOrders`, `useDriverGps`.
- **Va a:** Llamadas a acciones de asignación, entrega y modal de cartera.

---

## 5. Qué NO romper (Invariantes Sagrados)
- **Geocerca de 100m:** El botón de entrega no puede habilitarse si la distancia supera los 100 metros.
- **Responsividad:** Todos los componentes deben verse limpios y sin solapamientos en dispositivos de 390px.
