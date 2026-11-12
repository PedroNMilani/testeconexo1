-- PROPOSTA HISTÓRICA, NÃO APLICAR NO BACKEND ATUAL. Base vigente: backend/db/001-base.sql + 002-auth.sql.
-- PROPOSTA PARA REVISÃO. Não executada. MySQL 8.0.16+ / 8.4, InnoDB.
-- Workbench é o cliente; é necessário um MySQL Server local ou remoto.
-- Nenhuma senha nem coordenada fictícia é inserida por este DDL.
-- IDs BIGINT são serializados como strings na API.
CREATE DATABASE IF NOT EXISTS conexo CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE conexo;
SET SESSION time_zone = '+00:00';

CREATE TABLE usuario (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  perfil ENUM('aacd','parceiro') NOT NULL,
  email VARCHAR(254) NOT NULL,
  telefone VARCHAR(20) NOT NULL,
  senha_hash CHAR(60) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  homologado BOOLEAN NOT NULL DEFAULT FALSE,
  criado_em DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  atualizado_em DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_usuario_email (email)
) ENGINE=InnoDB;

-- SUGESTÃO adicional: origens conhecidas para o cálculo de distância.
-- Popular somente após escolher unidade solicitante x AACD Central e confirmar coordenadas.
CREATE TABLE unidade_aacd (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  nome VARCHAR(100) NOT NULL,
  latitude DECIMAL(8,6) NOT NULL,
  longitude DECIMAL(9,6) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_unidade_nome (nome),
  CONSTRAINT ck_unidade_lat CHECK (latitude BETWEEN -90 AND 90),
  CONSTRAINT ck_unidade_lon CHECK (longitude BETWEEN -180 AND 180)
) ENGINE=InnoDB;

CREATE TABLE aacd (
  usuario_id BIGINT UNSIGNED NOT NULL,
  -- SUGESTÃO: preserva o nome do titular que já é exigido no front.
  nome_titular VARCHAR(160) NOT NULL,
  unidade_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (usuario_id),
  CONSTRAINT fk_aacd_usuario FOREIGN KEY (usuario_id) REFERENCES usuario(id),
  CONSTRAINT fk_aacd_unidade FOREIGN KEY (unidade_id) REFERENCES unidade_aacd(id)
) ENGINE=InnoDB;

