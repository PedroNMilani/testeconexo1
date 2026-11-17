import { check } from './errors.js';

export function string(value, name, max = 150) {
  check(
    typeof value === 'string' &&
      value.trim().length > 0 &&
      value.trim().length <= max,
    `Informe ${name}.`
  );
  return value.trim();
}
export function email(value) {
  const normalized = string(value, 'um email válido', 254).toLowerCase();
  check(
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized),
    'Informe um email válido.'
  );
  return normalized;
}
export function phone(value) {
  const normalized = string(value, 'um telefone válido', 30).replace(
    /[\s()-]/g,
    ''
  );
  check(/^\+?[0-9]{10,15}$/.test(normalized), 'Informe um telefone com DDD.');
  return normalized;
}
export function password(value) {
  check(
    typeof value === 'string' &&
      value.length >= 8 &&
      Buffer.byteLength(value, 'utf8') <= 72,
    'A senha deve ter ao menos 8 caracteres e no máximo 72 bytes UTF-8.'
  );
  return value;
}
