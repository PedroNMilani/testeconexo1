import { check } from './errors.js';
import { MATERIALS, needsMaterialSupply } from '../../material-catalog.js';
import { insideBrazil } from './geo.js';
const ACTIVE = ['pendente', 'em_producao'];
export function haversine(a, b) {
  const rad = (v) => (v * Math.PI) / 180;
  const dlat = rad(b.latitude - a.latitude),
    dlon = rad(b.longitude - a.longitude);
  const h =
    Math.sin(dlat / 2) ** 2 +
    Math.cos(rad(a.latitude)) *
      Math.cos(rad(b.latitude)) *
      Math.sin(dlon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}
export function requestPayload(body) {
  check(
    typeof body.code === 'string' &&
      body.code.trim() &&
      body.code.trim().length <= 100,
    'Informe um código de até 100 caracteres.'
  );
  check(
    ['Padrão', 'Médio', 'Urgente'].includes(body.priority),
    'Prioridade inválida.'
  );
  check(
    body.volumes &&
      ['X', 'Y', 'Z'].every(
        (axis) =>
          Number.isInteger(body.volumes[axis]) &&
          body.volumes[axis] > 0 &&
          body.volumes[axis] <= 10000
      ),
    'Informe dimensões inteiras de 1 a 10000 mm em X/Y/Z.'
  );
  check(
    Array.isArray(body.materials) &&
      body.materials.length &&
      body.materials.every((x) => MATERIALS.includes(x)),
    'Selecione materiais válidos.'
  );
  check(
    Array.isArray(body.nozzles) &&
      body.nozzles.length &&
      body.nozzles.every(
        (x) =>
          typeof x === 'number' &&
          Number.isFinite(x) &&
          x > 0 &&
          x <= 9.99 &&
          Math.abs(x * 100 - Math.round(x * 100)) < 1e-8
      ),
    'Selecione bicos válidos, com até duas casas decimais.'
  );
  let url;
  try {
    url = new URL(body.url);
  } catch {
    /* validação abaixo */
  }
  check(
    typeof body.url === 'string' &&
      body.url.length <= 500 &&
      url &&
      ['http:', 'https:'].includes(url.protocol) &&
      !url.username &&
      !url.password,
    'Informe um link HTTP ou HTTPS válido, sem credenciais.'
  );
  check(
    body.notes === undefined ||
      (typeof body.notes === 'string' && body.notes.length <= 4000),
    'Observações devem ter até 4000 caracteres.'
  );
  return {
    code: body.code.trim(),
    priority: { Padrão: 'padrao', Médio: 'medio', Urgente: 'urgente' }[
      body.priority
    ],
    volumes: body.volumes,
    materials: [...new Set(body.materials)],
    nozzles: [...new Set(body.nozzles)],
    url: body.url,
    notes: body.notes || ''
  };
}
function identity(id) {
  check(
    typeof id === 'string' && /^[1-9][0-9]*$/.test(id),
    'Registro não encontrado.',
    404
  );
  return id;
}
function authorized(user) {
  check(
    user && user.homologado && ['aacd', 'parceiro'].includes(user.perfil),
    'Aguarde a homologação da sua conta.',
    403
  );
}
export function createOrderService({ pool, printers, config }) {
  async function transaction(action) {
    const db = await pool.getConnection();
    try {
      await db.beginTransaction();
      const result = await action(db);
      await db.commit();
      return result;
    } catch (error) {
      await db.rollback();
      throw error;
    } finally {
      db.release();
    }
  }
  async function request(user, id, db = pool, lock = false) {
    authorized(user);
    check(user.perfil === 'aacd', 'Acesso reservado à AACD.', 403);
    const [rows] = await db.execute(
      `SELECT * FROM solicitacao WHERE id=? AND unidade=?${lock ? ' FOR UPDATE' : ''}`,
      [identity(id), user.unidade]
    );
    check(rows[0], 'Solicitação não encontrada.', 404);
    const record = rows[0];
    const [materials] = await db.execute(
      'SELECT material FROM solicitacao_material WHERE id_solicitacao=? ORDER BY material',
      [id]
    );
    const [nozzles] = await db.execute(
      'SELECT bico_mm FROM solicitacao_bico WHERE id_solicitacao=? ORDER BY bico_mm',
      [id]
    );
    return {
      ...record,
      id: String(record.id),
      materials: materials.map((x) => x.material),
      nozzles: nozzles.map((x) => Number(x.bico_mm))
    };
  }
  async function listRequests(user) {
    authorized(user);
    check(user.perfil === 'aacd', 'Acesso reservado à AACD.', 403);
    const [rows] = await pool.execute(
      'SELECT s.*, (SELECT p.status FROM pedido p WHERE p.id_solicitacao=s.id ORDER BY p.id DESC LIMIT 1) AS ultimo_status FROM solicitacao s WHERE s.unidade=? ORDER BY s.id DESC',
      [user.unidade]
    );
    return rows.map((r) => ({ ...r, id: String(r.id) }));
  }
  async function createRequest(user, body) {
    authorized(user);
    check(user.perfil === 'aacd', 'Acesso reservado à AACD.', 403);
    const values = requestPayload(body),
      origin = config.unitLocations?.[user.unidade];
    check(
      origin && insideBrazil(origin.latitude, origin.longitude),
      'A equipe precisa configurar a localização confirmada desta unidade AACD antes de criar pedidos.',
      409,
      'UNIT_LOCATION_REQUIRED'
    );
    return transaction(async (db) => {
      const [result] = await db.execute(
        'INSERT INTO solicitacao(id_aacd,unidade,codigo,prioridade,capacidade_x,capacidade_y,capacidade_z,link,observacoes,origem_latitude,origem_longitude) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
        [
          user.id,
          user.unidade,
          values.code,
          values.priority,
          values.volumes.X,
          values.volumes.Y,
          values.volumes.Z,
          values.url,
          values.notes,
          origin.latitude,
          origin.longitude
        ]
      );
      const id = String(result.insertId);
      for (const material of values.materials)
        await db.execute(
          'INSERT INTO solicitacao_material(id_solicitacao,material) VALUES(?,?)',
          [id, material]
        );
      for (const nozzle of values.nozzles)
        await db.execute(
          'INSERT INTO solicitacao_bico(id_solicitacao,bico_mm) VALUES(?,?)',
          [id, nozzle]
        );
      return request(user, id, db);
    });
  }
  function choices(printer, s) {
    if (
      !printer.ativa ||
      !['x', 'y', 'z'].every(
        (axis) =>
          Number(printer.capacidade[axis]) >= Number(s['capacidade_' + axis])
      )
    )
      return [];
    return s.materials
      .filter((m) => printer.materiais_compativeis.includes(m))
      .flatMap((material) =>
        s.nozzles
          .filter((n) => printer.bicos.map(Number).includes(n))
          .map((nozzle) => ({
            material,
            nozzle,
            needsMaterial: needsMaterialSupply(
              printer.materiais_compativeis,
              printer.materiais_disponiveis,
              material
            )
          }))
      );
  }
  async function matches(user, id) {
    const s = await request(user, id);
    return recommend(s);
  }
  async function preview(user, body) {
    authorized(user);
    check(user.perfil === 'aacd', 'Acesso reservado à AACD.', 403);
    const values = requestPayload(body),
      origin = config.unitLocations?.[user.unidade];
    check(
      origin && insideBrazil(origin.latitude, origin.longitude),
      'Configure a localização confirmada da unidade AACD para calcular as distâncias.',
      409,
      'UNIT_LOCATION_REQUIRED'
    );
    return recommend({
      materials: values.materials,
      nozzles: values.nozzles,
      capacidade_x: values.volumes.X,
      capacidade_y: values.volumes.Y,
      capacidade_z: values.volumes.Z,
      origem_latitude: origin.latitude,
      origem_longitude: origin.longitude
    });
  }
  async function recommend(s) {
    check(!s.encerrada_em, 'Esta solicitação já foi encerrada.', 409);
    const [[active]] = await pool.execute(
      "SELECT COUNT(*) AS n FROM pedido WHERE id_solicitacao=? AND status IN ('pendente','em_producao')",
      [s.id || 0]
    );
    check(
      !Number(active.n),
      'Já existe um pedido ativo para esta solicitação.',
      409
    );
    const [partners] = await pool.execute(
      'SELECT id,nome_instituicao,cidade,uf,latitude,longitude FROM parceiro WHERE homologado=TRUE ORDER BY id'
    );
    check(
      s.origem_latitude !== null && s.origem_longitude !== null,
      'Configure a origem da unidade para esta solicitação.',
      409,
      'UNIT_LOCATION_REQUIRED'
    );
    const eligible = await printers.compatible(s);
    const byId = new Map(partners.map((p) => [String(p.id), p]));
    const items = [];
    for (const printer of eligible) {
      const partner = byId.get(String(printer.id_parceiro));
      if (!partner) continue;
      const distance = haversine(
        {
          latitude: Number(s.origem_latitude),
          longitude: Number(s.origem_longitude)
        },
        {
          latitude: Number(partner.latitude),
          longitude: Number(partner.longitude)
        }
      );
      for (const option of choices(printer, s))
        items.push({
          partnerId: String(partner.id),
          printerId: printer._id,
          name: partner.nome_instituicao,
          location: partner.cidade + ' / ' + partner.uf,
          printerName: printer.modelo,
          distanceKm: Number(distance.toFixed(2)),
          ...option
        });
    }
    return items.sort(
      (a, b) =>
        a.distanceKm - b.distanceKm ||
        a.partnerId.localeCompare(b.partnerId) ||
        a.printerId.localeCompare(b.printerId) ||
        a.material.localeCompare(b.material) ||
        a.nozzle - b.nozzle
    );
  }
  async function event(db, id, user, action) {
    await db.execute(
      'INSERT INTO pedido_evento(id_pedido,acao,perfil,id_autor) VALUES(?,?,?,?)',
      [id, action, user.perfil, user.id]
    );
  }
  async function connect(user, id, body) {
    authorized(user);
    check(user.perfil === 'aacd', 'Acesso reservado à AACD.', 403);
    const partnerId = identity(body.partnerId);
    return transaction(async (db) => {
      const s = await request(user, id, db, true);
      check(!s.encerrada_em, 'Solicitação encerrada.', 409);
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
      const option = choices(printer, s).find(
        (x) => x.material === body.material && x.nozzle === body.nozzle
      );
      check(
        option,
        'A impressora não atende mais aos requisitos selecionados. Atualize as recomendações.',
        409
      );
      check(
        s.origem_latitude !== null && s.origem_longitude !== null,
        'Localização da unidade indisponível.',
        409
      );
      const distance = haversine(
        {
          latitude: Number(s.origem_latitude),
          longitude: Number(s.origem_longitude)
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
    authorized(user);
    return user.perfil === 'aacd'
      ? ['s.unidade=?', user.unidade]
      : ['p.id_parceiro=?', user.id];
  }
  async function list(user, id = null) {
    const [clause, value] = scope(user);
    const [rows] = await pool.execute(
      `SELECT p.*,s.codigo,s.prioridade,s.capacidade_x,s.capacidade_y,s.capacidade_z,s.link,s.observacoes,s.unidade,s.criada_em AS solicitacao_criada_em,par.nome_instituicao AS lab FROM pedido p JOIN solicitacao s ON s.id=p.id_solicitacao JOIN parceiro par ON par.id=p.id_parceiro WHERE ${clause}${id ? ' AND p.id=?' : ''} ORDER BY (s.prioridade='urgente') DESC, (CASE s.prioridade WHEN 'medio' THEN ? ELSE ? END + TIMESTAMPDIFF(DAY,s.criada_em,UTC_TIMESTAMP())) DESC,p.id`,
      [
        value,
        ...(id ? [identity(id)] : []),
        config.queueMediumWeight ?? 7,
        config.queueStandardWeight ?? 0
      ]
    );
    if (id) check(rows.length, 'Pedido não encontrado.', 404);
    return rows.map((r) => ({
      ...r,
      id: String(r.id),
      id_solicitacao: String(r.id_solicitacao),
      id_parceiro: String(r.id_parceiro)
    }));
  }
  async function transition(user, id, action) {
    const found = (await list(user, id))[0];
    return transaction(async (db) => {
      const [[s]] = await db.execute(
        'SELECT * FROM solicitacao WHERE id=? FOR UPDATE',
        [found.id_solicitacao]
      );
      const [[p]] = await db.execute(
        'SELECT * FROM pedido WHERE id=? FOR UPDATE',
        [id]
      );
      const rules = {
        aceitar: ['parceiro', ['pendente'], 'em_producao', 'aceito'],
        recusar: ['parceiro', ['pendente'], 'recusado', 'recusado'],
        finalizar: ['parceiro', ['em_producao'], 'finalizado', 'finalizado'],
        cancelar: ['aacd', ACTIVE, 'cancelado', 'cancelado']
      };
      const rule = rules[action];
      check(rule, 'Ação inválida.');
      check(
        user.perfil === rule[0],
        'Seu perfil não pode executar esta ação.',
        403
      );
      check(
        !s.encerrada_em && rule[1].includes(p.status),
        'O pedido mudou de situação. Atualize a página.',
        409
      );
      await db.execute('UPDATE pedido SET status=? WHERE id=?', [rule[2], id]);
      await event(db, id, user, rule[3]);
      if (['cancelado', 'finalizado'].includes(rule[2]))
        await db.execute(
          'UPDATE solicitacao SET encerrada_em=UTC_TIMESTAMP(),motivo_encerramento=? WHERE id=?',
          [rule[2], s.id]
        );
      return { id, status: rule[2] };
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
    const values = requestPayload(body.request || {});
    let s;
    try {
      s = await createRequest(user, body.request || {});
    } catch (error) {
      if (error.code !== 'ER_DUP_ENTRY') throw error;
      const [rows] = await pool.execute(
        'SELECT id FROM solicitacao WHERE unidade=? AND codigo=?',
        [user.unidade, values.code]
      );
      check(rows.length, 'Código já utilizado.', 409);
      s = await request(user, String(rows[0].id));
      check(
        s.link === values.url &&
          (s.observacoes || '') === values.notes &&
          s.prioridade === values.priority &&
          ['X', 'Y', 'Z'].every(
            (axis) =>
              Number(s['capacidade_' + axis.toLowerCase()]) ===
              values.volumes[axis]
          ) &&
          JSON.stringify([...s.materials].sort()) ===
            JSON.stringify([...values.materials].sort()) &&
          JSON.stringify([...s.nozzles].sort()) ===
            JSON.stringify([...values.nozzles].sort()),
        'O código já pertence a uma solicitação com outros requisitos. Use outro código.',
        409
      );
    }
    return connect(user, s.id, body.selection || {});
  }
  return {
    preview,
    createAndConnect,
    createRequest,
    listRequests,
    request,
    matches,
    connect,
    list,
    transition,
    history
  };
}
