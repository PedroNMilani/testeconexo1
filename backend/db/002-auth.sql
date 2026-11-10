-- Adições à base enviada; não apaga nem altera senhas/cadastros existentes.
ALTER TABLE aacd ADD COLUMN nome_titular VARCHAR(150) NULL;
CREATE TABLE IF NOT EXISTS codigo_solicitacao (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_aacd INT UNSIGNED NOT NULL,
  material VARCHAR(30) NOT NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(id),
  CONSTRAINT fk_codigo_aacd FOREIGN KEY(id_aacd) REFERENCES aacd(id)
) ENGINE=InnoDB;
