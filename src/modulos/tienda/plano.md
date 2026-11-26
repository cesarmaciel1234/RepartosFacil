# Arquitectura piramidal de Tienda

## Propósito

`src/modulos/tienda/` implementa la experiencia de compra del cliente. La entrada es
`TiendaPiramidal.tsx`: compone pantallas y flujos, pero delega catálogo, pedidos y
presentación a sus módulos correspondientes.

## Árbol del módulo

```text
tienda/
├── TiendaPiramidal.tsx              # Composición y estado global de la tienda
├── catalogo/
│   ├── hooks/
│   │   └── useCatalogoTienda.ts     # Carga, filtros y distancia de comercios/productos
│   ├── pantallas/
│   │   └── CatalogoEmpresaTienda.tsx # Catálogo de un comercio seleccionado
│   └── README.md
├── motor/
│   ├── pedidoService.ts             # Creación y persistencia de pedidos
│   ├── tarifaUberService.ts         # Distancias y tarifas de entrega
│   ├── tipos.ts                     # Tipos compartidos del dominio
│   ├── useCart.ts                   # Estado persistente del carrito
│   └── README.md
├── pedidos/
│   ├── hooks/
│   │   └── usePedidosCliente.ts    # Sincronización de pedidos del comprador
│   └── README.md
├── pantallas/
│   ├── InicioTienda.tsx
│   ├── SupermercadosTienda.tsx
│   ├── PromocionesTienda.tsx
│   ├── HistorialPedidosTienda.tsx
│   ├── PerfilCliente.tsx
│   └── tipos.ts
└── ui/
    ├── CentroPedidosClienteSheet.tsx # Detalle de pedidos activos
    ├── MensajesClienteSheet.tsx # Conversaciones del comprador por pedido
    ├── DrawerCarrito.tsx
    ├── FiltroCategorias.tsx
    ├── HeaderTienda.tsx
    ├── ModalCambiarDireccion.tsx
    ├── ModalCheckout.tsx
    ├── ModalClientAuth.tsx
    ├── NavegacionTienda.tsx
    ├── TarjetaProducto.tsx
    ├── VistaMercadosEmpresas.tsx
    └── README.md
```

## Responsabilidades por nivel

### 1. Orquestación

`TiendaPiramidal.tsx` mantiene la selección de sección y comercio, conecta carrito,
checkout, ubicación, perfil, historial, seguimiento en vivo y chat. No contiene la
carga ni el filtrado del catálogo ni la sincronización periódica de pedidos.

### 2. Dominios

- **`catalogo/`** carga comercios y productos, obtiene la distancia aproximada y
  entrega los datos filtrados a `CatalogoEmpresaTienda`.
- **`pedidos/`** sincroniza el historial local/remoto e informa la cantidad de
  pedidos activos.
- **`motor/`** contiene operaciones reutilizables de carrito, pedidos, tarifas y
  tipos del dominio.
- **`pantallas/`** contiene módulos completos de navegación: Inicio, Súper,
  Promociones, Pedidos e Perfil.
- **`ui/`** contiene componentes visuales compartidos y paneles transitorios.

### 3. Componentes visuales

Las pantallas usan los componentes de `ui/`; el orquestador los conecta con los
hooks y servicios del dominio. El panel `CentroPedidosClienteSheet` es únicamente
para pedidos activos. El seguimiento y el historial viven en `pantallas/HistorialPedidosTienda.tsx`.

## Flujos principales

```text
src/app/page.tsx
  └── TiendaPiramidal
      ├── useCatalogoTienda ── API de comercios/productos
      │   └── Inicio / Súper / Promociones / Catálogo de comercio
      ├── useCart ── DrawerCarrito ── ModalCheckout ── createOrder
      ├── usePedidosCliente ── HistorialPedidosTienda
      │                     └── CentroPedidosClienteSheet ── OrderChatSheet
      └── ModalCambiarDireccion ── coordenadas guardadas para el comprador
```

El catálogo conserva una copia local de respuestas completas y la muestra como
información no vigente mientras obtiene datos dinámicos. No permite confirmar
compras sin validar precio y stock. Los pedidos del comprador también conservan
una copia por identidad y muestran un aviso cuando no están actualizados. La
selección de dirección persiste texto y coordenadas; ambas se comparten para
mostrar la distancia aproximada al comercio.

## Reglas para extender el módulo

1. Agregar una pantalla principal nueva en `pantallas/` y conectarla desde
   `TiendaPiramidal.tsx`.
2. Agregar lógica reutilizable en el dominio correspondiente (`catalogo/`,
   `pedidos/` o `motor/`), no en una pantalla.
3. Mantener los componentes visuales en `ui/` o junto al dominio si solo sirven a
   ese dominio.
4. No importar `TiendaPiramidal` desde un submódulo: las dependencias fluyen hacia
   abajo y el orquestador compone hacia arriba.
5. Mantener cada archivo de código por debajo de 500 líneas; extraer una pieza
   visual o una responsabilidad cohesiva cuando se acerque al límite.

## Invariantes

- Se puede recorrer el catálogo y armar un carrito sin iniciar sesión; el acceso
  se solicita al pagar.
- La moneda y las fechas visibles se formatean con configuración `es-AR`.
- El botón superior abre mensajes por pedido; Pedidos muestra los pedidos en
  curso y el historial. El contador numérico representa mensajes no leídos,
  no pedidos activos.
- La distancia se presenta como aproximada y usa coordenadas elegidas cuando
  existen.
- El carrito conserva su persistencia y el envío gratis no elimina la ganancia
  correspondiente del repartidor.
