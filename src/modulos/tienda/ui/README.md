# Interfaz de Tienda

**Ubicación:** `src/modulos/tienda/ui/`  
**Rol:** Componentes visuales compartidos para navegación, catálogo, carrito,
checkout y seguimiento de pedidos.

---

## 1. Qué hace
- Mantiene elementos reutilizables del catálogo y la navegación principal.
- Presenta el carrito y los formularios transitorios de dirección, autenticación y checkout.
- El botón superior abre conversaciones por pedido con contador de mensajes nuevos.
- La pantalla Pedidos muestra una sección de pedidos en curso, incluso cuando está vacía, y abre el detalle y seguimiento de los pedidos activos.
- Deja el historial completo en `pantallas/HistorialPedidosTienda.tsx`, como módulo
  de navegación independiente.
- El perfil del comprador muestra la versión instalada y si coincide con la publicada.

---

## 2. Componentes Principales
- `HeaderTienda.tsx`: Dirección, nombre del local, carrito y acceso a mensajes.
- `NavegacionTienda.tsx`: Barra inferior para Inicio, Súper, Promociones, Pedidos y Perfil.
- `VistaMercadosEmpresas.tsx`: Descubrimiento de comercios y tarjetas de productos en búsqueda.
- `FiltroCategorias.tsx` y `TarjetaProducto.tsx`: Filtros de catálogo y acciones de producto.
- `DrawerCarrito.tsx`, `ModalCheckout.tsx`: Revisión del carrito y confirmación de compra.
- `ModalCambiarDireccion.tsx`, `ModalClientAuth.tsx`: Flujos de dirección e identidad del comprador.
- `CentroPedidosClienteSheet.tsx`: Detalle y seguimiento de pedidos activos.
- `MensajesClienteSheet.tsx`: Lista y chat del comprador en una misma ventana;
  al volver conserva la lista, la paginación y su posición de desplazamiento.
- `ResenaPedidoDialog.tsx`: consulta y registra una reseña pública para un pedido
  entregado, validada por el servidor para la cuenta autenticada.

En la pantalla de perfil, el acceso de repartidor se muestra cuando no hay una
sesión de comprador activa; la tienda sigue disponible para navegar sin sesión.

---

## 3. Cómo funciona (Flujo visual)
1. `TiendaPiramidal` selecciona la pantalla y conecta sus callbacks.
2. El usuario agrega productos desde las tarjetas al hook `motor/useCart.ts`.
3. `DrawerCarrito` abre `ModalCheckout` al continuar con la compra.
4. `HistorialPedidosTienda` muestra pedidos activos y anteriores; el detalle activo
   usa `CentroPedidosClienteSheet`. Los mensajes se abren desde el botón superior.

---

## 4. De dónde viene y A dónde va (Conexiones)
- **Viene de:** `TiendaPiramidal.tsx` o una pantalla de `pantallas/`.
- **Va a:** Hooks/servicios del dominio mediante props y callbacks tipados.

---

## 5. Qué NO romper (Invariantes Sagrados)
- **Cero bloqueo:** No exigir login para explorar o agregar al carrito.
- **Responsividad móvil:** No generar scroll horizontal en pantallas de 390px.
- **Separación de pantallas:** El historial no se vuelve a incrustar en el panel de pedidos activos.
- **Checkout:** Usa el nombre y teléfono registrados sin mostrarlos; pide solo los
  que faltan y los guarda en el perfil antes de confirmar. La dirección de envío
  sigue editable para cada pedido. Al iniciar sesión se recupera el perfil privado
  sin reemplazar sus datos de contacto por valores vacíos.
