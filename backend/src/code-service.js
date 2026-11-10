import { MATERIALS } from '../../material-catalog.js';
import { check } from './errors.js';
export async function generateCode(pool, user, material) {
  check(MATERIALS.includes(material), 'Escolha um material válido.');
  const [result] = await pool.execute('INSERT INTO codigo_solicitacao(id_aacd,material) VALUES(?,?)', [user.id, material]);
  const id = String(result.insertId);
  return { id, material, code: `${material}-${id.padStart(6, '0')}` };
}
