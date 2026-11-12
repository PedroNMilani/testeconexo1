import { ObjectId } from 'mongodb';
import { MATERIALS, needsMaterialSupply } from '../../material-catalog.js';
import { check } from './errors.js';
import { string } from './auth-service.js';
export function createPrinterService(collection) {
  function payload(body) {
    const capacity = body.capacidade;
    check(
      capacity &&
        ['x', 'y', 'z'].every(
          (axis) =>
            typeof capacity[axis] === 'number' &&
            Number.isFinite(capacity[axis]) &&
            capacity[axis] > 0
        ),
      'Informe um volume positivo em X/Y/Z.'
    );
    check(
      Array.isArray(body.bicos) &&
        body.bicos.length > 0 &&
        body.bicos.every(
          (value) =>
            typeof value === 'number' && Number.isFinite(value) && value > 0
        ),
      'Selecione ao menos um bico válido.'
    );
    check(
      Array.isArray(body.materiais_compativeis) &&
        body.materiais_compativeis.length > 0 &&
        body.materiais_compativeis.every((value) => MATERIALS.includes(value)),
      'Selecione materiais compatíveis válidos.'
    );
    check(
      Array.isArray(body.materiais_disponiveis) &&
        body.materiais_disponiveis.every((value) =>
          body.materiais_compativeis.includes(value)
        ),
      'Materiais disponíveis devem ser compatíveis com a impressora.'
    );
    const compatible = [...new Set(body.materiais_compativeis)],
      available = [...new Set(body.materiais_disponiveis)];
    return {
      modelo: string(body.modelo, 'o modelo da impressora'),
      capacidade: { x: capacity.x, y: capacity.y, z: capacity.z },
      bicos: [...new Set(body.bicos)],
      materiais_compativeis: compatible,
      materiais_disponiveis: available,
      // Compatibilidade com o campo do banco enviado: indicação geral, nunca prevalece sobre a opção escolhida.
      precisa_material: compatible.some(
        (material) => !available.includes(material)
      )
    };
  }
  function id(value) {
    check(
      typeof value === 'string' && /^[0-9a-f]{24}$/.test(value),
      'Impressora inválida.',
      404
    );
    return new ObjectId(value);
  }
  const serialize = (record) =>
    record
      ? {
          ...record,
          _id: record._id.toHexString(),
          necessidade_por_material: Object.fromEntries(
            record.materiais_compativeis.map((material) => [
              material,
              needsMaterialSupply(
                record.materiais_compativeis,
                record.materiais_disponiveis,
                material
              )
            ])
          )
        }
      : null;
  async function get(user, key) {
    const record = await collection.findOne({
      _id: id(key),
      id_parceiro: Number(user.id),
      ativa: true
    });
    check(record, 'Impressora não encontrada.', 404);
    return serialize(record);
  }
  return {
    async list(user) {
      return (
        await collection
          .find({ id_parceiro: Number(user.id), ativa: true })
          .sort({ criada_em: 1 })
          .toArray()
      ).map(serialize);
    },
    get,
    async save(user, body, key = null) {
      const values = payload(body);
      if (key) {
        const record = await collection.findOneAndUpdate(
          { _id: id(key), id_parceiro: Number(user.id), ativa: true },
          { $set: values },
          { returnDocument: 'after' }
        );
        check(record, 'Impressora não encontrada.', 404);
        return serialize(record);
      }
      const record = {
        ...values,
        id_parceiro: Number(user.id),
        ativa: true,
        criada_em: new Date()
      };
      const result = await collection.insertOne(record);
      return serialize({ ...record, _id: result.insertedId });
    },
    async remove(user, key) {
      const record = await get(user, key);
      await collection.updateOne(
        { _id: id(key), id_parceiro: Number(user.id) },
        { $set: { ativa: false } }
      );
      return record;
    }
  };
}
