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
import { haversine, requestPayload } from '../src/orders.js';
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
    assert.throws(() => requestPayload({ ...body(), ...update }));
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
