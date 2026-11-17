import { randomBytes } from 'node:crypto';
import { rateLimit } from 'express-rate-limit';
import { check } from '../errors.js';

const token = () => randomBytes(32).toString('hex');

// Cadastro, entrada, saída e consulta da sessão.
export function registerAuthRoutes(app, { auth, signed, config }) {
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
  app.get('/api/auth/csrf', (req, res) => {
    req.session.csrf ||= token();
    res.json({ csrfToken: req.session.csrf });
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
    let role;
    if (req.params.role === 'parceiros') role = 'parceiro';
    else if (req.params.role === 'aacd') role = 'aacd';
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
}
