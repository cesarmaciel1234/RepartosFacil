# Dominio de pedidos del cliente

**Ubicación:** `src/modulos/tienda/pedidos/`

Este dominio sincroniza los pedidos del comprador y los mensajes no leídos.

## Estructura

- `hooks/usePedidosCliente.ts`: combina el historial local filtrado por cliente
  con la API y escucha eventos de actualización.
- `hooks/useMensajesNoLeidos.ts`: consulta el contador autenticado y avisa si
  no se puede actualizar.
- `cachePedidosCliente.ts`: conserva la última respuesta válida por identificador
  de comprador para consultarla sin conexión.
- `../pantallas/HistorialPedidosTienda.tsx`: pedidos activos e historial.
- `../ui/CentroPedidosClienteSheet.tsx`: detalle de pedidos activos.
- `../ui/MensajesClienteSheet.tsx`: conversaciones por pedido, con paginación.

## Separación de responsabilidades

El hook no presenta UI; la pantalla de historial y el panel en vivo reciben los
pedidos y reportan acciones por callbacks. No se debe volver a agregar el
historial dentro del panel de seguimiento.

Las copias de pedidos permanecen en el almacenamiento del dispositivo y se
separan por comprador; en un dispositivo compartido no sustituyen la seguridad
de una sesión autenticada. Sin conexión se muestra la última información
disponible, no un seguimiento en vivo. La actualización se reanuda al reconectar
o volver a abrir la tienda; el navegador no garantiza ejecución con la app cerrada.
