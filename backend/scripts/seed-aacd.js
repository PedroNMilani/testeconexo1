import { createPool } from '../src/db.js';
import { loadConfig } from '../src/config.js';
import { createRepository } from '../src/repository.js';
import { createAuthService } from '../src/auth-service.js';
import { createGeoService } from '../src/geo.js';
const config = loadConfig(),
  pool = createPool(config.mysql);
try {
  await createAuthService(
    createRepository(pool),
    config,
    createGeoService()
  ).register(
    'aacd',
    {
      email: process.env.SEED_AACD_EMAIL,
      password: process.env.SEED_AACD_PASSWORD,
      phone: process.env.SEED_AACD_PHONE,
      unit: process.env.SEED_AACD_UNIT,
      holder: process.env.SEED_AACD_NAME
    },
    { seed: true }
  );
  console.log(
    'Primeira conta AACD criada e homologada; senha armazenada em bcrypt.'
  );
} catch (error) {
  console.error(
    'Seed não concluído:',
    error.status ? error.message : 'confira as variáveis e a conexão ao MySQL.'
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}
