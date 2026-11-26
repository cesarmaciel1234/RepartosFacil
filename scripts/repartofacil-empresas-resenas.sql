-- Perfil público y reseñas verificadas; ejecutar en la base compartida antes del despliegue.
CREATE TABLE IF NOT EXISTS public.repartofacil_empresa_perfiles (
    empresa_id INTEGER PRIMARY KEY REFERENCES public.empresas(id),
    nombre TEXT NOT NULL DEFAULT '',
    descripcion TEXT NOT NULL DEFAULT '',
    direccion TEXT NOT NULL DEFAULT '',
    latitud DOUBLE PRECISION,
    longitud DOUBLE PRECISION,
    whatsapp TEXT NOT NULL DEFAULT '',
    horario TEXT NOT NULL DEFAULT '',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK ((latitud IS NULL AND longitud IS NULL) OR
           (latitud IS NOT NULL AND longitud IS NOT NULL AND
            latitud BETWEEN -90 AND 90 AND longitud BETWEEN -180 AND 180))
);

CREATE TABLE IF NOT EXISTS public.repartofacil_resenas (
    pedido_id TEXT PRIMARY KEY,
    empresa_id INTEGER NOT NULL REFERENCES public.empresas(id),
    cliente_usuario_id TEXT NOT NULL,
    estrellas INTEGER NOT NULL CHECK (estrellas BETWEEN 1 AND 5),
    comentario TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS repartofacil_resenas_empresa_fecha
    ON public.repartofacil_resenas (empresa_id, created_at DESC);
