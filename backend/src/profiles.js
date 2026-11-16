import { email, phone, string } from './auth-service.js';
import { publicUser } from './repository.js';
import { check } from './errors.js';

export function createProfileService(repo, geo) {
  async function update(user, body) {
    check(
      user.perfil !== 'aacd' || user.homologado,
      'Aguarde a homologação da conta AACD.',
      403
    );
    const normalized = email(body.email),
      telephone = phone(body.phone);
    check(
      !['homologado', 'perfil', 'id', 'senha_hash'].some((key) => key in body),
      'Campos de perfil não permitidos.'
    );
    let values;
    if (user.perfil === 'aacd') {
      check(
        body.unit === user.unidade,
        'A unidade não pode ser alterada pela própria conta. Solicite a correção à equipe AACD.',
        409
      );
      values = { name: string(body.holder, 'o nome do titular') };
    } else {
      geo.validateConfirmed(body);
      values = {
        name: string(body.institution, 'a instituição'),
        responsible: string(body.responsible, 'o responsável', 100),
        street: string(body.street, 'a rua'),
        number: typeof body.number === 'string' ? body.number.trim() : '',
        city: string(body.city, 'a cidade', 100)
      };
      check(values.number.length <= 10, 'Número de endereço muito longo.');
    }
    const updatedUser = await repo.withEmailLock(normalized, async (db) => {
      const matches = await repo.byEmail(normalized, db);
      check(
        matches.every(
          (row) => String(row.id) === user.id && row.perfil === user.perfil
        ),
        'Este email já está cadastrado.',
        409
      );
      if (user.perfil === 'aacd')
        await db.execute(
          'UPDATE aacd SET email=?,telefone=?,nome_titular=? WHERE id=?',
          [normalized, telephone, values.name, user.id]
        );
      else
        await db.execute(
          'UPDATE parceiro SET email=?,telefone=?,nome_instituicao=?,responsavel=?,rua=?,numero=?,cidade=?,uf=?,latitude=?,longitude=? WHERE id=?',
          [
            normalized,
            telephone,
            values.name,
            values.responsible,
            values.street,
            values.number || null,
            values.city,
            body.state,
            body.latitude,
            body.longitude,
            user.id
          ]
        );
      return publicUser(
        await repo.byIdentity({ id: user.id, perfil: user.perfil }, db)
      );
    });
    return updatedUser;
  }
  return { update };
}
