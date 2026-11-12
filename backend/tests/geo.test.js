import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGeoService, insideBrazil, UFS } from '../src/geo.js';
test('geometria rejeita ponto fora do Brasil mesmo dentro da caixa aproximada', () => {
  assert.equal(UFS.length, 27);
  assert.equal(insideBrazil(-23.55, -46.63), true);
  assert.equal(insideBrazil(-17, -63), false);
  assert.equal(insideBrazil(NaN, 0), false);
});
test('geocodificação estruturada não envia número, usa fallback cidade e espaça as chamadas', async () => {
  const calls = [];
  const geo = createGeoService({
    userAgent: 'CoNexo teste (teste@example.org)',
    intervalMs: 20,
    request: async (url) => {
      calls.push({ at: Date.now(), url });
      return {
        ok: true,
        json: async () =>
          url.searchParams.has('street')
            ? []
            : [{ lat: '-23.55', lon: '-46.63' }]
      };
    }
  });
  const point = await geo.geocode({
    street: 'Avenida Paulista',
    number: '123',
    city: 'São Paulo',
    state: 'SP'
  });
  assert.equal(point.nivel, 'cidade');
  assert.equal(calls.length, 2);
  assert.ok(calls[1].at - calls[0].at >= 18);
  assert.equal(calls[0].url.searchParams.get('street'), 'Avenida Paulista');
  assert.equal(calls[0].url.searchParams.has('number'), false);
  assert.equal(calls[0].url.searchParams.get('country'), 'Brasil');
  await geo.geocode({
    street: 'Avenida Paulista',
    city: 'São Paulo',
    state: 'SP'
  });
  assert.equal(calls.length, 2);
});
const address = { street: 'Avenida Paulista', city: 'São Paulo', state: 'SP' };
const options = {
  userAgent: 'CoNexo teste (teste@example.org)',
  intervalMs: 0
};

test('rua encontrada retorna coordenadas sem consultar a cidade', async () => {
  let calls = 0;
  const geo = createGeoService({
    ...options,
    request: async () => {
      calls++;
      return { ok: true, json: async () => [{ lat: '-23.55', lon: '-46.63' }] };
    }
  });
  assert.deepEqual(await geo.geocode(address), {
    latitude: -23.55,
    longitude: -46.63,
    nivel: 'rua'
  });
  assert.equal(calls, 1);
});

test('nenhum resultado retorna erro em vez do centro do estado', async () => {
  const geo = createGeoService({
    ...options,
    request: async () => ({ ok: true, json: async () => [] })
  });
  await assert.rejects(geo.geocode(address), {
    status: 404,
    code: 'GEOCODING_NOT_FOUND'
  });
});

for (const [name, response] of [
  [
    'erro de rede',
    async () => {
      throw new Error('indisponível');
    }
  ],
  [
    'timeout',
    async () => {
      throw new DOMException('timeout', 'TimeoutError');
    }
  ],
  ['limite do provedor', async () => ({ ok: false, status: 429 })],
  [
    'resposta inválida',
    async () => ({ ok: true, json: async () => ({ error: 'erro' }) })
  ],
  [
    'coordenadas inválidas',
    async () => ({ ok: true, json: async () => [{ lat: 'abc', lon: '0' }] })
  ]
]) {
  test(`${name} não retorna aproximação e permite nova tentativa`, async () => {
    let calls = 0;
    const geo = createGeoService({
      ...options,
      request: async () => {
        calls++;
        if (calls === 1) return response();
        return {
          ok: true,
          json: async () => [{ lat: '-23.55', lon: '-46.63' }]
        };
      }
    });
    await assert.rejects(geo.geocode(address), {
      status: 503,
      code: 'GEOCODING_UNAVAILABLE'
    });
    assert.equal(calls, 1);
    assert.equal((await geo.geocode(address)).nivel, 'rua');
    assert.equal(calls, 2);
  });
}

for (const userAgent of ['', 'CoNexo (contato: seu-email)']) {
  test('configuração ausente não consulta provedor nem retorna coordenadas', async () => {
    const geo = createGeoService({
      userAgent,
      request: () => assert.fail('Não deve consultar')
    });
    await assert.rejects(geo.geocode(address), {
      status: 503,
      code: 'GEOCODING_NOT_CONFIGURED'
    });
  });
}
