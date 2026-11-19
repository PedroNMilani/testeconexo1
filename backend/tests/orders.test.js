import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { MongoClient } from 'mongodb';
import { loadConfig } from '../src/config.js';
import { createPool } from '../src/db.js';
import { createRepository } from '../src/repository.js';
import { createAuthService } from '../src/auth-service.js';
import { createGeoService } from '../src/geo.js';
import { createPrinterService } from '../src/printers.js';
import { createApp } from '../src/app.js';
import { haversine } from '../src/recommendations.js';
import { validateRequest } from '../src/request-validation.js';
const config = loadConfig();
assert.equal(process.env.NODE_ENV, 'test');
assert.ok(
  config.mysql.database.endsWith('_test') &&
    config.mongoDatabase.endsWith('_test')
);
config.bcryptCost = 4;
const pool = createPool(config.mysql),
  mongo = new MongoClient(config.mongoUri),
  tag = randomUUID();
let app,
  server,
  base,
  collection,
  printers,
  aacd,
  colleague,
  other,
  partner,
  stranger,
  printer,
  otherPrinter;
const password = 'Teste-1234!';
class Client {
  cookie = '';
  csrf = '';
  async send(method, path, body) {
    if (method !== 'GET' && !this.csrf)
      await this.send('GET', '/api/auth/csrf');
    const response = await fetch(base + path, {
      method,
      headers: {
        cookie: this.cookie,
        'content-type': 'application/json',
        'x-csrf-token': this.csrf
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    for (const cookie of response.headers.getSetCookie())
      if (cookie.startsWith('conexo.sid=')) this.cookie = cookie.split(';')[0];
    const value = await response.json();
    if (value.csrfToken) this.csrf = value.csrfToken;
    return { status: response.status, value };
  }
  async login(user) {
    assert.equal(
      (
        await this.send('POST', '/api/auth/login', {
          email: user.email,
          password
        })
      ).status,
      200
    );
    return this;
  }
}
const users = {};
const body = () => ({
  code: 'TEST-' + randomUUID(),
  priority: 'Padrão',
  volumes: { X: 100, Y: 120, Z: 50 },
  materials: ['PLA', 'PETG'],
  nozzles: [0.4],
  url: 'https://example.org/molde.stl',
  notes: 'Sem dados de paciente'
});
const printerBody = {
  modelo: 'FDM teste',
  capacidade: { x: 200, y: 200, z: 200 },
  bicos: [0.4],
  materiais_compativeis: ['PLA', 'PETG'],
  materiais_disponiveis: ['PLA']
};
async function create(draft = body()) {
  const r = await aacd.send('POST', '/api/solicitacoes', draft);
  assert.equal(r.status, 201, JSON.stringify(r.value));
  return r.value;
}
function selection(p = printer, u = users.partner) {
  return { partnerId: u.id, printerId: p._id, material: 'PLA', nozzle: 0.4 };
}
async function connect(s, choose = selection()) {
  const r = await aacd.send(
    'POST',
    `/api/solicitacoes/${s.id}/pedidos`,
    choose
  );
  assert.equal(r.status, 201, JSON.stringify(r.value));
  return r.value.id;
}
before(async () => {
  await mongo.connect();
  collection = mongo.db(config.mongoDatabase).collection('impressoras');
  printers = createPrinterService(collection);
  const auth = createAuthService(
    createRepository(pool),
    config,
    createGeoService()
  );
  for (const [name, unit] of [
    ['aacd', 'Mooca'],
    ['colleague', 'Mooca'],
    ['other', 'Ibirapuera']
  ])
    users[name] = await auth.register(
      'aacd',
      {
        email: `${name}-${tag}@example.org`,
        password,
        phone: '11988887777',
        unit,
        holder: 'Teste pedidos'
      },
      { seed: true }
    );
  for (const name of ['partner', 'stranger']) {
    users[name] = await auth.register('parceiro', {
      email: `${name}-${tag}@example.org`,
      password,
      phone: '11977776666',
      institution: 'Lab ' + name,
      responsible: 'Teste',
      street: 'Rua Teste',
      city: 'São Paulo',
      state: 'SP',
      latitude: -23.55,
      longitude: -46.63,
      locationConfirmed: true,
      termsAccepted: true
    });
    await pool.execute('UPDATE parceiro SET homologado=TRUE WHERE id=?', [
      users[name].id
    ]);
  }
  printer = await printers.save(users.partner, printerBody);
  otherPrinter = await printers.save(users.stranger, printerBody);
  app = createApp({ pool, config, geo: createGeoService(), printers });
  await app.locals.sessionStore.onReady();
  server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  base = 'http://127.0.0.1:' + server.address().port;
  aacd = await new Client().login(users.aacd);
  colleague = await new Client().login(users.colleague);
  other = await new Client().login(users.other);
  partner = await new Client().login(users.partner);
  stranger = await new Client().login(users.stranger);
});
after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (app) await app.locals.sessionStore.close();
  await mongo.close();
  await pool.end();
});
test('validação rejeita dimensões fracionárias, material, bico e URLs inválidos', () => {
  for (const update of [
    { volumes: { X: 0, Y: 1, Z: 1 } },
    { volumes: { X: 1.5, Y: 1, Z: 1 } },
    { materials: ['RESINA'] },
    { nozzles: [0.001] },
    { url: 'javascript:alert(1)' },
    { url: 'https://user:pass@example.org' },
    { notes: 'x'.repeat(4001) }
  ])
    assert.throws(() => validateRequest({ ...body(), ...update }));
  assert.equal(
    haversine(
      { latitude: -23.55, longitude: -46.63 },
      { latitude: -23.55, longitude: -46.63 }
    ),
    0
  );
});
test('API exige sessão e homologação', async () => {
  assert.equal((await new Client().send('GET', '/api/pedidos')).status, 401);
  await pool.execute('UPDATE parceiro SET homologado=FALSE WHERE id=?', [
    users.stranger.id
  ]);
  assert.equal((await stranger.send('GET', '/api/pedidos')).status, 403);
  await pool.execute('UPDATE parceiro SET homologado=TRUE WHERE id=?', [
    users.stranger.id
  ]);
});
test('match usa capacidade sem rotação, homologação e opções de material; estoque apenas informa', async () => {
  const s = await create();
  const r = await aacd.send('GET', `/api/solicitacoes/${s.id}/recomendacoes`);
  assert.equal(r.status, 200);
  const own = r.value.items.filter((x) => x.printerId === printer._id);
  assert.equal(own.length, 2);
  assert.equal(own.find((x) => x.material === 'PLA').needsMaterial, false);
  assert.equal(own.find((x) => x.material === 'PETG').needsMaterial, true);
  assert.ok(own.every((x) => x.distanceKm > 0));
  await pool.execute('UPDATE parceiro SET homologado=FALSE WHERE id=?', [
    users.stranger.id
  ]);
  const filtered = await aacd.send(
    'GET',
    `/api/solicitacoes/${s.id}/recomendacoes`
  );
  assert.ok(
    filtered.value.items.every((x) => x.partnerId !== users.stranger.id)
  );
  await pool.execute('UPDATE parceiro SET homologado=TRUE WHERE id=?', [
    users.stranger.id
  ]);
  const large = await create({ ...body(), volumes: { X: 201, Y: 50, Z: 50 } });
  assert.deepEqual(
    (await aacd.send('GET', `/api/solicitacoes/${large.id}/recomendacoes`))
      .value.items,
    []
  );
});
test('código único por unidade, persistência dos requisitos e isolamento por unidade/proprietário', async () => {
  const draft = body(),
    s = await create(draft),
    id = await connect(s);
  assert.equal(
    (await aacd.send('POST', '/api/solicitacoes', draft)).status,
    409
  );
  assert.equal(
    (await other.send('POST', '/api/solicitacoes', draft)).status,
    201
  );
  assert.equal(
    (await other.send('GET', `/api/solicitacoes/${s.id}`)).status,
    404
  );
  assert.equal((await other.send('GET', `/api/pedidos/${id}`)).status, 404);
  assert.equal((await stranger.send('GET', `/api/pedidos/${id}`)).status, 404);
  assert.equal((await colleague.send('GET', `/api/pedidos/${id}`)).status, 200);
  const saved = await partner.send('GET', `/api/pedidos/${id}`);
  assert.equal(saved.value.codigo, draft.code);
  assert.equal(saved.value.link, draft.url);
  assert.equal(saved.value.observacoes, draft.notes);
  assert.equal(
    (await partner.send('POST', `/api/pedidos/${id}/acoes/cancelar`, {}))
      .status,
    403
  );
  assert.equal(
    (await colleague.send('POST', `/api/pedidos/${id}/acoes/cancelar`, {}))
      .status,
    200
  );
  assert.equal(
    (await aacd.send('POST', `/api/solicitacoes/${s.id}/pedidos`, selection()))
      .status,
    409
  );
});
test('duas conexões concorrentes criam no máximo um pedido ativo', async () => {
  const s = await create();
  const attempts = await Promise.all([
    aacd.send('POST', `/api/solicitacoes/${s.id}/pedidos`, selection()),
    colleague.send('POST', `/api/solicitacoes/${s.id}/pedidos`, selection())
  ]);
  assert.deepEqual(attempts.map((x) => x.status).sort(), [201, 409]);
  const [[count]] = await pool.execute(
    'SELECT COUNT(*) AS n FROM pedido WHERE id_solicitacao=?',
    [s.id]
  );
  assert.equal(Number(count.n), 1);
});
test('recusa preserva tentativa e permite reencaminhar; aceite e finalização encerram com auditoria', async () => {
  const s = await create();
  const first = await connect(s);
  assert.equal(
    (await partner.send('POST', `/api/pedidos/${first}/acoes/recusar`, {}))
      .status,
    200
  );
  assert.equal(
    (await partner.send('POST', `/api/pedidos/${first}/acoes/aceitar`, {}))
      .status,
    409
  );
  const second = await connect(s, selection(otherPrinter, users.stranger));
  assert.equal(
    (await stranger.send('POST', `/api/pedidos/${second}/acoes/finalizar`, {}))
      .status,
    409
  );
  assert.equal(
    (await stranger.send('POST', `/api/pedidos/${second}/acoes/aceitar`, {}))
      .status,
    200
  );
  assert.equal(
    (await stranger.send('POST', `/api/pedidos/${second}/acoes/finalizar`, {}))
      .status,
    200
  );
  assert.equal(
    (await aacd.send('POST', `/api/solicitacoes/${s.id}/pedidos`, selection()))
      .status,
    409
  );
  const events = await aacd.send('GET', `/api/pedidos/${second}/eventos`);
  assert.deepEqual(
    events.value.items.map((x) => x.acao),
    ['criado', 'aceito', 'finalizado']
  );
  const old = await partner.send('GET', `/api/pedidos/${first}`);
  assert.equal(old.value.status, 'recusado');
  const request = await aacd.send('GET', `/api/solicitacoes/${s.id}`);
  assert.equal(request.value.motivo_encerramento, 'finalizado');
});
test('revalida capacidade e soft delete ao conectar, sem apagar solicitação após falha', async () => {
  const p = await printers.save(users.partner, printerBody),
    s = await create();
  await printers.save(
    users.partner,
    { ...printerBody, capacidade: { x: 50, y: 50, z: 50 } },
    p._id
  );
  const result = await aacd.send(
    'POST',
    `/api/solicitacoes/${s.id}/pedidos`,
    selection(p)
  );
  assert.equal(result.status, 409);
  assert.equal(
    (await aacd.send('GET', `/api/solicitacoes/${s.id}`)).status,
    200
  );
  await printers.remove(users.partner, p._id);
  assert.equal(
    (await aacd.send('POST', `/api/solicitacoes/${s.id}/pedidos`, selection(p)))
      .status,
    404
  );
});
test('fluxo de criação pela interface pode repetir após recusa sem duplicar solicitação', async () => {
  const draft = body();
  const r = await aacd.send('POST', '/api/pedidos', {
    request: draft,
    selection: selection()
  });
  assert.equal(r.status, 201, JSON.stringify(r.value));
  assert.equal(
    (
      await aacd.send('POST', '/api/pedidos', {
        request: draft,
        selection: selection()
      })
    ).status,
    409
  );
  assert.equal(
    (await partner.send('POST', `/api/pedidos/${r.value.id}/acoes/recusar`, {}))
      .status,
    200
  );
  const again = await aacd.send('POST', '/api/pedidos', {
    request: draft,
    selection: selection(otherPrinter, users.stranger)
  });
  assert.equal(again.status, 201, JSON.stringify(again.value));
  const [[count]] = await pool.execute(
    'SELECT COUNT(*) AS n FROM solicitacao WHERE unidade=? AND codigo=?',
    ['Mooca', draft.code]
  );
  assert.equal(Number(count.n), 1);
});

test('reutilização ignora a ordem das seleções e rejeita requisitos alterados', async () => {
  const draft = { ...body(), nozzles: [0.2, 0.4] };
  await create(draft);
  for (const changed of [
    { url: 'https://example.org/outro.stl' },
    { notes: 'Novas instruções' },
    { priority: 'Urgente' },
    { volumes: { ...draft.volumes, X: 101 } },
    { materials: ['PLA'] },
    { nozzles: [0.4] }
  ]) {
    const response = await aacd.send('POST', '/api/pedidos', {
      request: { ...draft, ...changed },
      selection: selection()
    });
    assert.equal(response.status, 409);
    assert.match(response.value.error.message, /outros requisitos/);
  }
  const response = await aacd.send('POST', '/api/pedidos', {
    request: {
      ...draft,
      materials: [...draft.materials].reverse(),
      nozzles: [...draft.nozzles].reverse()
    },
    selection: selection()
  });
  assert.equal(response.status, 201, JSON.stringify(response.value));
  const [[count]] = await pool.execute(
    'SELECT COUNT(*) AS n FROM solicitacao WHERE unidade=? AND codigo=?',
    ['Mooca', draft.code]
  );
  assert.equal(Number(count.n), 1);
});

test('fila do parceiro prioriza urgente e combina peso com idade da solicitação', async () => {
  const standard = await create(),
    medium = await create({ ...body(), priority: 'Médio' }),
    urgent = await create({ ...body(), priority: 'Urgente' });
  await pool.execute(
    'UPDATE solicitacao SET criada_em=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 8 DAY) WHERE id=?',
    [standard.id]
  );
  const standardId = await connect(standard),
    mediumId = await connect(medium),
    urgentId = await connect(urgent);
  const r = await partner.send('GET', '/api/pedidos');
  const ids = new Set([standardId, mediumId, urgentId]);
  assert.deepEqual(
    r.value.items.filter((x) => ids.has(x.id)).map((x) => x.id),
    [urgentId, standardId, mediumId]
  );
});

test('capacidade igual inclui; exceder qualquer eixo ou girar a peça exclui', async () => {
  const p = await printers.save(users.partner, {
    ...printerBody,
    capacidade: { x: 80, y: 120, z: 50 }
  });
  for (const [volumes, expected] of [
    [{ X: 80, Y: 120, Z: 50 }, true],
    [{ X: 81, Y: 120, Z: 50 }, false],
    [{ X: 80, Y: 121, Z: 50 }, false],
    [{ X: 80, Y: 120, Z: 51 }, false],
    [{ X: 120, Y: 80, Z: 50 }, false]
  ]) {
    const s = await create({ ...body(), volumes });
    const r = await aacd.send('GET', `/api/solicitacoes/${s.id}/recomendacoes`);
    assert.equal(r.status, 200);
    assert.equal(
      r.value.items.some((item) => item.printerId === p._id),
      expected
    );
  }
});

test('consulta Mongo exclui material incompatível, bico ausente e impressora inativa', async () => {
  const p = await printers.save(users.partner, {
    ...printerBody,
    materiais_compativeis: ['PLA']
  });
  const baseline = await create({ ...body(), materials: ['PLA'] });
  for (const [s, expected] of [
    [baseline, true],
    [await create({ ...body(), materials: ['ABS'] }), false],
    [await create({ ...body(), nozzles: [0.6] }), false]
  ]) {
    const r = await aacd.send('GET', `/api/solicitacoes/${s.id}/recomendacoes`);
    assert.equal(r.status, 200);
    assert.equal(
      r.value.items.some((item) => item.printerId === p._id),
      expected
    );
  }
  assert.equal(
    (await partner.send('DELETE', `/api/impressoras/${p._id}`)).status,
    200
  );
  const r = await aacd.send(
    'GET',
    `/api/solicitacoes/${baseline.id}/recomendacoes`
  );
  assert.equal(r.status, 200);
  assert.ok(r.value.items.every((item) => item.printerId !== p._id));
});

test('origem salva permanece no match e no pedido; prévia usa a configuração atual', async () => {
  const draft = body(),
    s = await create(draft);
  const unit = users.aacd.unidade,
    original = config.unitLocations[unit];
  const destination = { latitude: -23.55, longitude: -46.63 };
  const distance = (origin) =>
    Number(haversine(origin, destination).toFixed(2));
  try {
    config.unitLocations[unit] = { latitude: -23.65, longitude: -46.63 };
    const saved = await aacd.send(
      'GET',
      `/api/solicitacoes/${s.id}/recomendacoes`
    );
    const preview = await aacd.send('POST', '/api/recomendacoes', draft);
    assert.equal(saved.status, 200);
    assert.equal(preview.status, 200);
    assert.equal(
      saved.value.items.find((item) => item.printerId === printer._id)
        .distanceKm,
      distance(original)
    );
    assert.equal(
      preview.value.items.find((item) => item.printerId === printer._id)
        .distanceKm,
      distance(config.unitLocations[unit])
    );
    const id = await connect(s);
    const order = await aacd.send('GET', `/api/pedidos/${id}`);
    assert.equal(order.value.distancia_km, distance(original));
    delete config.unitLocations[unit];
    for (const path of ['/api/recomendacoes', '/api/solicitacoes']) {
      const r = await aacd.send('POST', path, body());
      assert.equal(r.status, 409);
      assert.equal(r.value.error.code, 'UNIT_LOCATION_REQUIRED');
    }
  } finally {
    config.unitLocations[unit] = original;
  }
});

test('recomendação rejeita pedido pendente, em produção e solicitação encerrada', async () => {
  const s = await create(),
    id = await connect(s);
  for (const action of [null, 'aceitar', 'finalizar']) {
    if (action)
      assert.equal(
        (await partner.send('POST', `/api/pedidos/${id}/acoes/${action}`, {}))
          .status,
        200
      );
    assert.equal(
      (await aacd.send('GET', `/api/solicitacoes/${s.id}/recomendacoes`))
        .status,
      409
    );
  }
  const request = await aacd.send('GET', `/api/solicitacoes/${s.id}`);
  assert.equal(request.value.motivo_encerramento, 'finalizado');
  assert.ok(request.value.encerrada_em);
});

test('encaminhamento revalida material, bico, homologação e proprietário sem criar tentativa inválida', async () => {
  const p = await printers.save(users.partner, printerBody);
  const s = await create({ ...body(), materials: ['PLA'] });
  const recommended = await aacd.send(
    'GET',
    `/api/solicitacoes/${s.id}/recomendacoes`
  );
  assert.ok(recommended.value.items.some((item) => item.printerId === p._id));
  for (const change of [
    { materiais_compativeis: ['PETG'], materiais_disponiveis: [] },
    { bicos: [0.6] }
  ]) {
    assert.equal(
      (
        await partner.send('PATCH', `/api/impressoras/${p._id}`, {
          ...printerBody,
          ...change
        })
      ).status,
      200
    );
    assert.equal(
      (
        await aacd.send(
          'POST',
          `/api/solicitacoes/${s.id}/pedidos`,
          selection(p)
        )
      ).status,
      409
    );
    assert.equal(
      (await partner.send('PATCH', `/api/impressoras/${p._id}`, printerBody))
        .status,
      200
    );
  }
  await pool.execute('UPDATE parceiro SET homologado=FALSE WHERE id=?', [
    users.partner.id
  ]);
  try {
    assert.equal(
      (
        await aacd.send(
          'POST',
          `/api/solicitacoes/${s.id}/pedidos`,
          selection(p)
        )
      ).status,
      409
    );
  } finally {
    await pool.execute('UPDATE parceiro SET homologado=TRUE WHERE id=?', [
      users.partner.id
    ]);
  }
  assert.equal(
    (
      await aacd.send(
        'POST',
        `/api/solicitacoes/${s.id}/pedidos`,
        selection(otherPrinter)
      )
    ).status,
    404
  );
  const [[count]] = await pool.execute(
    'SELECT COUNT(*) AS n FROM pedido WHERE id_solicitacao=?',
    [s.id]
  );
  assert.equal(Number(count.n), 0);
  const request = await aacd.send('GET', `/api/solicitacoes/${s.id}`);
  assert.equal(request.value.encerrada_em, null);
});

test('cancelar em produção encerra solicitação e registra a conta AACD autora', async () => {
  const s = await create(),
    id = await connect(s);
  assert.equal(
    (await partner.send('POST', `/api/pedidos/${id}/acoes/aceitar`, {})).status,
    200
  );
  const cancelled = await aacd.send(
    'POST',
    `/api/pedidos/${id}/acoes/cancelar`,
    {}
  );
  assert.equal(cancelled.status, 200);
  assert.equal(cancelled.value.status, 'cancelado');
  const request = await aacd.send('GET', `/api/solicitacoes/${s.id}`);
  assert.equal(request.value.motivo_encerramento, 'cancelado');
  assert.ok(request.value.encerrada_em);
  const events = await aacd.send('GET', `/api/pedidos/${id}/eventos`);
  assert.deepEqual(
    events.value.items.map((item) => item.acao),
    ['criado', 'aceito', 'cancelado']
  );
  const last = events.value.items.at(-1);
  assert.equal(last.perfil, 'aacd');
  assert.equal(String(last.id_autor), users.aacd.id);
  assert.ok(last.criado_em);
});

test('todas as transições proibidas retornam conflito sem alterar estado ou auditoria', async () => {
  const actions = {
    aceitar: partner,
    recusar: partner,
    finalizar: partner,
    cancelar: aacd
  };
  for (const [status, setup, allowed] of [
    ['pendente', [], ['aceitar', 'recusar', 'cancelar']],
    ['em_producao', ['aceitar'], ['finalizar', 'cancelar']],
    ['recusado', ['recusar'], []],
    ['cancelado', ['cancelar'], []],
    ['finalizado', ['aceitar', 'finalizar'], []]
  ]) {
    const s = await create(),
      id = await connect(s);
    for (const action of setup)
      assert.equal(
        (
          await actions[action].send(
            'POST',
            `/api/pedidos/${id}/acoes/${action}`,
            {}
          )
        ).status,
        200
      );
    const beforeEvents = await aacd.send('GET', `/api/pedidos/${id}/eventos`);
    const beforeRequest = await aacd.send('GET', `/api/solicitacoes/${s.id}`);
    for (const [action, client] of Object.entries(actions)) {
      if (!allowed.includes(action))
        assert.equal(
          (await client.send('POST', `/api/pedidos/${id}/acoes/${action}`, {}))
            .status,
          409,
          `${status}: ${action}`
        );
    }
    const order = await aacd.send('GET', `/api/pedidos/${id}`);
    assert.equal(order.value.status, status);
    assert.deepEqual(
      (await aacd.send('GET', `/api/pedidos/${id}/eventos`)).value,
      beforeEvents.value
    );
    assert.deepEqual(
      (await aacd.send('GET', `/api/solicitacoes/${s.id}`)).value,
      beforeRequest.value
    );
  }
});
