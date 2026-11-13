export const backendEnabled = globalThis.CONEXO_CONFIG?.backend === true;
export let sessionUser = null;
let csrf = null;
let csrfRequest = null;
async function csrfToken() {
  if (csrf) return csrf;
  csrfRequest ||= fetch('/api/auth/csrf', {
    credentials: 'same-origin',
    signal: AbortSignal.timeout(20000)
  })
    .then(async (response) => {
      if (!response.ok)
        throw new Error('Não foi possível iniciar uma sessão segura.');
      return (await response.json()).csrfToken;
    })
    .finally(() => {
      csrfRequest = null;
    });
  csrf = await csrfRequest;
  return csrf;
}
export async function api(path, { method = 'GET', body } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (!['GET', 'HEAD'].includes(method))
    headers['X-CSRF-Token'] = await csrfToken();
  const response = await fetch('/api' + path, {
    method,
    headers,
    credentials: 'same-origin',
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(25000)
  });
  const result = response.status === 204 ? null : await response.json();
  if (!response.ok) {
    const error = new Error(
      result?.error?.message || 'Não foi possível concluir a operação.'
    );
    error.status = response.status;
    error.code = result?.error?.code;
    throw error;
  }
  if (result?.csrfToken) csrf = result.csrfToken;
  return result;
}
function changed() {
  document.dispatchEvent(
    new CustomEvent('conexo:session', { detail: { user: sessionUser } })
  );
}
export async function restoreSession() {
  if (!backendEnabled) return null;
  try {
    sessionUser = (await api('/auth/me')).user;
  } catch (error) {
    if (error.status !== 401) throw error;
    sessionUser = null;
  }
  changed();
  return sessionUser;
}
export async function login(credentials) {
  const result = await api('/auth/login', {
    method: 'POST',
    body: credentials
  });
  sessionUser = result.user;
  changed();
  return sessionUser;
}
export async function logout() {
  await api('/auth/logout', { method: 'POST' });
  sessionUser = null;
  csrf = null;
  changed();
}
export function internalDestination(user = sessionUser) {
  return user?.perfil === 'parceiro' ? 'parceiro-inicio' : 'aacd-inicio';
}
export function canOpen(section) {
  if (!backendEnabled) return true;
  if (section.startsWith('aacd-'))
    return sessionUser?.perfil === 'aacd' && sessionUser.homologado;
  if (
    [
      'parceiro-inicio',
      'parceiro-pedidos',
      'parceiro-impressora',
      'parceiro-perfil'
    ].includes(section)
  ) {
    return (
      sessionUser?.perfil === 'parceiro' && sessionUser.homologado === true
    );
  }
  return true;
}
export function renderBackendNotice() {
  const notice = document.getElementById('backend-stage-notice');
  // As funções conectadas não usam mais pedidos de demonstração.
  notice.hidden = true;
}
export function profileFromUser(area, user) {
  if (area === 'aacd')
    return {
      unit: user.unidade,
      'aacd-profile-name': user.nome,
      'aacd-profile-email': user.email,
      'aacd-profile-phone': user.telefone,
      displayNames: [user.nome, user.nome]
    };
  return {
    'profile-institution': user.nome,
    'profile-responsible': user.responsavel,
    'profile-email': user.email,
    'profile-phone': user.telefone,
    'profile-street': user.rua,
    'profile-number': user.numero,
    'profile-city': user.cidade,
    'profile-state': user.uf,
    'profile-district': '',
    displayNames: [user.nome, user.nome, user.nome]
  };
}
export async function saveProfileToApi(area, record, location) {
  if (
    (area === 'aacd' && sessionUser?.perfil !== 'aacd') ||
    (area === 'partner' && sessionUser?.perfil !== 'parceiro')
  )
    throw new Error('Entre na conta correspondente para editar o perfil.');
  const body =
    area === 'aacd'
      ? {
          email: record['aacd-profile-email'],
          phone: record['aacd-profile-phone'],
          holder: record['aacd-profile-name'],
          unit: record.unit
        }
      : {
          email: record['profile-email'],
          phone: record['profile-phone'],
          institution: record['profile-institution'],
          responsible: record['profile-responsible'],
          street: record['profile-street'],
          number: record['profile-number'],
          city: record['profile-city'],
          state: record['profile-state'],
          ...location
        };
  const result = await api('/me', { method: 'PATCH', body });
  sessionUser = result.user;
  changed();
  return profileFromUser(area, sessionUser);
}

export function sessionKey() {
  return sessionUser ? sessionUser.perfil + '/' + sessionUser.id : '';
}
