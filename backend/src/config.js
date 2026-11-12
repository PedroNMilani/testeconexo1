import { UNIT_LOCATIONS } from './units.js';
import { insideBrazil } from './geo.js';
export function loadConfig(env = process.env) {
  const secret = env.SESSION_SECRET || '';
  if (secret.length < 32 || secret.startsWith('troque-'))
    throw new Error(
      'Configure SESSION_SECRET com uma chave aleatória de pelo menos 32 caracteres.'
    );
  const database = env.MYSQL_DATABASE || 'conexo';
  if (!/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/.test(database))
    throw new Error('MYSQL_DATABASE inválido.');
  let unitLocations;
  try {
    unitLocations = JSON.parse(
      env.AACD_UNIT_LOCATIONS || JSON.stringify(UNIT_LOCATIONS)
    );
  } catch {
    throw new Error('AACD_UNIT_LOCATIONS deve ser um objeto JSON válido.');
  }
  if (
    !unitLocations ||
    typeof unitLocations !== 'object' ||
    Array.isArray(unitLocations)
  )
    throw new Error(
      'AACD_UNIT_LOCATIONS deve mapear unidades para latitude e longitude.'
    );
  for (const location of Object.values(unitLocations)) {
    if (!location || !insideBrazil(location.latitude, location.longitude))
      throw new Error('AACD_UNIT_LOCATIONS contém uma coordenada inválida.');
  }
  const medium = Number(env.QUEUE_MEDIUM_WEIGHT ?? 7),
    standard = Number(env.QUEUE_STANDARD_WEIGHT ?? 0);
  if (
    ![medium, standard].every((x) => Number.isFinite(x) && x >= 0 && x <= 365)
  )
    throw new Error('Pesos de fila devem estar entre 0 e 365.');
  return {
    unitLocations,
    queueMediumWeight: medium,
    queueStandardWeight: standard,
    port: Number(env.PORT || 3000),
    production: env.NODE_ENV === 'production',
    secret,
    mysql: {
      host: env.MYSQL_HOST || '127.0.0.1',
      port: Number(env.MYSQL_PORT || 3306),
      user: env.MYSQL_USER || 'conexo_app',
      password: env.MYSQL_PASSWORD || '',
      database,
      timezone: 'Z',
      decimalNumbers: true,
      supportBigNumbers: true,
      bigNumberStrings: true,
      waitForConnections: true,
      connectionLimit: 10
    },
    mongoUri: env.MONGO_URI || 'mongodb://127.0.0.1:27017',
    mongoDatabase: env.MONGO_DATABASE || 'conexo',
    units: (
      env.AACD_UNITS ||
      'Ibirapuera,Mooca,Osasco,Mogi das Cruzes,Recife,Porto Alegre,Uberlândia'
    )
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean),
    userAgent: env.NOMINATIM_USER_AGENT || '',
    bcryptCost: 12
  };
}
