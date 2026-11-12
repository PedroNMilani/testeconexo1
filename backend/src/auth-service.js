import bcrypt from 'bcrypt';
import { check } from './errors.js';
import { publicUser } from './repository.js';
export function string(value, name, max = 150) {
  check(
    typeof value === 'string' &&
      value.trim().length > 0 &&
      value.trim().length <= max,
    `Informe ${name}.`
  );
  return value.trim();
}
export function email(value) {
  const normalized = string(value, 'um email válido', 254).toLowerCase();
  check(
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized),
    'Informe um email válido.'
  );
  return normalized;
}
export function phone(value) {
  const normalized = string(value, 'um telefone válido', 30).replace(
    /[\s()-]/g,
    ''
  );
  check(/^\+?[0-9]{10,15}$/.test(normalized), 'Informe um telefone com DDD.');
  return normalized;
}
export function password(value) {
  check(
    typeof value === 'string' &&
      value.length >= 8 &&
      Buffer.byteLength(value, 'utf8') <= 72,
    'A senha deve ter ao menos 8 caracteres e no máximo 72 bytes UTF-8.'
  );
  return value;
}
export function createAuthService(repo, config, geo) {
  function forbiddenFields(body) {
    check(
      !['homologado', 'perfil', 'id', 'id_parceiro', 'senha_hash'].some(
        (key) => key in body
      ),
      'O cadastro contém campos não permitidos.'
    );
  }
  async function register(role, body, { seed = false } = {}) {
    forbiddenFields(body);
    const account = {
      email: email(body.email),
      phone: phone(body.phone),
      hash: await bcrypt.hash(password(body.password), config.bcryptCost)
    };
    let values;
    if (role === 'aacd') {
      check(config.units.includes(body.unit), 'Selecione uma unidade válida.');
      values = {
        unit: body.unit,
        holder: string(body.holder, 'o nome do titular')
      };
    } else {
      check(body.termsAccepted === true, 'Confirme os termos de uso.');
      geo.validateConfirmed(body);
      values = {
        institution: string(body.institution, 'o nome da instituição'),
        responsible: string(body.responsible, 'o responsável', 100),
        street: string(body.street, 'a rua'),
        number: typeof body.number === 'string' ? body.number.trim() : '',
        city: string(body.city, 'a cidade', 100),
        state: body.state,
        latitude: body.latitude,
        longitude: body.longitude
      };
      check(values.number.length <= 10, 'Número do endereço muito longo.');
    }
    return repo.withEmailLock(account.email, async (db) => {
      check(
        (await repo.byEmail(account.email, db)).length === 0,
        'Este email já está cadastrado.',
        409
      );
      let result;
      if (role === 'aacd')
        [result] = await db.execute(
          'INSERT INTO aacd(email,senha_hash,unidade,telefone,homologado,nome_titular) VALUES(?,?,?,?,?,?)',
          [
            account.email,
            account.hash,
            values.unit,
            account.phone,
            seed,
            values.holder
          ]
        );
      else
        [result] = await db.execute(
          'INSERT INTO parceiro(nome_instituicao,responsavel,email,telefone,senha_hash,rua,numero,cidade,uf,latitude,longitude) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
          [
            values.institution,
            values.responsible,
            account.email,
            account.phone,
            account.hash,
            values.street,
            values.number || null,
            values.city,
            values.state,
            values.latitude,
            values.longitude
          ]
        );
      return publicUser(
        await repo.byIdentity({ id: result.insertId, perfil: role }, db)
      );
    });
  }
  async function login(body) {
    const normalized = email(body.email);
    check(
      typeof body.password === 'string' &&
        Buffer.byteLength(body.password, 'utf8') <= 72,
      'Email ou senha inválidos.',
      401
    );
    const rows = await repo.byEmail(normalized);
    check(
      rows.length <= 1,
      'Este email está em mais de um perfil. A equipe precisa corrigir o cadastro antes do login.',
      409,
      'AMBIGUOUS_EMAIL'
    );
    const match =
      rows[0] && (await bcrypt.compare(body.password, rows[0].senha_hash));
    check(match, 'Email ou senha inválidos.', 401);
    return publicUser(rows[0]);
  }
  return { register, login };
}
