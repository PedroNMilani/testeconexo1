import {
  api,
  sessionUser,
  profileFromUser,
  saveProfileToApi
} from '../auth-client.js';
export async function getCurrentUser() {
  return sessionUser ? { ...sessionUser, role: sessionUser.perfil } : null;
}
export async function getProfile(area) {
  const canRead =
    (area === 'aacd' && sessionUser?.perfil === 'aacd') ||
    (area === 'partner' && sessionUser?.perfil === 'parceiro');
  if (!canRead) return null;
  return profileFromUser(area, (await api('/auth/me')).user);
}
export async function saveProfile(area, record) {
  return saveProfileToApi(area, record, record._location);
}
