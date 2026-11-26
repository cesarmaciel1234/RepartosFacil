# Telemetría y Orientación Fusionada (Sensor Fusion & Smoothing Engine)

Este documento detalla la arquitectura, fundamentos matemáticos y funcionamiento del motor de orientación y telemetría de **RepartoFácil** para repartidores en calle.

---

## 1. El Problema Técnico: ¿Brújula o GPS?

En aplicaciones de delivery y movilidad (estilo Uber, Waze, Google Maps, PedidosYa), la representación de la "flecha" del conductor presenta dos desafíos antagónicos:

1. **La Brújula pura (Magnetómetro / Cabeza del teléfono):**
   - **Ventaja:** Responde inmediatamente cuando el repartidor está detenido (0 km/h) y gira sobre sus propios pasos buscando un número de puerta.
   - **Desventaja severa en vehículos:** Los soportes magnéticos de teléfono, el motor de la moto/auto y las vibraciones mecánicas generan un ruido electromagnético severo que descalibra el sensor o hace que la flecha tiemble ("jitter") a 60 Hz.
2. **El Rumbo GPS puro (Bearing de traslación):**
   - **Ventaja:** Cuando el vehículo avanza por la calle, el rumbo geodésico calculado entre coordenadas GPS es 100% inmune a interferencias magnéticas o imanes del soporte.
   - **Desventaja severa en parado:** Si la moto se detiene en un semáforo (velocidad < 3 km/h), el GPS no sabe hacia dónde apunta el teléfono, devolviendo `null` o fluctuando por "GPS drift".

---

## 2. La Solución: Arquitectura Híbrida Modular

El sistema está dividido en dos capas desacopladas:

```
src/modulos/repartidor/motor/
├── telemetryEngine.ts     <-- Funciones matemáticas puras (Haversine, Bearing, Promedio Circular, EMA)
├── useDriverGps.ts        <-- Hook reactivo con bucle de animación y fusión de sensores
└── tipos.ts               <-- Interfaces TelemetryState y HeadingSource
```

### Diagrama de Flujo del Motor:

```
[Hardware Móvil]
   ├── navigator.geolocation (GPS + Torres 4G + Redes Wi-Fi WPS)
   └── window.deviceorientation / deviceorientationabsolute (Magnetómetro)
            │
            ▼
┌────────────────────────────────────────────────────────┐
│               useDriverGps (Listener)                  │
├────────────────────────────────────────────────────────┤
│ ¿Velocidad > 1.1 m/s (~4 km/h)?                        │
│    ├── SÍ ──► Rumbo GPS (pos.coords.heading o Bearing) │
│    └── NO ──► Brújula Móvil (Ventana Buffer Circular)  │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│         Motor de Suavizado (Animation Frame Loop)      │
│  - shortestAngularDifference (camino más corto)        │
│  - smoothAngle con EMA a 60fps                         │
└───────────────────────────┬────────────────────────────┘
                            │
            ┌───────────────┴───────────────┐
            ▼                               ▼
[InteractiveMap (Leaflet)]      [Firestore driverProfiles]
- Vista Libre: Flecha gira       - Posición en tiempo real
- Modo Ruta: Mapa gira           - Monitoreo de flota
```

---

## 3. Fundamentos Matemáticos

### A. Promedio Circular Vectorial (`circularAverage`)
Promediar ángulos aritméticamente como `(θ1 + θ2) / 2` produce un error crítico cuando un ángulo está en 359° y el otro en 1°:
$$\frac{359^\circ + 1^\circ}{2} = 180^\circ \quad \text{(¡apuntaría al Sur cuando en realidad es el Norte!)}$$

Para resolverlo, `telemetryEngine.ts` descompone cada ángulo en vectores cartesianos unitarios:
$$\bar{x} = \frac{1}{N} \sum_{i=1}^N \cos(\theta_i), \quad \bar{y} = \frac{1}{N} \sum_{i=1}^N \sin(\theta_i)$$
$$\bar{\theta} = \text{atan2}(\bar{y}, \bar{x})$$

### B. Camino Angular Más Corto (`shortestAngularDifference`)
Al rotar desde el ángulo actual hacia el nuevo objetivo, calculamos el giro mínimo con signo en el rango $[-180^\circ, +180^\circ]$:
$$\Delta\theta = ((\theta_{\text{target}} - \theta_{\text{current}} + 540) \pmod{360}) - 180$$
Esto garantiza que si el teléfono pasa de 355° a 5°, solo gire +10° hacia la derecha en lugar de girar 350° al revés.

### C. Filtro Suavizador Exponencial (`smoothAngle` / EMA)
Para eliminar el temblor de la aguja y brindar un movimiento cinematográfico continuo:
$$\theta_{t+1} = \theta_t + \alpha \cdot \Delta\theta \quad (\text{donde } \alpha = 0.15)$$

---

## 4. Integración en la Interfaz de Usuario

1. **En `RepartidorPiramidal.tsx`:**  
   Se conecta directamente:
   ```tsx
   const { coords, heading, isMoving, source } = useDriverGps(driverProfile?.id);
   ...
   <InteractiveMap
     center={coords ? [coords.lat, coords.lng] : [-32.9372, -60.6542]}
     heading={heading}
     isNavigating={isNavigating}
     ...
   />
   ```
2. **En `InteractiveMap.tsx`:**
   - **Modo Navegación Guiada (`isNavigating = true`):** El mapa rota suavemente en `-heading` grados manteniendo la flecha central orientada hacia el frente (visión estilo Waze).
   - **Modo Vista Libre (`isNavigating = false`):** El mapa permanece orientado al Norte y el marcador propio del repartidor en el centro muestra la flecha azul rotando fluidamente hacia donde apunta su teléfono o rumbo.
