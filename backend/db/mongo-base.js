// =====================================================================
// CoNexo (TTI2006) - Banco não relacional (MongoDB)
// Versão de 10/11/2026
// Execução: mongosh <sua-uri> conexo_mongo.js   (ou cole no mongosh / Compass)
// Obs.: este script NÃO foi executado em um servidor MongoDB (só o MySQL foi testado).
// =====================================================================

const dbConexo = db.getSiblingDB("conexo");   // nome do banco é uma suposição

// ---------------------------------------------------------------------
// Coleção IMPRESSORAS (apenas FDM; sem resina)
//
// id_parceiro         : id numérico de parceiro.id no MySQL (sem integridade referencial
//                       entre bancos; o backend valida que o parceiro existe).
// capacidade          : volume de impressão em mm; comparação direta x com x, y com y, z com z.
// bicos               : diâmetros em mm que a impressora pode usar (ex.: [0.4, 0.6]).
// materiais_compativeis: o que a impressora SUPORTA (usado no FILTRO do match).
// materiais_disponiveis: o que a instituição PODE OFERECER (só INFORMA no match, não filtra).
//                       Regra de negócio (a validar no backend): disponíveis ⊆ compatíveis.
// precisa_material    : true se a AACD precisa enviar o material para esta impressora.
// ativa               : soft delete. Impressora nunca é apagada de verdade, pois pedidos
//                       antigos no MySQL guardam o _id dela.
//
// Nomes de materiais devem vir da MESMA lista controlada do backend usada no MySQL
// (solicitacao_material.material), senão "PLA" e "pla" não casam.
// ---------------------------------------------------------------------
dbConexo.createCollection("impressoras", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: [
        "id_parceiro", "modelo", "capacidade", "bicos",
        "materiais_compativeis", "materiais_disponiveis",
        "precisa_material", "ativa", "criada_em"
      ],
      additionalProperties: false,
      properties: {
        _id:        { bsonType: "objectId" },
        id_parceiro: { bsonType: "number", minimum: 1 },
        modelo:      { bsonType: "string", minLength: 1 },
        capacidade: {
          bsonType: "object",
          required: ["x", "y", "z"],
          additionalProperties: false,
          properties: {
            x: { bsonType: "number", exclusiveMinimum: true, minimum: 0 },
            y: { bsonType: "number", exclusiveMinimum: true, minimum: 0 },
            z: { bsonType: "number", exclusiveMinimum: true, minimum: 0 }
          }
        },
        bicos: {
          bsonType: "array", minItems: 1, uniqueItems: true,
          items: { bsonType: "number", exclusiveMinimum: true, minimum: 0 }
        },
        materiais_compativeis: {
          bsonType: "array", minItems: 1, uniqueItems: true,
          items: { bsonType: "string" }
        },
        materiais_disponiveis: {
          bsonType: "array", uniqueItems: true,
          items: { bsonType: "string" }
        },
        precisa_material: { bsonType: "bool" },
        ativa:            { bsonType: "bool" },
        criada_em:        { bsonType: "date" }
      }
    }
  }
});

// ---------------------------------------------------------------------
// Índices
// 1) Listar as impressoras de um parceiro (tela de cadastro/gestão).
// 2) Filtro do match: ativas + material compatível (índice multikey).
//    NÃO crie um índice composto com "bicos" e "materiais_compativeis" juntos:
//    o MongoDB proíbe índice composto sobre dois arrays do mesmo documento
//    ("cannot index parallel arrays"). Capacidade e bico são filtrados em memória
//    sobre o resultado, o que é irrelevante para o volume deste projeto.
// ---------------------------------------------------------------------
dbConexo.impressoras.createIndex({ id_parceiro: 1 });
dbConexo.impressoras.createIndex({ ativa: 1, materiais_compativeis: 1 });

// ---------------------------------------------------------------------
// Consulta de referência do match (passo 1: o Mongo só FILTRA, não ordena distância)
// Entradas vindas da Solicitação: materiais[], bicos[], x, y, z.
//
// dbConexo.impressoras.find({
//   ativa: true,
//   materiais_compativeis: { $in: materiais },   // OU: suporta algum dos materiais aceitos
//   bicos:                 { $in: bicos },       // OU: tem algum dos bicos aceitos
//   "capacidade.x": { $gte: x },
//   "capacidade.y": { $gte: y },
//   "capacidade.z": { $gte: z }
// })
//
// Passo 2 (backend): buscar no MySQL os parceiros homologados dessas impressoras,
// calcular Haversine e ordenar por distância crescente.
// ---------------------------------------------------------------------
