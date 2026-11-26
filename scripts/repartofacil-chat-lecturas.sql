-- Aplicar manualmente en la base compartida antes de desplegar la mensajería.
CREATE TABLE IF NOT EXISTS repartofacil_chat_lecturas (
  usuario_id text NOT NULL,
  mensaje_id text NOT NULL,
  PRIMARY KEY (usuario_id, mensaje_id)
);

CREATE INDEX IF NOT EXISTS repartofacil_chat_mensajes_order_created_id_idx
  ON repartofacil_chat_mensajes (order_id, created_at, id);
