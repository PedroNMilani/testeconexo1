import { check } from '../errors.js';

// Rede de parceiros e homologação de contas AACD e parceiros.
export function registerPartnerRoutes(
  app,
  { pool, printers, signed, approvedAACD }
) {
  app.get('/api/aacd/pendentes', signed, approvedAACD, async (req, res) => {
    const [rows] = await pool.execute(
      'SELECT id,email,unidade,telefone,nome_titular FROM aacd WHERE homologado=FALSE ORDER BY criado_em,id'
    );
    res.json({
      items: rows.map((row) => ({
        id: String(row.id),
        email: row.email,
        unidade: row.unidade,
        nome: row.nome_titular || row.email
      }))
    });
  });
  app.post(
    '/api/aacd/:id/homologacao',
    signed,
    approvedAACD,
    async (req, res) => {
      check(/^[1-9][0-9]*$/.test(req.params.id), 'Conta inválida.', 404);
      const [result] = await pool.execute(
        'UPDATE aacd SET homologado=TRUE WHERE id=? AND homologado=FALSE',
        [req.params.id]
      );
      check(
        result.affectedRows === 1,
        'Conta não encontrada ou já homologada.',
        409
      );
      res.json({ homologado: true });
    }
  );
  app.get('/api/parceiros', signed, approvedAACD, async (req, res) => {
    check(
      ['true', 'false', undefined].includes(req.query.homologado),
      'Filtro inválido.'
    );
    const [rows] = await pool.execute(
      'SELECT id,nome_instituicao,responsavel,email,telefone,rua,cidade,uf,homologado FROM parceiro' +
        (req.query.homologado === undefined ? '' : ' WHERE homologado=?') +
        ' ORDER BY criado_em,id',
      req.query.homologado === undefined
        ? []
        : [req.query.homologado === 'true']
    );
    res.json({
      items: await Promise.all(
        rows.map(async (row) => ({
          ...row,
          id: String(row.id),
          impressoras: await printers.list({ id: String(row.id) })
        }))
      )
    });
  });
  app.post(
    '/api/parceiros/:id/homologacao',
    signed,
    approvedAACD,
    async (req, res) => {
      check(/^[1-9][0-9]*$/.test(req.params.id), 'Parceiro inválido.', 404);
      const [result] = await pool.execute(
        'UPDATE parceiro SET homologado=TRUE WHERE id=? AND homologado=FALSE',
        [req.params.id]
      );
      check(
        result.affectedRows === 1,
        'Parceiro não encontrado ou já homologado.',
        409
      );
      res.json({ homologado: true });
    }
  );
}
