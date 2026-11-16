// As rotas traduzem HTTP em chamadas dos serviços. As regras ficam fora delas.
export function registerOrderRoutes(
  app,
  { signed, approvedAACD, requests, recommendations, orders }
) {
  app.post('/api/recomendacoes', signed, approvedAACD, async (req, res) =>
    res.json({ items: await recommendations.preview(req.user, req.body || {}) })
  );
  app.post('/api/pedidos', signed, approvedAACD, async (req, res) =>
    res
      .status(201)
      .json(await orders.createAndConnect(req.user, req.body || {}))
  );
  app.get('/api/solicitacoes', signed, approvedAACD, async (req, res) =>
    res.json({ items: await requests.listRequests(req.user) })
  );
  app.post('/api/solicitacoes', signed, approvedAACD, async (req, res) =>
    res.status(201).json(await requests.createRequest(req.user, req.body || {}))
  );
  app.get('/api/solicitacoes/:id', signed, approvedAACD, async (req, res) =>
    res.json(await requests.getRequest(req.user, req.params.id))
  );
  app.get(
    '/api/solicitacoes/:id/recomendacoes',
    signed,
    approvedAACD,
    async (req, res) =>
      res.json({
        items: await recommendations.matches(req.user, req.params.id)
      })
  );
  app.post(
    '/api/solicitacoes/:id/pedidos',
    signed,
    approvedAACD,
    async (req, res) =>
      res
        .status(201)
        .json(await orders.connect(req.user, req.params.id, req.body || {}))
  );
  app.get('/api/pedidos', signed, async (req, res) =>
    res.json({ items: await orders.list(req.user) })
  );
  app.get('/api/pedidos/:id', signed, async (req, res) =>
    res.json((await orders.list(req.user, req.params.id))[0])
  );
  app.get('/api/pedidos/:id/eventos', signed, async (req, res) =>
    res.json({ items: await orders.history(req.user, req.params.id) })
  );
  app.post('/api/pedidos/:id/acoes/:action', signed, async (req, res) =>
    res.json(
      await orders.transition(req.user, req.params.id, req.params.action)
    )
  );
}