CREATE TABLE parceiro (
  usuario_id BIGINT UNSIGNED NOT NULL,
  nome VARCHAR(160) NOT NULL,
  responsavel VARCHAR(160) NOT NULL,
  rua VARCHAR(200) NOT NULL,
  numero VARCHAR(20) NULL,
  cidade VARCHAR(100) NOT NULL,
  uf CHAR(2) NOT NULL,
  latitude DECIMAL(8,6) NOT NULL,
  longitude DECIMAL(9,6) NOT NULL,
  PRIMARY KEY (usuario_id),
  CONSTRAINT fk_parceiro_usuario FOREIGN KEY (usuario_id) REFERENCES usuario(id),
  CONSTRAINT ck_parceiro_uf CHECK (uf IN ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO')),
  CONSTRAINT ck_parceiro_lat CHECK (latitude BETWEEN -90 AND 90),
  CONSTRAINT ck_parceiro_lon CHECK (longitude BETWEEN -180 AND 180)
) ENGINE=InnoDB;

CREATE TABLE solicitacao (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_aacd BIGINT UNSIGNED NOT NULL,
  -- SUGESTÃO: preserva os campos já presentes no front-end; confirmar antes de implementar.
  referencia VARCHAR(160) NOT NULL,
  observacoes TEXT NULL,
  prioridade ENUM('padrao','medio','urgente') NOT NULL DEFAULT 'padrao',
  capacidade_x DECIMAL(8,2) NOT NULL,
  capacidade_y DECIMAL(8,2) NOT NULL,
  capacidade_z DECIMAL(8,2) NOT NULL,
  link VARCHAR(2048) NOT NULL,
  criada_em DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY ix_solicitacao_aacd_data (id_aacd, criada_em),
  CONSTRAINT fk_solicitacao_aacd FOREIGN KEY (id_aacd) REFERENCES aacd(usuario_id),
  CONSTRAINT ck_solicitacao_volume CHECK (capacidade_x > 0 AND capacidade_y > 0 AND capacidade_z > 0)
) ENGINE=InnoDB;

CREATE TABLE solicitacao_material (
  id_solicitacao BIGINT UNSIGNED NOT NULL,
  material VARCHAR(32) NOT NULL,
  PRIMARY KEY (id_solicitacao, material),
  CONSTRAINT fk_solicitacao_material FOREIGN KEY (id_solicitacao) REFERENCES solicitacao(id)
) ENGINE=InnoDB;

CREATE TABLE solicitacao_bico (
  id_solicitacao BIGINT UNSIGNED NOT NULL,
  bico_mm DECIMAL(4,2) NOT NULL,
  PRIMARY KEY (id_solicitacao, bico_mm),
  CONSTRAINT fk_solicitacao_bico FOREIGN KEY (id_solicitacao) REFERENCES solicitacao(id),
  CONSTRAINT ck_solicitacao_bico CHECK (bico_mm > 0)
) ENGINE=InnoDB;

CREATE TABLE pedido (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_solicitacao BIGINT UNSIGNED NOT NULL,
  id_parceiro BIGINT UNSIGNED NOT NULL,
  id_impressora CHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  material VARCHAR(32) NOT NULL,
  -- SUGESTÃO adicional: registra também o bico efetivamente escolhido.
  bico_mm DECIMAL(4,2) NOT NULL,
  distancia_km DECIMAL(8,3) NOT NULL,
  status ENUM('pendente','em_producao','recusado','cancelado','finalizado') NOT NULL DEFAULT 'pendente',
  criado_em DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  atualizado_em DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  -- NULL não conflita com outro NULL numa chave única do MySQL.
  solicitacao_ativa BIGINT UNSIGNED GENERATED ALWAYS AS (
    CASE WHEN status IN ('pendente','em_producao') THEN id_solicitacao ELSE NULL END
  ) STORED,
  PRIMARY KEY (id),
  UNIQUE KEY uq_um_pedido_ativo (solicitacao_ativa),
  KEY ix_pedido_solicitacao (id_solicitacao, criado_em),
  KEY ix_pedido_parceiro_status (id_parceiro, status),
  KEY ix_pedido_impressora_status (id_impressora, status),
  CONSTRAINT fk_pedido_solicitacao FOREIGN KEY (id_solicitacao) REFERENCES solicitacao(id),
  CONSTRAINT fk_pedido_parceiro FOREIGN KEY (id_parceiro) REFERENCES parceiro(usuario_id),
  CONSTRAINT fk_pedido_material_aceito FOREIGN KEY (id_solicitacao, material) REFERENCES solicitacao_material(id_solicitacao, material),
  CONSTRAINT fk_pedido_bico_aceito FOREIGN KEY (id_solicitacao, bico_mm) REFERENCES solicitacao_bico(id_solicitacao, bico_mm),
  CONSTRAINT ck_pedido_distancia CHECK (distancia_km >= 0),
  CONSTRAINT ck_pedido_objectid CHECK (REGEXP_LIKE(id_impressora, '^[0-9a-f]{24}$', 'c'))
) ENGINE=InnoDB;

-- Restrições que permanecem no serviço:
-- perfil correto ao criar a tabela filha; pelo menos um material e um bico;
-- URL permitida; coordenada dentro do polígono do Brasil; autorização e transições;
-- existência/atividade/propriedade da impressora no Mongo; política após finalização/cancelamento.
-- Não há FK entre MySQL e MongoDB, nem status gravado na Solicitação.
-- A tabela técnica de sessões será criada por migração conforme o store escolhido.
