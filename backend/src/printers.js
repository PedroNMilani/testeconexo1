import { ObjectId } from 'mongodb';
import { needsMaterialSupply } from './material-catalog.js';
import { check } from './errors.js';
import { validatePrinter } from './printer-validation.js';

function printerId(value) {
  check(
    typeof value === 'string' && /^[0-9a-f]{24}$/.test(value),
    'Impressora inválida.',
    404
  );
  return new ObjectId(value);
}

// Converte o ID do MongoDB e informa quais materiais precisam ser fornecidos.
function serializePrinter(record) {
  if (!record) return null;

  const materialNeeds = {};
  for (const material of record.materiais_compativeis) {
    materialNeeds[material] = needsMaterialSupply(
      record.materiais_compativeis,
      record.materiais_disponiveis,
      material
    );
  }
  return {
    ...record,
    _id: record._id.toHexString(),
    necessidade_por_material: materialNeeds
  };
}

export function createPrinterService(collection) {
  async function compatible(request) {
    const records = await collection
      .find({
        ativa: true,
        'capacidade.x': { $gte: Number(request.capacidade_x) },
        'capacidade.y': { $gte: Number(request.capacidade_y) },
        'capacidade.z': { $gte: Number(request.capacidade_z) },
        materiais_compativeis: { $in: request.materials },
        bicos: { $in: request.nozzles }
      })
      .toArray();
    return records.map(serializePrinter);
  }

  async function list(user) {
    const records = await collection
      .find({ id_parceiro: Number(user.id), ativa: true })
      .sort({ criada_em: 1 })
      .toArray();
    return records.map(serializePrinter);
  }

  async function get(user, key) {
    const record = await collection.findOne({
      _id: printerId(key),
      id_parceiro: Number(user.id),
      ativa: true
    });
    check(record, 'Impressora não encontrada.', 404);
    return serializePrinter(record);
  }

  async function save(user, body, key = null) {
    const values = validatePrinter(body);
    if (key) {
      const record = await collection.findOneAndUpdate(
        { _id: printerId(key), id_parceiro: Number(user.id), ativa: true },
        { $set: values },
        { returnDocument: 'after' }
      );
      check(record, 'Impressora não encontrada.', 404);
      return serializePrinter(record);
    }
    const record = {
      ...values,
      id_parceiro: Number(user.id),
      ativa: true,
      criada_em: new Date()
    };
    const result = await collection.insertOne(record);
    return serializePrinter({ ...record, _id: result.insertedId });
  }

  async function remove(user, key) {
    const record = await get(user, key);
    await collection.updateOne(
      { _id: printerId(key), id_parceiro: Number(user.id) },
      { $set: { ativa: false } }
    );
    return record;
  }

  return { compatible, list, get, save, remove };
}
