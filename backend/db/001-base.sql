-- =====================================================================
-- CoNexo (TTI2006) - Banco relacional (MySQL 8.0+)
-- Versão de 10/11/2026: separação Solicitação (demanda da AACD) x Pedido (match)
-- Execução: MySQL Workbench (File > Open SQL Script, depois o ícone de raio para executar tudo)
-- =====================================================================
-- ATENÇÃO: o nome do schema ("conexo") é uma suposição. Troque se o seu for outro.
-- Para recomeçar do zero em desenvolvimento, descomente o bloco abaixo
-- (APAGA TODOS OS DADOS do schema):
--
-- DROP DATABASE IF EXISTS conexo;
-- =====================================================================

CREATE DATABASE IF NOT EXISTS conexo
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

USE conexo;

-- ---------------------------------------------------------------------
-- AACD (equipe da AACD)
-- Observação: "pedidos feitos" NÃO é coluna; é derivado (solicitacao/pedido).
-- ---------------------------------------------------------------------
CREATE TABLE aacd (
  id           INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  email        VARCHAR(254)  NOT NULL,
  senha_hash   VARCHAR(255)  NOT NULL,            -- bcrypt (nunca senha em texto puro)
  unidade      VARCHAR(100)  NOT NULL,
  telefone     VARCHAR(20)   NOT NULL,
  homologado   BOOLEAN       NOT NULL DEFAULT FALSE,
  criado_em    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_aacd_email (email)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- PARCEIRO (universidade / empresa / voluntário com impressora)
-- "pedidos já produzidos" NÃO é coluna; é derivado (pedido com status finalizado).
-- latitude/longitude: coordenada CONFIRMADA pelo usuário no mapa (Leaflet).
-- O CHECK usa uma caixa aproximada do Brasil; a validação principal é no backend.
-- ---------------------------------------------------------------------
CREATE TABLE parceiro (
  id                 INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  nome_instituicao   VARCHAR(150)  NOT NULL,
  responsavel        VARCHAR(100)  NOT NULL,
  email              VARCHAR(254)  NOT NULL,
  telefone           VARCHAR(20)   NOT NULL,
  senha_hash         VARCHAR(255)  NOT NULL,      -- bcrypt
  rua                VARCHAR(150)  NOT NULL,
  numero             VARCHAR(10)   NULL,          -- opcional; não entra na geocodificação
  cidade             VARCHAR(100)  NOT NULL,
  uf                 CHAR(2)       NOT NULL,
  latitude           DECIMAL(9,6)  NOT NULL,
  longitude          DECIMAL(9,6)  NOT NULL,
  homologado         BOOLEAN       NOT NULL DEFAULT FALSE,
  criado_em          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_parceiro_email (email),
  KEY ix_parceiro_homologado (homologado),
  CONSTRAINT ck_parceiro_lat CHECK (latitude  BETWEEN -34 AND 6),
  CONSTRAINT ck_parceiro_lon CHECK (longitude BETWEEN -74 AND -28)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- SOLICITAÇÃO (o que a AACD precisa; existe ANTES de haver parceiro)
-- Não tem coluna de status: o estado é derivado dos Pedidos.
-- Capacidade em milímetros (suposição: confirmar com o front).
-- ---------------------------------------------------------------------
CREATE TABLE solicitacao (
  id             INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  id_aacd        INT UNSIGNED  NOT NULL,
  prioridade     ENUM('padrao','medio','urgente') NOT NULL DEFAULT 'padrao',
  capacidade_x   INT UNSIGNED  NOT NULL,          -- mm
  capacidade_y   INT UNSIGNED  NOT NULL,          -- mm
  capacidade_z   INT UNSIGNED  NOT NULL,          -- mm
  link           VARCHAR(500)  NOT NULL,          -- Google Drive / OneDrive (validado no backend)
  criada_em      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_solicitacao_aacd (id_aacd),
  CONSTRAINT fk_solicitacao_aacd FOREIGN KEY (id_aacd) REFERENCES aacd (id),
  CONSTRAINT ck_solicitacao_cap CHECK (capacidade_x > 0 AND capacidade_y > 0 AND capacidade_z > 0)
) ENGINE=InnoDB;

-- Materiais ACEITÁVEIS da solicitação (filtro OU: a impressora precisa suportar algum).
-- Os nomes devem vir de uma lista controlada no backend (a mesma usada no Mongo),
-- senão "PLA", "pla" e "Pla" viram materiais diferentes.
CREATE TABLE solicitacao_material (
  id_solicitacao  INT UNSIGNED  NOT NULL,
  material        VARCHAR(30)   NOT NULL,
  PRIMARY KEY (id_solicitacao, material),
  CONSTRAINT fk_solmat_solicitacao FOREIGN KEY (id_solicitacao)
    REFERENCES solicitacao (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Bicos ACEITÁVEIS da solicitação, diâmetro em mm (ex.: 0.40, 0.60).
CREATE TABLE solicitacao_bico (
  id_solicitacao  INT UNSIGNED  NOT NULL,
  bico_mm         DECIMAL(3,2)  NOT NULL,
  PRIMARY KEY (id_solicitacao, bico_mm),
  CONSTRAINT fk_solbico_solicitacao FOREIGN KEY (id_solicitacao)
    REFERENCES solicitacao (id) ON DELETE CASCADE,
  CONSTRAINT ck_solbico_pos CHECK (bico_mm > 0)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- PEDIDO (o match de uma Solicitação com um Parceiro/Impressora)
-- id_impressora: _id (ObjectId, 24 caracteres hex) do documento no MongoDB.
--   Não há FK entre bancos: o backend valida existência/ativa/dono no momento da criação.
-- material e bico_mm: SOMENTE os escolhidos (decisão do match).
--   (bico_mm é uma adição pendente de confirmação: se não quiser registrar, remova a coluna.)
-- distancia_km: distância em linha reta (Haversine) calculada no backend NO MOMENTO do match.
-- ativo_solicitacao: coluna gerada que vale id_solicitacao enquanto o pedido está
--   pendente/em produção e NULL nos demais. O UNIQUE sobre ela garante, no próprio banco,
--   no máximo UM pedido ativo por solicitação (NULLs não colidem em UNIQUE).
-- ---------------------------------------------------------------------
CREATE TABLE pedido (
  id                 INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  id_solicitacao     INT UNSIGNED  NOT NULL,
  id_parceiro        INT UNSIGNED  NOT NULL,
  id_impressora      CHAR(24)      NOT NULL,
  material           VARCHAR(30)   NOT NULL,
  bico_mm            DECIMAL(3,2)  NOT NULL,
  distancia_km       DECIMAL(8,2)  NOT NULL,
  status             ENUM('pendente','recusado','cancelado','em_producao','finalizado')
                     NOT NULL DEFAULT 'pendente',
  criado_em          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
                     ON UPDATE CURRENT_TIMESTAMP,
  ativo_solicitacao  INT UNSIGNED  GENERATED ALWAYS AS (
                       CASE WHEN status IN ('pendente','em_producao') THEN id_solicitacao END
                     ) STORED,
  PRIMARY KEY (id),
  UNIQUE KEY uq_pedido_ativo_por_solicitacao (ativo_solicitacao),
  KEY ix_pedido_solicitacao (id_solicitacao),
  KEY ix_pedido_parceiro_status (id_parceiro, status),   -- fila do parceiro
  CONSTRAINT fk_pedido_solicitacao FOREIGN KEY (id_solicitacao) REFERENCES solicitacao (id),
  CONSTRAINT fk_pedido_parceiro    FOREIGN KEY (id_parceiro)    REFERENCES parceiro (id),
  CONSTRAINT ck_pedido_dist CHECK (distancia_km >= 0)
) ENGINE=InnoDB;

-- =====================================================================
-- Consulta de referência: fila do parceiro (pedidos pendentes)
-- Urgente sempre primeiro; demais por peso (médio = 7, padrão = 0) + dias de espera.
-- Os pesos são decisão da equipe: no backend, deixe-os em constantes configuráveis.
--
-- SELECT p.id, s.prioridade, s.criada_em, s.link,
--        (CASE s.prioridade WHEN 'medio' THEN 7 ELSE 0 END
--         + DATEDIFF(NOW(), s.criada_em)) AS pontuacao
-- FROM pedido p
-- JOIN solicitacao s ON s.id = p.id_solicitacao
-- WHERE p.id_parceiro = ? AND p.status = 'pendente'
-- ORDER BY (s.prioridade = 'urgente') DESC, pontuacao DESC;
-- =====================================================================
