// Fixtures apenas de teste: a aplicação não importa dados de demonstração.
import assert from 'node:assert/strict';
globalThis.document = { dispatchEvent() {} };
const calls = [];
let signedUser = null,
  failOrders = false;
const user = {
  id: '9',
  perfil: 'aacd',
  homologado: true,
  unidade: 'Mooca',
  nome: 'Conta de teste',
  email: 'conta@example.org',
  telefone: '11999999999'
};
const order = {
  id: '5',
  id_solicitacao: '3',
  id_parceiro: '2',
  codigo: 'TEST-5',
  status: 'pendente',
  prioridade: 'padrao',
  capacidade_x: 20,
  capacidade_y: 30,
  capacidade_z: 40,
  material: 'PLA',
  bico_mm: 0.4,
  unidade: 'Mooca',
  link: 'https://example.org/molde',
  snapshot: { lab: 'Laboratório de teste' },
  atualizado_em: '2026-11-16T10:00:00.000Z'
};
globalThis.fetch = async (path, options = {}) => {
  calls.push({ path, method: options.method || 'GET', body: options.body });
  if (path === '/api/auth/csrf') return Response.json({ csrfToken: 'teste' });
  if (path === '/api/auth/login') {
    signedUser = user;
    return Response.json({ user, csrfToken: 'teste' });
  }
  if (path === '/api/auth/me')
    return signedUser
      ? Response.json({ user: signedUser })
      : Response.json(
          { error: { message: 'Entre na conta' } },
          { status: 401 }
        );
  if (path === '/api/auth/logout') {
    signedUser = null;
    return new Response(null, { status: 204 });
  }
  if (path === '/api/pedidos')
    return failOrders
      ? Response.json(
          { error: { code: 'TEST_FAILURE', message: 'Falha de teste' } },
          { status: 503 }
        )
      : Response.json({ items: [order] });
  if (path === '/api/pedidos/5') return Response.json(order);
  if (path === '/api/pedidos/5/acoes/aceitar') {
    order.status = 'em_producao';
    return Response.json({ id: '5', status: 'em_producao' });
  }
  if (path === '/api/solicitacoes') return Response.json({ items: [] });
  throw new Error('Requisição inesperada: ' + path);
};
const auth = await import('../auth-client.js');
const data = await import('../data.js');
assert.equal(await data.getCurrentUser(), null);
assert.equal(await data.getProfile('aacd'), null);
assert.deepEqual(await data.listOrders(), []);
assert.equal(auth.canOpen('parceiro-inicio'), false);
assert.equal(auth.canOpen('aacd-inicio'), false);
await auth.login({ email: user.email, password: 'Somente teste' });
const orders = await data.listOrders();
assert.equal(orders.length, 1);
assert.equal(orders[0].code, 'TEST-5');
assert.equal(orders[0].status, data.ORDER_STATUS.NOT_ACCEPTED);
assert.equal(orders[0].lab, 'Laboratório de teste');
assert.deepEqual(orders[0].volumes, { X: 20, Y: 30, Z: 40 });
assert.equal(await data.getProfile('partner'), null);
assert.equal((await data.getProfile('aacd'))['aacd-profile-name'], user.nome);
assert.deepEqual(await data.listRequests(), []);
assert.equal(
  (await data.acceptOrder('5')).status,
  data.ORDER_STATUS.IN_PRODUCTION
);
assert.ok(
  calls.some(
    (c) => c.path === '/api/pedidos/5/acoes/aceitar' && c.method === 'POST'
  )
);
failOrders = true;
await assert.rejects(
  data.listOrders(),
  (error) => error.code === 'TEST_FAILURE' && error.status === 503
);
await auth.logout();
assert.deepEqual(await data.listOrders(), []);
assert.equal(await data.getProfile('aacd'), null);
assert.equal(auth.canOpen('aacd-inicio'), false);
console.log(
  'PASS: dados vêm da API; sem autenticação não há acesso/perfis de exemplo; falhas não ativam dados fictícios; estados e rotas preservados.'
);
