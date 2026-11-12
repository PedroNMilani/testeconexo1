import { createPool } from './db.js';
import { MongoClient } from 'mongodb';
import { loadConfig } from './config.js';
import { createGeoService } from './geo.js';
import { createPrinterService } from './printers.js';
import { createApp } from './app.js';
const config = loadConfig(),
  pool = createPool(config.mysql),
  mongo = new MongoClient(config.mongoUri);
try {
  await pool.query('SELECT 1');
  await mongo.connect();
  const app = createApp({
    pool,
    config,
    geo: createGeoService({ userAgent: config.userAgent }),
    printers: createPrinterService(
      mongo.db(config.mongoDatabase).collection('impressoras')
    )
  });
  await app.locals.sessionStore.onReady();
  const server = app.listen(config.port, '127.0.0.1', () =>
    console.log(`CoNexo: http://localhost:${config.port}`)
  );
  async function shutdown() {
    server.close(async () => {
      await app.locals.sessionStore.close();
      await mongo.close();
      await pool.end();
      process.exit(0);
    });
  }
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
} catch (error) {
  console.error(
    'Não foi possível iniciar o CoNexo. Confira os bancos e as variáveis de ambiente. Código:',
    error.code || error.name
  );
  await mongo.close();
  await pool.end();
  process.exitCode = 1;
}
