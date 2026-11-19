import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createRecommendationService,
  haversine
} from '../src/recommendations.js';

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
