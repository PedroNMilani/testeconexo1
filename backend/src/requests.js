import { check } from './errors.js';
import { insideBrazil } from './geo.js';
import { withTransaction } from './db.js';
import {
  validateRequest,
  validateId,
  requireApprovedUser
} from './request-validation.js';

// As seleções não dependem da ordem dos materiais e bicos. A validação remove duplicatas.
function sameItems(first, second) {
  return (
    first.length === second.length &&
    first.every((value) => second.includes(value))
  );
}
function hasSameRequirements(request, values) {
  return (
    request.link === values.url &&
    (request.observacoes || '') === values.notes &&
    request.prioridade === values.priority &&
    Number(request.capacidade_x) === values.volumes.X &&
    Number(request.capacidade_y) === values.volumes.Y &&
    Number(request.capacidade_z) === values.volumes.Z &&
    sameItems(request.materials, values.materials) &&
    sameItems(request.nozzles, values.nozzles)
  );
}

// Consulta e gravação da demanda da AACD, antes de escolher um parceiro.
export function createRequestService({ pool, config }) {
  async function getRequest(user, id, db = pool, lock = false) {
    requireApprovedUser(user);
    check(user.perfil === 'aacd', 'Acesso reservado à AACD.', 403);
    const [rows] = await db.execute(
      `SELECT * FROM solicitacao WHERE id=? AND unidade=?${lock ? ' FOR UPDATE' : ''}`,
      [validateId(id), user.unidade]
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
    requireApprovedUser(user);
    check(user.perfil === 'aacd', 'Acesso reservado à AACD.', 403);
    const [rows] = await pool.execute(
      'SELECT s.*, (SELECT p.status FROM pedido p WHERE p.id_solicitacao=s.id ORDER BY p.id DESC LIMIT 1) AS ultimo_status FROM solicitacao s WHERE s.unidade=? ORDER BY s.id DESC',
      [user.unidade]
    );
    return rows.map((record) => ({ ...record, id: String(record.id) }));
  }
  async function createRequest(user, body) {
    requireApprovedUser(user);
    check(user.perfil === 'aacd', 'Acesso reservado à AACD.', 403);
    const values = validateRequest(body),
      origin = config.unitLocations?.[user.unidade];
    check(
      origin && insideBrazil(origin.latitude, origin.longitude),
      'A equipe precisa configurar a localização confirmada desta unidade AACD antes de criar pedidos.',
      409,
      'UNIT_LOCATION_REQUIRED'
    );
    return withTransaction(pool, async (db) => {
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
      return getRequest(user, id, db);
    });
  }
  async function getOrCreateRequest(user, body) {
    const values = validateRequest(body);
    let request;
    try {
      request = await createRequest(user, body);
    } catch (error) {
      if (error.code !== 'ER_DUP_ENTRY') throw error;
      const [rows] = await pool.execute(
        'SELECT id FROM solicitacao WHERE unidade=? AND codigo=?',
        [user.unidade, values.code]
      );
      check(rows.length, 'Código já utilizado.', 409);
      request = await getRequest(user, String(rows[0].id));
      check(
        hasSameRequirements(request, values),
        'O código já pertence a uma solicitação com outros requisitos. Use outro código.',
        409
      );
    }
    return request;
  }
  return { getRequest, listRequests, createRequest, getOrCreateRequest };
}
