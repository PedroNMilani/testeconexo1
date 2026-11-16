
const dbConexo = db.getSiblingDB('conexo'); // nome do banco é uma suposição

// Coleção IMPRESSORAS
//
// id_parceiro         : id numérico de parceiro.id no MySQL (sem integridade referencial
//                       entre bancos; o backend valida que o parceiro existe).
// capacidade          : volume de impressão em mm; comparação direta x com x, y com y, z com z.
// bicos               : diâmetros em mm que a impressora pode usar.
// materiais_compativeis: o que a impressora SUPORTA (usado no FILTRO do match).
// materiais_disponiveis: o que a instituição PODE OFERECER (só INFORMA no match, não filtra).
// precisa_material    : true se a AACD precisa enviar o material para esta impressora.
// ativa               : Impressora nunca é apagada de verdade, pois pedidos
//                       antigos no MySQL guardam o _id dela.
//
dbConexo.createCollection('impressoras', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: [
        'id_parceiro',
        'modelo',
        'capacidade',
        'bicos',
        'materiais_compativeis',
        'materiais_disponiveis',
        'precisa_material',
        'ativa',
        'criada_em'
      ],
      additionalProperties: false,
      properties: {
        _id: { bsonType: 'objectId' },
        id_parceiro: { bsonType: 'number', minimum: 1 },
        modelo: { bsonType: 'string', minLength: 1 },
        capacidade: {
          bsonType: 'object',
          required: ['x', 'y', 'z'],
          additionalProperties: false,
          properties: {
            x: { bsonType: 'number', exclusiveMinimum: true, minimum: 0 },
            y: { bsonType: 'number', exclusiveMinimum: true, minimum: 0 },
            z: { bsonType: 'number', exclusiveMinimum: true, minimum: 0 }
          }
        },
        bicos: {
          bsonType: 'array',
          minItems: 1,
          uniqueItems: true,
          items: { bsonType: 'number', exclusiveMinimum: true, minimum: 0 }
        },
        materiais_compativeis: {
          bsonType: 'array',
          minItems: 1,
          uniqueItems: true,
          items: { bsonType: 'string' }
        },
        materiais_disponiveis: {
          bsonType: 'array',
          uniqueItems: true,
          items: { bsonType: 'string' }
        },
        precisa_material: { bsonType: 'bool' },
        ativa: { bsonType: 'bool' },
        criada_em: { bsonType: 'date' }
      }
    }
  }
});

// Índices
// 1) Listar as impressoras de um parceiro (tela de cadastro/gestão).
// 2) Filtro do match: ativas + material compatível (índice multikey).
dbConexo.impressoras.createIndex({ id_parceiro: 1 });
dbConexo.impressoras.createIndex({ ativa: 1, materiais_compativeis: 1 });
