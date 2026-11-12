import { readFileSync } from 'node:fs';
import { setTimeout } from 'node:timers/promises';
import { booleanPointInPolygon } from '@turf/boolean-point-in-polygon';
import { check, HttpError } from './errors.js';
const states = JSON.parse(
  readFileSync(
    new URL('../data/brasil-estados.geojson', import.meta.url),
    'utf8'
  )
).features;
export const UFS = Object.freeze(
  states
    .map((feature) => ({
      uf: feature.properties.sigla,
      nome: feature.properties.name
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
);
export function insideBrazil(latitude, longitude) {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180 &&
    states.some((feature) =>
      booleanPointInPolygon([longitude, latitude], feature)
    )
  );
}
export function createGeoService({
  userAgent,
  request = fetch,
  intervalMs = 1000,
  timeoutMs = 5000
} = {}) {
  let queue = Promise.resolve(),
    lastStart = 0;
  const cache = new Map();
  async function search(params) {
    const key = JSON.stringify(params),
      cached = cache.get(key);
    if (cached && cached.until > Date.now()) return cached.value;
    const operation = queue
      .catch(() => {})
      .then(async () => {
        await setTimeout(Math.max(0, intervalMs - (Date.now() - lastStart)));
        lastStart = Date.now();
        const url = new URL('https://nominatim.openstreetmap.org/search');
        for (const [key, value] of Object.entries({
          ...params,
          country: 'Brasil',
          countrycodes: 'br',
          format: 'jsonv2',
          limit: '1'
        }))
          url.searchParams.set(key, value);
        try {
          const response = await request(url, {
            headers: { 'User-Agent': userAgent, Accept: 'application/json' },
            signal: AbortSignal.timeout(timeoutMs)
          });
          if (!response.ok) throw new Error('Falha do provedor');
          const values = await response.json();
          if (!Array.isArray(values)) throw new Error('Resposta inválida');
          const item = values[0];
          const point = item
            ? { latitude: Number(item.lat), longitude: Number(item.lon) }
            : null;
          if (point && !insideBrazil(point.latitude, point.longitude)) {
            throw new Error('Coordenadas inválidas');
          }
          const result = point;
          if (cache.size >= 1000) cache.delete(cache.keys().next().value);
          cache.set(key, {
            value: result,
            until: Date.now() + 24 * 60 * 60 * 1000
          });
          return result;
        } catch {
          throw new HttpError(
            503,
            'Não foi possível consultar o endereço. Tente novamente.',
            'GEOCODING_UNAVAILABLE'
          );
        }
      });
    queue = operation.then(
      () => {},
      () => {}
    );
    return operation;
  }
  function validateConfirmed(body) {
    check(
      UFS.some((item) => item.uf === body.state),
      'Selecione uma UF válida.'
    );
    check(
      body.locationConfirmed === true,
      'Confirme o pino da instituição no mapa.'
    );
    check(
      typeof body.latitude === 'number' &&
        typeof body.longitude === 'number' &&
        insideBrazil(body.latitude, body.longitude),
      'A localização confirmada deve estar dentro do Brasil.'
    );
  }
  async function geocode(body) {
    check(
      UFS.some((item) => item.uf === body.state),
      'Selecione uma UF válida.'
    );
    check(
      typeof body.city === 'string' &&
        body.city.trim() &&
        body.city.length <= 100,
      'Informe a cidade.'
    );
    check(
      typeof body.street === 'string' &&
        body.street.trim() &&
        body.street.length <= 150,
      'Informe a rua.'
    );
    const state = UFS.find((item) => item.uf === body.state).nome;
    // Nunca enviamos número, responsável, email ou outros campos ao provedor.
    check(
      userAgent && !userAgent.includes('seu-email'),
      'A busca de endereço não está configurada.',
      503,
      'GEOCODING_NOT_CONFIGURED'
    );
    const point = await search({
      street: body.street.trim(),
      city: body.city.trim(),
      state
    });
    if (point) return { ...point, nivel: 'rua' };
    const city = await search({ city: body.city.trim(), state });
    if (city) return { ...city, nivel: 'cidade' };
    throw new HttpError(
      404,
      'Endereço não encontrado. Confira a rua, a cidade e a UF e tente novamente.',
      'GEOCODING_NOT_FOUND'
    );
  }
  return { validateConfirmed, geocode };
}
