import { check } from './errors.js';
import { MATERIALS } from '../../material-catalog.js';

export function validateRequest(body) {
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
export function validateId(id) {
  check(
    typeof id === 'string' && /^[1-9][0-9]*$/.test(id),
    'Registro não encontrado.',
    404
  );
  return id;
}
export function requireApprovedUser(user) {
  check(
    user && user.homologado && ['aacd', 'parceiro'].includes(user.perfil),
    'Aguarde a homologação da sua conta.',
    403
  );
}
