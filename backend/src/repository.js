import { HttpError } from './errors.js';
// A base enviada tem duas tabelas de contas. O perfil é obtido do banco, não do botão de login.
export function createRepository(pool) {
  async function byEmail(email, db = pool) {
    const [aacd] = await db.execute(
      "SELECT *, 'aacd' AS perfil FROM aacd WHERE email=?",
      [email]
    );
    const [partners] = await db.execute(
      "SELECT *, 'parceiro' AS perfil FROM parceiro WHERE email=?",
      [email]
    );
    return [...aacd, ...partners];
  }
  async function byIdentity(identity, db = pool) {
    if (!identity || !['aacd', 'parceiro'].includes(identity.perfil))
      return null;
    const [rows] = await db.execute(
      `SELECT * FROM ${identity.perfil === 'aacd' ? 'aacd' : 'parceiro'} WHERE id=?`,
      [identity.id]
    );
    return rows[0] ? { ...rows[0], perfil: identity.perfil } : null;
  }
  // Serializa a curta transação de cadastro/edição entre as duas tabelas.
  // Lock global também cobre equivalências da collation MySQL (acentos, maiúsculas).
  async function withEmailLock(email, action) {
    const db = await pool.getConnection();
    const key = 'conexo:contas-email';
    let locked = false;
    try {
      const [[row]] = await db.execute('SELECT GET_LOCK(?,5) AS acquired', [
        key
      ]);
      if (Number(row.acquired) !== 1)
        throw new HttpError(
          409,
          'Outra operação está usando este email. Tente novamente.'
        );
      locked = true;
      await db.beginTransaction();
      const result = await action(db);
      await db.commit();
      return result;
    } catch (error) {
      await db.rollback();
      throw error;
    } finally {
      try {
        if (locked) await db.execute('SELECT RELEASE_LOCK(?)', [key]);
      } finally {
        db.release();
      }
    }
  }
  return { byEmail, byIdentity, withEmailLock, pool };
}
export function publicUser(row) {
  const base = {
    id: String(row.id),
    perfil: row.perfil,
    email: row.email,
    telefone: row.telefone,
    homologado: Boolean(row.homologado)
  };
  return row.perfil === 'aacd'
    ? { ...base, nome: row.nome_titular || row.email, unidade: row.unidade }
    : {
        ...base,
        nome: row.nome_instituicao,
        responsavel: row.responsavel,
        rua: row.rua,
        numero: row.numero || '',
        cidade: row.cidade,
        uf: row.uf,
        latitude: Number(row.latitude),
        longitude: Number(row.longitude)
      };
}
