// Fixture exclusiva para bancos descartáveis; não cria contas em ambiente real.
import { writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { MongoClient } from 'mongodb';
import { createPool } from '../src/db.js';
import { loadConfig } from '../src/config.js';
import { createAuthService } from '../src/auth-service.js';
import { createRepository } from '../src/repository.js';
import { createGeoService } from '../src/geo.js';
import { createPrinterService } from '../src/printers.js';
const config = loadConfig();
if (
  process.env.NODE_ENV !== 'test' ||
  !config.mysql.database.endsWith('_test') ||
  !config.mongoDatabase.endsWith('_test')
)
  throw new Error('Use somente bancos descartáveis terminados em _test.');
config.bcryptCost = 4;
const pool = createPool(config.mysql),
  auth = createAuthService(createRepository(pool), config, createGeoService()),
  mongo = new MongoClient(config.mongoUri);
try {
  const id = randomUUID(),
    password = 'Teste-' + randomUUID();
  const aacd = await auth.register(
    'aacd',
    {
      email: `browser-aacd-${id}@example.org`,
      password,
      phone: '11988887777',
      unit: config.units[0],
      holder: 'AACD navegador'
    },
    { seed: true }
  );
  const partner = await auth.register('parceiro', {
    email: `browser-parceiro-${id}@example.org`,
    password,
    phone: '11988887777',
    institution: 'Parceiro navegador ' + id,
    responsible: 'Responsável teste',
    street: 'Rua teste',
    city: 'São Paulo',
    state: 'SP',
    latitude: -23.5512,
    longitude: -46.5977,
    locationConfirmed: true,
    termsAccepted: true
  });
  await pool.execute('UPDATE parceiro SET homologado=TRUE WHERE id=?', [
    partner.id
  ]);
  await mongo.connect();
  const printer = await createPrinterService(
    mongo.db(config.mongoDatabase).collection('impressoras')
  ).save(partner, {
    modelo: 'FDM navegador',
    capacidade: { x: 200, y: 200, z: 200 },
    bicos: [0.4],
    materiais_compativeis: ['PLA'],
    materiais_disponiveis: ['PLA']
  });
  const destination =
    process.env.CONEXO_ORDERS_FIXTURE ||
    path.join(tmpdir(), 'conexo-orders-browser-fixture.json');
  await writeFile(
    destination,
    JSON.stringify({ aacd, partner, printer, password, code: 'BROWSER-' + id }),
    { mode: 0o600 }
  );
  console.log('Fixture de teste criada em ' + destination);
} finally {
  await pool.end();
  await mongo.close();
}
