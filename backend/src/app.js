import { createProfileService } from './profiles.js';
import express from 'express';
import session from 'express-session';
import MySQLStoreFactory from 'express-mysql-session';
import { rateLimit } from 'express-rate-limit';
import { timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createAuthService } from './auth-service.js';
import { createRepository, publicUser } from './repository.js';
import { HttpError, check } from './errors.js';
import { createOrderService } from './orders.js';
import { createRequestService } from './requests.js';
import { createRecommendationService } from './recommendations.js';
import { registerOrderRoutes } from './routes/orders.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerPartnerRoutes } from './routes/partners.js';
import { registerPrinterRoutes } from './routes/printers.js';
import { generateCode } from './code-service.js';
import { UFS } from './geo.js';
import { MATERIALS } from './material-catalog.js';
const frontendRoot = fileURLToPath(new URL('../../frontend/', import.meta.url));
export function createApp({ pool, config, geo, printers, sessionStore }) {
  const app = express(),
    repo = createRepository(pool),
    auth = createAuthService(repo, config, geo),
    profiles = createProfileService(repo, geo),
    requests = createRequestService({ pool, config }),
    recommendations = createRecommendationService({
      pool,
      printers,
      config,
      requests
    }),
    orders = createOrderService({ pool, printers, config, requests });
  const Store = MySQLStoreFactory(session);
  const store =
    sessionStore ||
    new Store(
      {
        createDatabaseTable: true,
        endConnectionOnClose: false,
        clearExpired: true,
        checkExpirationInterval: 60_000
      },
      pool
    );
  app.locals.sessionStore = store;
  app.disable('x-powered-by');
  if (config.production) app.set('trust proxy', 'loopback'); // Somente proxy HTTPS local; servidor escuta em loopback.
  app.use(express.json({ limit: '24kb' }));
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    next();
  });
  app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  const cookie = {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.production,
    maxAge: 8 * 60 * 60 * 1000
  };
  app.use(
    '/api',
    session({
      name: 'conexo.sid',
      secret: config.secret,
      store,
      resave: false,
      saveUninitialized: false,
      cookie
    })
  );
  app.get('/api/health', async (req, res) => {
    await pool.query('SELECT 1');
    res.json({ application: 'conexo', status: 'ok' });
  });
  app.get('/api/catalogos', (req, res) =>
    res.json({ ufs: UFS, unidades: config.units, materiais: MATERIALS })
  );
  app.use('/api', (req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    const candidate = req.get('x-csrf-token'),
      expected = req.session.csrf;
    const supplied =
        typeof candidate === 'string' ? Buffer.from(candidate) : null,
      stored = typeof expected === 'string' ? Buffer.from(expected) : null;
    if (
      !supplied ||
      !stored ||
      supplied.length !== stored.length ||
      !timingSafeEqual(supplied, stored)
    )
      return next(
        new HttpError(
          403,
          'Atualize a página e tente novamente.',
          'CSRF_INVALID'
        )
      );
    next();
  });
  const geoLimiter = rateLimit({
    windowMs: 60_000,
    limit: 12,
    standardHeaders: 'draft-7',
    legacyHeaders: false
  });
  async function signed(req, res, next) {
    const row = await repo.byIdentity(req.session.identity);
    if (!row)
      throw new HttpError(401, 'Entre na sua conta.', 'UNAUTHENTICATED');
    req.user = publicUser(row);
    next();
  }
  const approvedAACD = (req, res, next) => {
    check(
      req.user.perfil === 'aacd' && req.user.homologado,
      'Acesso reservado à equipe AACD homologada.',
      403,
      'NOT_AUTHORIZED'
    );
    next();
  };
  const partner = (req, res, next) => {
    check(
      req.user.perfil === 'parceiro',
      'Acesso reservado ao parceiro.',
      403,
      'NOT_AUTHORIZED'
    );
    next();
  };
  registerAuthRoutes(app, { auth, signed, config });
  registerPartnerRoutes(app, { pool, printers, signed, approvedAACD });
  registerPrinterRoutes(app, { pool, printers, signed, partner });

  app.post('/api/localizacoes/geocodificar', geoLimiter, async (req, res) =>
    res.json(await geo.geocode(req.body || {}))
  );
  app.patch('/api/me', signed, async (req, res) =>
    res.json({ user: await profiles.update(req.user, req.body || {}) })
  );
  app.post(
    '/api/solicitacoes/codigos',
    signed,
    approvedAACD,
    async (req, res) =>
      res
        .status(201)
        .json(await generateCode(pool, req.user, req.body?.material))
  );
  registerOrderRoutes(app, {
    signed,
    approvedAACD,
    requests,
    recommendations,
    orders
  });
  app.use('/api', (req, res) =>
    res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'Recurso não disponível.' }
    })
  );
  app.use(express.static(frontendRoot, { dotfiles: 'deny' }));
  app.use((req, res) => res.sendStatus(404));
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    const status = error.status || (error.code === 'ER_DUP_ENTRY' ? 409 : 500);
    const message =
      status < 500
        ? error.message
        : 'Não foi possível concluir a operação. Tente novamente.';
    res
      .status(status)
      .json({ error: { code: error.code || 'SERVER_ERROR', message } });
  });
  return app;
}
