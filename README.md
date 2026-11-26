# Reparto Fácil Web

Aplicación Next.js para el marketplace multitienda de Reparto Fácil, el checkout
de clientes y la experiencia móvil de repartidores. Se integra con Cobro Fácil
para recibir pedidos e inventario; Reparto Fácil y Cobro Fácil comparten la
misma base de datos PostgreSQL.

## Arquitectura

- `src/app/`: páginas Next.js y API routes.
- `src/app/api/orders/`, `src/app/api/chat/` y `src/app/api/orders/custodio/`:
  rutas operativas que consultan PostgreSQL mediante `src/lib/db.ts`.
- `src/app/api/auth/`: proxy al servicio FastAPI configurado mediante
  `BACKEND_URL`.
- `src/app/api/cobrofacil/`: lectura del inventario desde PostgreSQL y proxy de
  respaldo para rutas no resueltas.
- `src/modulos/tienda/`: marketplace, catálogo, carrito, checkout, historial y
  seguimiento del cliente.
- `src/modulos/repartidor/`: radar, rutas, telemetría y billetera del repartidor.
- `src/firebase/`, `src/lib/` y `src/components/`: integraciones e infraestructura
  compartida.
- `backend/`: servicio FastAPI independiente; sus variables de entorno no se
  heredan del servicio Next.js.

La tienda y Cobro Fácil son servicios web separados aunque usen la misma base.
Cada servicio debe recibir su propia variable `DATABASE_URL` en Render. El
valor es secreto: no se incluye en el repositorio ni se expone con prefijo
`NEXT_PUBLIC_`.

## Flujos que deben preservarse

- Se puede explorar el catálogo y armar el carrito sin iniciar sesión; el acceso
  se solicita al pagar.
- La confirmación del checkout requiere una respuesta exitosa de `POST
  /api/orders`. Si el servidor falla, se conserva el carrito y no se muestra una
  compra confirmada.
- El carrito y el checkout deben mostrar la misma tarifa para la misma dirección
  y modalidad.
- Los pedidos conservan el aislamiento por cliente y comercio en la API.
- Los detalles de cada dominio y sus invariantes están en los README de
  `src/modulos/tienda/` y `src/modulos/repartidor/`.

## Desarrollo

```bash
npm run dev
npm run build
npm run typecheck
```

La compilación de producción no reemplaza `npm run typecheck`. El typecheck
puede señalar errores existentes en módulos ajenos a la tienda; revisar cada
resultado antes de atribuirlo a un cambio.

## Producción

Antes de publicar, seguir [`docs/PRODUCCION.md`](./docs/PRODUCCION.md). Incluye
los servicios de Render, variables requeridas, invariantes de persistencia y
pruebas de humo para evitar publicar una tienda que no pueda recibir pedidos.
