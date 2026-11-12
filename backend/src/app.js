import express from 'express';
import session from 'express-session';
import MySQLStoreFactory from 'express-mysql-session';
import { rateLimit } from 'express-rate-limit';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createAuthService, email, phone, string } from './auth-service.js';
import { createRepository, publicUser } from './repository.js';
import { HttpError, check } from './errors.js';
import { generateCode } from './code-service.js';
import { UFS } from './geo.js';
import { MATERIALS } from '../../material-catalog.js';
const root = fileURLToPath(new URL('../../', import.meta.url));
const token = () => randomBytes(32).toString('hex');
export function createApp({ pool, config, geo, printers, sessionStore }) {
  const app = express(),
    repo = createRepository(pool),
    auth = createAuthService(repo, config, geo);
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
  app.get('/api/auth/csrf', (req, res) => {
    req.session.csrf ||= token();
    res.json({ csrfToken: req.session.csrf });
  });
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
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 40,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: {
      error: {
        code: 'RATE_LIMIT',
        message: 'Muitas tentativas. Aguarde antes de tentar novamente.'
      }
    }
  });
  const geoLimiter = rateLimit({
    windowMs: 60_000,
    limit: 12,
    standardHeaders: 'draft-7',
    legacyHeaders: false
  });
  const regenerate = (req) =>
    new Promise((resolve, reject) =>
      req.session.regenerate((error) => (error ? reject(error) : resolve()))
    );
  const saveSession = (req) =>
    new Promise((resolve, reject) =>
      req.session.save((error) => (error ? reject(error) : resolve()))
    );
  app.post('/api/auth/cadastros/:role', authLimiter, async (req, res) => {
    const role =
      req.params.role === 'parceiros'
        ? 'parceiro'
        : req.params.role === 'aacd'
          ? 'aacd'
          : null;
    check(role, 'Cadastro não encontrado.', 404);
    const user = await auth.register(role, req.body || {});
    res.status(201).json({ user });
  });
  app.post('/api/auth/login', authLimiter, async (req, res) => {
    const user = await auth.login(req.body || {});
    await regenerate(req);
    req.session.identity = { id: user.id, perfil: user.perfil };
    req.session.csrf = token();
    await saveSession(req);
    res.json({ user, csrfToken: req.session.csrf });
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
  app.get('/api/auth/me', signed, (req, res) => res.json({ user: req.user }));
  app.post('/api/auth/logout', (req, res, next) => {
    req.session.destroy((error) => {
      if (error) return next(error);
      res.clearCookie('conexo.sid', {
        httpOnly: true,
        sameSite: 'lax',
        secure: config.production
      });
      res.sendStatus(204);
    });
  });
  app.post('/api/localizacoes/geocodificar', geoLimiter, async (req, res) =>
    res.json(await geo.geocode(req.body || {}))
  );
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
  app.patch('/api/me', signed, async (req, res) => {
    check(
      req.user.perfil !== 'aacd' || req.user.homologado,
      'Aguarde a homologação da conta AACD.',
      403
    );
    const body = req.body || {},
      normalized = email(body.email),
      telephone = phone(body.phone);
    check(
      !['homologado', 'perfil', 'id', 'senha_hash'].some((key) => key in body),
      'Campos de perfil não permitidos.'
    );
    let values;
    if (req.user.perfil === 'aacd') {
      check(
        body.unit === req.user.unidade,
        'A unidade não pode ser alterada pela própria conta. Solicite a correção à equipe AACD.',
        409
      );
      values = { name: string(body.holder, 'o nome do titular') };
    } else {
      geo.validateConfirmed(body);
      values = {
        name: string(body.institution, 'a instituição'),
        responsible: string(body.responsible, 'o responsável', 100),
        street: string(body.street, 'a rua'),
        number: typeof body.number === 'string' ? body.number.trim() : '',
        city: string(body.city, 'a cidade', 100)
      };
      check(values.number.length <= 10, 'Número de endereço muito longo.');
    }
    const user = await repo.withEmailLock(normalized, async (db) => {
      const matches = await repo.byEmail(normalized, db);
      check(
        matches.every(
          (row) =>
            String(row.id) === req.user.id && row.perfil === req.user.perfil
        ),
        'Este email já está cadastrado.',
        409
      );
      if (req.user.perfil === 'aacd')
        await db.execute(
          'UPDATE aacd SET email=?,telefone=?,nome_titular=? WHERE id=?',
          [normalized, telephone, values.name, req.user.id]
        );
      else
        await db.execute(
          'UPDATE parceiro SET email=?,telefone=?,nome_instituicao=?,responsavel=?,rua=?,numero=?,cidade=?,uf=?,latitude=?,longitude=? WHERE id=?',
          [
            normalized,
            telephone,
            values.name,
            values.responsible,
            values.street,
            values.number || null,
            values.city,
            body.state,
            body.latitude,
            body.longitude,
            req.user.id
          ]
        );
      return publicUser(
        await repo.byIdentity({ id: req.user.id, perfil: req.user.perfil }, db)
      );
    });
    res.json({ user });
  });
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
  app.post(
    '/api/solicitacoes/codigos',
    signed,
    approvedAACD,
    async (req, res) =>
      res
        .status(201)
        .json(await generateCode(pool, req.user, req.body?.material))
  );
  app.get('/api/impressoras', signed, partner, async (req, res) =>
    res.json({ items: await printers.list(req.user) })
  );
  app.post('/api/impressoras', signed, partner, async (req, res) =>
    res.status(201).json(await printers.save(req.user, req.body || {}))
  );
  app.get('/api/impressoras/:id', signed, partner, async (req, res) =>
    res.json(await printers.get(req.user, req.params.id))
  );
  app.patch('/api/impressoras/:id', signed, partner, async (req, res) =>
    res.json(await printers.save(req.user, req.body || {}, req.params.id))
  );
  app.delete('/api/impressoras/:id', signed, partner, async (req, res) =>
    res.json(await printers.remove(req.user, req.params.id))
  );
  app.use('/api', (req, res) =>
    res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'Recurso não disponível.' }
    })
  );
  app.get('/runtime-config.js', (req, res) => {
    res.type('application/javascript');
    res.setHeader('Cache-Control', 'no-store');
    res.send('globalThis.CONEXO_CONFIG=Object.freeze({backend:true});');
  });
  app.get('/', (req, res) => res.sendFile(path.join(root, 'index.html')));
  app.use(
    '/assets',
    express.static(path.join(root, 'assets'), { dotfiles: 'deny' })
  );
  app.use(
    '/vendor',
    express.static(path.join(root, 'vendor'), { dotfiles: 'deny' })
  );
  const files = new Set([
    'index.html',
    'styles.css',
    'app.js',
    'router.js',
    'partner.js',
    'aacd.js',
    'shared-ui.js',
    'data.js',
    'mock-data.js',
    'memory-source.js',
    'order-status.js',
    'auth-client.js',
    'location-ui.js',
    'material-catalog.js',
    'runtime-config.js'
  ]);
  app.get('/:file', (req, res, next) =>
    files.has(req.params.file)
      ? res.sendFile(path.join(root, req.params.file))
      : next()
  );
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
