-- Migração aditiva. O executor verifica cada coluna antes de aplicar o ALTER.
ALTER TABLE solicitacao ADD COLUMN codigo VARCHAR(100) NULL;
ALTER TABLE solicitacao ADD COLUMN unidade VARCHAR(100) NULL;
ALTER TABLE solicitacao ADD COLUMN observacoes TEXT NULL;
ALTER TABLE solicitacao ADD COLUMN origem_latitude DECIMAL(9,6) NULL;
ALTER TABLE solicitacao ADD COLUMN origem_longitude DECIMAL(9,6) NULL;
ALTER TABLE solicitacao ADD COLUMN encerrada_em DATETIME NULL;
ALTER TABLE solicitacao ADD COLUMN motivo_encerramento ENUM('cancelado','finalizado') NULL;
ALTER TABLE pedido ADD COLUMN snapshot JSON NULL;
CREATE TABLE IF NOT EXISTS pedido_evento (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  id_pedido INT UNSIGNED NOT NULL,
  acao ENUM('criado','aceito','recusado','cancelado','finalizado') NOT NULL,
  perfil ENUM('aacd','parceiro') NOT NULL,
  id_autor INT UNSIGNED NOT NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_evento_pedido FOREIGN KEY (id_pedido) REFERENCES pedido(id),
  KEY ix_evento_pedido (id_pedido,id)
) ENGINE=InnoDB;
UPDATE solicitacao s JOIN aacd a ON a.id=s.id_aacd SET s.unidade=a.unidade WHERE s.unidade IS NULL;
UPDATE solicitacao s JOIN pedido p ON p.id_solicitacao=s.id AND p.status IN ('cancelado','finalizado') SET s.encerrada_em=p.atualizado_em,s.motivo_encerramento=p.status WHERE s.encerrada_em IS NULL;
