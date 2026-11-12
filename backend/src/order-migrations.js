import { readFile } from 'node:fs/promises';
export async function migrateOrders(db) {
  const [[migration]] = await db.execute(
    'SELECT COUNT(*) AS n FROM conexo_migrations WHERE id=?',
    ['003-pedidos']
  );
  if (Number(migration.n)) return;
  const sql = await readFile(
    new URL('../db/003-pedidos.sql', import.meta.url),
    'utf8'
  );
  for (const statement of sql
    .replace(/^--.*$/gm, '')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)) {
    const column = /^ALTER TABLE (\w+) ADD COLUMN (\w+)/.exec(statement);
    if (column) {
      const [columns] = await db.execute(
        'SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?',
        [column[1], column[2]]
      );
      if (columns.length) continue;
    }
    await db.query(statement);
  }
  // UNIQUE admite NULL nos registros anteriores à integração.
  const [indexes] = await db.query(
    "SHOW INDEX FROM solicitacao WHERE Key_name='uq_solicitacao_unidade_codigo'"
  );
  if (!indexes.length)
    await db.query(
      'ALTER TABLE solicitacao ADD UNIQUE KEY uq_solicitacao_unidade_codigo(unidade,codigo)'
    );
  await db.execute('INSERT INTO conexo_migrations(id) VALUES(?)', [
    '003-pedidos'
  ]);
}
