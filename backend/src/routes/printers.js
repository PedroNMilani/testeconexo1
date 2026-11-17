import { withTransaction } from '../db.js';

// Impressoras do parceiro autenticado; a gravação usa o mesmo bloqueio dos pedidos.
export function registerPrinterRoutes(
  app,
  { pool, printers, signed, partner }
) {
  async function writePrinter(user, action) {
    return withTransaction(pool, async (db) => {
      // Usa o mesmo bloqueio de parceiro da criação do pedido.
      await db.execute('SELECT id FROM parceiro WHERE id=? FOR UPDATE', [
        user.id
      ]);
      return action();
    });
  }
  app.get('/api/impressoras', signed, partner, async (req, res) =>
    res.json({ items: await printers.list(req.user) })
  );
  app.post('/api/impressoras', signed, partner, async (req, res) =>
    res
      .status(201)
      .json(
        await writePrinter(req.user, () =>
          printers.save(req.user, req.body || {})
        )
      )
  );
  app.get('/api/impressoras/:id', signed, partner, async (req, res) =>
    res.json(await printers.get(req.user, req.params.id))
  );
  app.patch('/api/impressoras/:id', signed, partner, async (req, res) =>
    res.json(
      await writePrinter(req.user, () =>
        printers.save(req.user, req.body || {}, req.params.id)
      )
    )
  );
  app.delete('/api/impressoras/:id', signed, partner, async (req, res) =>
    res.json(
      await writePrinter(req.user, () =>
        printers.remove(req.user, req.params.id)
      )
    )
  );
}
