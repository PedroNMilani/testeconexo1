import mysql from 'mysql2/promise';
import { migrateOrders } from '../src/order-migrations.js';
import { MongoClient } from 'mongodb';
import { readFile } from 'node:fs/promises';
import { loadConfig } from '../src/config.js';
const config = loadConfig(),
  db = await mysql.createConnection({
    ...config.mysql,
    database: undefined,
    multipleStatements: true
  });
const schema = config.mysql.database;
try {
  await db.query(
    `CREATE DATABASE IF NOT EXISTS \`${schema}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`
  );
  await db.changeUser({ database: schema });
  const [rows] = await db.query('SHOW TABLES');
  const names = new Set(rows.map((row) => Object.values(row)[0]));
  const base = [
    'aacd',
    'parceiro',
    'solicitacao',
    'solicitacao_material',
    'solicitacao_bico',
    'pedido'
  ];
  const present = base.filter((name) => names.has(name));
  if (present.length && present.length !== base.length)
    throw new Error(
      'Base parcial: revise o schema antes de continuar. Nenhum DROP será executado.'
    );
  if (!present.length) {
    const sql = await readFile(
      new URL('../db/001-base.sql', import.meta.url),
      'utf8'
    );
    // Preserva o DDL de referência; schema é o configurado, sem executar o bloco DROP comentado.
    const filtered = sql
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('--'))
      .join('\n')
      .replace(/CREATE DATABASE[\s\S]*?;/, '')
      .replace(/USE conexo;/, '');
    await db.query(filtered);
  }
  await db.query(
    'CREATE TABLE IF NOT EXISTS conexo_migrations(id VARCHAR(80) PRIMARY KEY,aplicada_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)'
  );
  const [[migration]] = await db.execute(
    'SELECT COUNT(*) AS n FROM conexo_migrations WHERE id=?',
    ['002-auth']
  );
  if (!Number(migration.n)) {
    const [columns] = await db.query(
      "SHOW COLUMNS FROM aacd LIKE 'nome_titular'"
    );
    let migrationSql = await readFile(
      new URL('../db/002-auth.sql', import.meta.url),
      'utf8'
    );
    if (columns.length)
      migrationSql = migrationSql.replace(
        'ALTER TABLE aacd ADD COLUMN nome_titular VARCHAR(150) NULL;',
        ''
      );
    await db.query(migrationSql);
    await db.execute('INSERT INTO conexo_migrations(id) VALUES(?)', [
      '002-auth'
    ]);
  }
  await migrateOrders(db);
  console.log('MySQL preparado sem apagar registros existentes.');
} finally {
  await db.end();
}
const mongo = new MongoClient(config.mongoUri);
try {
  await mongo.connect();
  const database = mongo.db(config.mongoDatabase);
  const validator = JSON.parse(
    await readFile(
      new URL('../db/impressoras-validator.json', import.meta.url),
      'utf8'
    )
  );
  if (!(await database.listCollections({ name: 'impressoras' }).hasNext()))
    await database.createCollection('impressoras', {
      validator,
      validationLevel: 'strict',
      validationAction: 'error'
    });
  // Não substitui automaticamente o validator de uma coleção já existente.
  const collection = database.collection('impressoras');
  await collection.createIndex({ id_parceiro: 1 });
  await collection.createIndex({ ativa: 1, materiais_compativeis: 1 });
  console.log('MongoDB preparado.');
} finally {
  await mongo.close();
}
