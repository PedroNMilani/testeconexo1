export function loadConfig(env = process.env) {
  const secret = env.SESSION_SECRET || '';
  if (secret.length < 32 || secret.startsWith('troque-')) throw new Error('Configure SESSION_SECRET com uma chave aleatória de pelo menos 32 caracteres.');
  const database = env.MYSQL_DATABASE || 'conexo';
  if (!/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/.test(database)) throw new Error('MYSQL_DATABASE inválido.');
  return {
    port: Number(env.PORT || 3000), production: env.NODE_ENV === 'production', secret,
    mysql: { host: env.MYSQL_HOST || '127.0.0.1', port: Number(env.MYSQL_PORT || 3306),
      user: env.MYSQL_USER || 'conexo_app', password: env.MYSQL_PASSWORD || '', database,
      timezone: 'Z', decimalNumbers: true, supportBigNumbers: true, bigNumberStrings: true,
      waitForConnections: true, connectionLimit: 10 },
    mongoUri: env.MONGO_URI || 'mongodb://127.0.0.1:27017', mongoDatabase: env.MONGO_DATABASE || 'conexo',
    units: (env.AACD_UNITS || 'Ibirapuera,Mooca,Osasco,Mogi das Cruzes,Recife,Porto Alegre,Uberlândia').split(',').map(x => x.trim()).filter(Boolean),
    userAgent: env.NOMINATIM_USER_AGENT || '', bcryptCost: 12
  };
}
