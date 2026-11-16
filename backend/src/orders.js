import { check } from './errors.js';
import { withTransaction } from './db.js';
import { validateId, requireApprovedUser } from './request-validation.js';
import { haversine, compatibleOptions } from './recommendations.js';

const ACTIVE = ['pendente', 'em_producao'];

// Encaminhamento, estados e histórico de cada tentativa de fabricação.
export function createOrderService({ pool, printers, config, requests }) {
  async function event(db, id, user, action) {
    await db.execute(
      'INSERT INTO pedido_evento(id_pedido,acao,perfil,id_autor) VALUES(?,?,?,?)',
      [id, action, user.perfil, user.id]
    );
  }
  async function connect(user, id, body) {
    requireApprovedUser(user);
    check(user.perfil === 'aacd', 'Acesso reservado à AACD.', 403);
    const partnerId = validateId(body.partnerId);
    return withTransaction(pool, async (db) => {
      const request = await requests.getRequest(user, id, db, true);
      check(!request.encerrada_em, 'Solicitação encerrada.', 409);
      const [[active]] = await db.execute(
        "SELECT COUNT(*) AS n FROM pedido WHERE id_solicitacao=? AND status IN ('pendente','em_producao')",
        [id]
      );
      check(!Number(active.n), 'Já existe um pedido ativo.', 409);
      const [partners] = await db.execute(
        'SELECT * FROM parceiro WHERE id=? AND homologado=TRUE FOR UPDATE',
        [partnerId]
      );
      const partner = partners[0];
      check(partner, 'Parceiro não disponível para receber pedidos.', 409);
      const printer = await printers.get({ id: partnerId }, body.printerId);
      const option = compatibleOptions(printer, request).find(
        (x) => x.material === body.material && x.nozzle === body.nozzle
      );
      check(
        option,
        'A impressora não atende mais aos requisitos selecionados. Atualize as recomendações.',
        409
      );
      check(
        request.origem_latitude !== null && request.origem_longitude !== null,
        'Localização da unidade indisponível.',
        409
      );
      const distance = haversine(
        {
          latitude: Number(request.origem_latitude),
          longitude: Number(request.origem_longitude)
        },
        {
          latitude: Number(partner.latitude),
          longitude: Number(partner.longitude)
        }
      );
      const snapshot = JSON.stringify({
        printerName: printer.modelo,
        lab: partner.nome_instituicao,
        needsMaterial: option.needsMaterial
      });
      const [result] = await db.execute(
        'INSERT INTO pedido(id_solicitacao,id_parceiro,id_impressora,material,bico_mm,distancia_km,snapshot) VALUES(?,?,?,?,?,?,?)',
        [
          id,
          partnerId,
          body.printerId,
          option.material,
          option.nozzle,
          Number(distance.toFixed(2)),
          snapshot
        ]
      );
      const orderId = String(result.insertId);
      await event(db, orderId, user, 'criado');
      return { id: orderId };
    });
  }
  function scope(user) {
    requireApprovedUser(user);
    return user.perfil === 'aacd'
      ? ['s.unidade=?', user.unidade]
      : ['p.id_parceiro=?', user.id];
  }
  async function list(user, id = null) {
    const [clause, value] = scope(user);
    const [rows] = await pool.execute(
      `SELECT p.*, s.codigo, s.prioridade,
              s.capacidade_x, s.capacidade_y, s.capacidade_z,
              s.link, s.observacoes, s.unidade,
              s.criada_em AS solicitacao_criada_em,
              par.nome_instituicao AS lab
       FROM pedido p
       JOIN solicitacao s ON s.id = p.id_solicitacao
       JOIN parceiro par ON par.id = p.id_parceiro
       WHERE ${clause}${id ? ' AND p.id = ?' : ''}
       ORDER BY (s.prioridade = 'urgente') DESC,
                (CASE s.prioridade WHEN 'medio' THEN ? ELSE ? END
                 + TIMESTAMPDIFF(DAY, s.criada_em, UTC_TIMESTAMP())) DESC,
                p.id`,
      [
        value,
        ...(id ? [validateId(id)] : []),
        config.queueMediumWeight ?? 7,
        config.queueStandardWeight ?? 0
      ]
    );
    if (id) check(rows.length, 'Pedido não encontrado.', 404);
    return rows.map((record) => ({
      ...record,
      id: String(record.id),
      id_solicitacao: String(record.id_solicitacao),
      id_parceiro: String(record.id_parceiro)
    }));
  }
  async function transition(user, id, action) {
    const found = (await list(user, id))[0];
    return withTransaction(pool, async (db) => {
      const [[request]] = await db.execute(
        'SELECT * FROM solicitacao WHERE id=? FOR UPDATE',
        [found.id_solicitacao]
      );
      const [[order]] = await db.execute(
        'SELECT * FROM pedido WHERE id=? FOR UPDATE',
        [id]
      );
      const rules = {
        aceitar: {
          role: 'parceiro',
          from: ['pendente'],
          to: 'em_producao',
          event: 'aceito'
        },
        recusar: {
          role: 'parceiro',
          from: ['pendente'],
          to: 'recusado',
          event: 'recusado'
        },
        finalizar: {
          role: 'parceiro',
          from: ['em_producao'],
          to: 'finalizado',
          event: 'finalizado'
        },
        cancelar: {
          role: 'aacd',
          from: ACTIVE,
          to: 'cancelado',
          event: 'cancelado'
        }
      };
      const rule = Object.hasOwn(rules, action) ? rules[action] : null;
      check(rule, 'Ação inválida.');
      check(
        user.perfil === rule.role,
        'Seu perfil não pode executar esta ação.',
        403
      );
      check(
        !request.encerrada_em && rule.from.includes(order.status),
        'O pedido mudou de situação. Atualize a página.',
        409
      );
      await db.execute('UPDATE pedido SET status=? WHERE id=?', [rule.to, id]);
      await event(db, id, user, rule.event);
      if (['cancelado', 'finalizado'].includes(rule.to))
        await db.execute(
          'UPDATE solicitacao SET encerrada_em=UTC_TIMESTAMP(),motivo_encerramento=? WHERE id=?',
          [rule.to, request.id]
        );
      return { id, status: rule.to };
    });
  }
  async function history(user, id) {
    await list(user, id);
    const [events] = await pool.execute(
      'SELECT id,acao,perfil,id_autor,criado_em FROM pedido_evento WHERE id_pedido=? ORDER BY id',
      [id]
    );
    return events;
  }
  async function createAndConnect(user, body) {
    const request = await requests.getOrCreateRequest(user, body.request || {});
    return connect(user, request.id, body.selection || {});
  }
  return { createAndConnect, connect, list, transition, history };
}
