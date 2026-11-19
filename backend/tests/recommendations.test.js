import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  compatibleOptions,
  createRecommendationService,
  haversine
} from '../src/recommendations.js';
import { validateRequest } from '../src/request-validation.js';
import { validatePrinter } from '../src/printer-validation.js';
import { MATERIALS } from '../src/material-catalog.js';

const origin = { latitude: -23.55, longitude: -46.63 };
const user = { id: '1', perfil: 'aacd', homologado: true, unidade: 'Mooca' };
const draft = {
  code: 'MATCH-TESTE',
  priority: 'Padrão',
  volumes: { X: 100, Y: 100, Z: 100 },
  materials: ['PLA', 'PETG'],
  nozzles: [0.6, 0.4],
  url: 'https://example.org/molde.stl'
};
const request = {
  id: '1',
  materials: draft.materials,
  nozzles: draft.nozzles,
  capacidade_x: 100,
  capacidade_y: 100,
  capacidade_z: 100,
  origem_latitude: origin.latitude,
  origem_longitude: origin.longitude
};

function partner(id, latitude) {
  return {
    id,
    nome_instituicao: 'Laboratório ' + id,
    cidade: 'São Paulo',
    uf: 'SP',
    latitude,
    longitude: origin.longitude
  };
}

function printer(partnerId, id) {
  return {
    _id: id.padStart(24, '0'),
    id_parceiro: partnerId,
    modelo: 'FDM teste',
    ativa: true,
    capacidade: { x: 200, y: 200, z: 200 },
    bicos: [0.6, 0.4],
    materiais_compativeis: ['PLA', 'PETG'],
    materiais_disponiveis: ['PLA']
  };
}

function service(partners, printers) {
  return createRecommendationService({
    pool: {
      async execute(sql) {
        if (sql.includes('COUNT(*)')) return [[{ n: 0 }]];
        if (sql.includes('FROM parceiro')) return [partners];
        throw new Error('Consulta inesperada no teste de recomendações.');
      }
    },
    printers: {
      async compatible() {
        return printers;
      }
    },
    config: { unitLocations: { Mooca: origin } },
    requests: {
      async getRequest() {
        return request;
      }
    }
  });
}

test('ordena distâncias reais antes do arredondamento na prévia e na solicitação', async () => {
  const farther = partner('1', -23.5389);
  const nearer = partner('2', -23.53893);
  const farDistance = haversine(origin, farther);
  const nearDistance = haversine(origin, nearer);
  assert.ok(farDistance > nearDistance);
  assert.equal(farDistance.toFixed(2), nearDistance.toFixed(2));

  const recommendations = service(
    [farther, nearer],
    [printer('1', '1'), printer('2', '2')]
  );
  for (const items of [
    await recommendations.matches(user, request.id),
    await recommendations.preview(user, draft)
  ]) {
    assert.deepEqual(
      items.map((item) => item.partnerId),
      ['2', '2', '2', '2', '1', '1', '1', '1']
    );
    assert.ok(items.every((item) => item.distanceKm === 1.23));
  }
});

test('empates reais usam parceiro, impressora, material e bico, independentemente da ordem de entrada', async () => {
  const partners = [
    partner('2', origin.latitude),
    partner('1', origin.latitude)
  ];
  const printers = [printer('2', '3'), printer('1', '2'), printer('1', '1')];
  const expected = [];
  for (const [partnerId, printerId] of [
    ['1', '1'],
    ['1', '2'],
    ['2', '3']
  ]) {
    for (const material of ['PETG', 'PLA']) {
      for (const nozzle of [0.4, 0.6]) {
        expected.push([
          partnerId,
          printerId.padStart(24, '0'),
          material,
          nozzle
        ]);
      }
    }
  }

  for (const input of [printers, [...printers].reverse()]) {
    const items = await service(partners, input).matches(user, request.id);
    assert.deepEqual(
      items.map((item) => [
        item.partnerId,
        item.printerId,
        item.material,
        item.nozzle
      ]),
      expected
    );
    assert.ok(items.every((item) => item.distanceKm === 0));
  }
});

test('gera as combinações permitidas e calcula fornecimento por material, independentemente do resumo legado', () => {
  const machine = {
    ...printer('1', '1'),
    bicos: [0.2, 0.4, 0.6],
    materiais_compativeis: ['PLA', 'PETG', 'ABS'],
    precisa_material: false
  };
  const requirements = {
    ...request,
    materials: ['PETG', 'TPU', 'PLA'],
    nozzles: [0.4, 0.6, 0.8]
  };
  assert.deepEqual(compatibleOptions(machine, requirements), [
    { material: 'PETG', nozzle: 0.4, needsMaterial: true },
    { material: 'PETG', nozzle: 0.6, needsMaterial: true },
    { material: 'PLA', nozzle: 0.4, needsMaterial: false },
    { material: 'PLA', nozzle: 0.6, needsMaterial: false }
  ]);
  const withoutStock = compatibleOptions(
    { ...machine, materiais_disponiveis: [] },
    requirements
  );
  assert.equal(withoutStock.length, 4);
  assert.ok(withoutStock.every((option) => option.needsMaterial));
  const withStock = compatibleOptions(
    {
      ...machine,
      precisa_material: true,
      materiais_disponiveis: ['PLA', 'PETG', 'ABS']
    },
    requirements
  );
  assert.equal(withStock.length, 4);
  assert.ok(withStock.every((option) => !option.needsMaterial));
});

test('prioridade não altera as opções nem sua ordenação na recomendação', async () => {
  const recommendations = service(
    [partner('1', -23.5389), partner('2', -23.53893)],
    [printer('1', '1'), printer('2', '2')]
  );
  const expected = await recommendations.preview(user, draft);
  for (const priority of ['Médio', 'Urgente']) {
    assert.deepEqual(
      await recommendations.preview(user, { ...draft, priority }),
      expected
    );
  }
});

test('solicitações e impressoras aceitam apenas os materiais do catálogo com os nomes exatos', () => {
  for (const material of MATERIALS) {
    assert.deepEqual(
      validateRequest({ ...draft, materials: [material] }).materials,
      [material]
    );
    assert.deepEqual(
      validatePrinter({
        ...printer('1', '1'),
        materiais_compativeis: [material],
        materiais_disponiveis: []
      }).materiais_compativeis,
      [material]
    );
  }
  for (const material of ['pla', 'petg', 'ABS ', 'Resina']) {
    assert.throws(() => validateRequest({ ...draft, materials: [material] }), {
      status: 422
    });
    assert.throws(
      () =>
        validatePrinter({
          ...printer('1', '1'),
          materiais_compativeis: [material],
          materiais_disponiveis: []
        }),
      { status: 422 }
    );
  }
});
