import { api, backendEnabled } from './auth-client.js';
const maps = new Map();
export function mountLocation(id, fields, initial) {
  const container = document.getElementById(id);
  if (!container) return;
  container.hidden = false;
  if (maps.has(id)) return;
  const canvas = container.querySelector('[data-map]'),
    confirmation = container.querySelector('[data-confirm-location]'),
    feedback = container.querySelector('[data-location-feedback]');
  const geocodeButton = container.querySelector('[data-geocode]');
  if (!globalThis.L) {
    feedback.textContent =
      'Não foi possível carregar o mapa. Atualize a página e confira os arquivos do Leaflet.';
    geocodeButton.disabled = true;
    confirmation.disabled = true;
    return;
  }
  if (!backendEnabled) {
    geocodeButton.disabled = true;
    geocodeButton.textContent = 'Busca por endereço (requer backend)';
    feedback.textContent =
      'Inicie o backend para buscar o endereço e confirmar a localização no mapa.';
  }
  let point = initial
    ? { latitude: initial.latitude, longitude: initial.longitude }
    : null;
  let ready = Boolean(initial),
    confirmed = Boolean(initial),
    revision = 0;
  confirmation.disabled = !ready;
  const map = L.map(canvas).setView(
    initial ? [point.latitude, point.longitude] : [-14.2, -51.9],
    initial ? 15 : 4
  );
  const imageStatus = document.createElement('p');
  imageStatus.setAttribute('role', 'status');
  imageStatus.dataset.mapLoadStatus = '';
  canvas.after(imageStatus);
  // OSM exige Referer válido. Envia só a origem nas imagens, mesmo com a política same-origin do backend.
  const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    referrerPolicy: 'strict-origin-when-cross-origin',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  });
  tiles.on('tileerror', () => {
    imageStatus.textContent =
      'Não foi possível carregar as imagens do mapa. Verifique a conexão com a internet.';
  });
  tiles.on('tileload', () => {
    imageStatus.textContent = '';
  });
  tiles.addTo(map);
  const marker = L.marker(
    initial ? [point.latitude, point.longitude] : [-14.2, -51.9],
    {
      draggable: true,
      keyboard: true,
      title: 'Local da instituição; arraste ou use as setas para ajustar'
    }
  ).addTo(map);
  const status = () => {
    const p = marker.getLatLng();
    point = { latitude: p.lat, longitude: p.lng };
    feedback.textContent = `Pino: ${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}. Confirme se corresponde à instituição.`;
  };
  const moved = () => {
    if (!ready) {
      feedback.textContent =
        'Clique em “Localizar endereço” antes de ajustar e confirmar o pino.';
      return;
    }
    revision++;
    confirmed = false;
    confirmation.checked = false;
    status();
  };
  marker.on('dragend', moved);
  marker.getElement().addEventListener('keydown', (event) => {
    const changes = {
      ArrowUp: [0.0001, 0],
      ArrowDown: [-0.0001, 0],
      ArrowLeft: [0, -0.0001],
      ArrowRight: [0, 0.0001]
    };
    if (!changes[event.key]) return;
    event.preventDefault();
    event.stopPropagation();
    const p = marker.getLatLng(),
      [lat, lon] = changes[event.key];
    marker.setLatLng([p.lat + lat, p.lng + lon]);
    moved();
  });
  map.on('click', (event) => {
    marker.setLatLng(event.latlng);
    moved();
  });
  confirmation.checked = confirmed;
  confirmation.addEventListener('change', () => {
    confirmed = ready && confirmation.checked;
    if (!ready) {
      confirmation.checked = false;
      feedback.textContent =
        'Localize o endereço antes de confirmar o pino.';
    }
  });
  for (const selector of [
    fields.street,
    fields.city,
    fields.state,
    fields.number
  ].filter(Boolean))
    document.querySelector(selector).addEventListener('input', () => {
      revision++;
      confirmed = false;
      ready = false;
      confirmation.checked = false;
      confirmation.disabled = true;
    });
  container
    .querySelector('[data-geocode]')
    .addEventListener('click', async (event) => {
      if (!backendEnabled) return;
      const button = event.currentTarget;
      button.disabled = true;
      const requestRevision = ++revision;
      confirmed = false;
      ready = false;
      confirmation.checked = false;
      confirmation.disabled = true;
      feedback.textContent = 'Localizando endereço…';
      try {
        const result = await api('/localizacoes/geocodificar', {
          method: 'POST',
          body: {
            street: document.querySelector(fields.street).value,
            city: document.querySelector(fields.city).value,
            state: document.querySelector(fields.state).value
          }
        });
        if (requestRevision !== revision) return;
        marker.setLatLng([result.latitude, result.longitude]);
        map.setView(
          marker.getLatLng(),
          result.nivel === 'rua' ? 16 : result.nivel === 'cidade' ? 12 : 6
        );
        ready = true;
        confirmed = false;
        confirmation.checked = false;
        confirmation.disabled = false;
        status();
        if (result.nivel !== 'rua')
          feedback.textContent =
            'Não foi possível localizar a rua. O pino é aproximado: ajuste para o local da instituição e confirme.';
      } catch (error) {
        feedback.textContent = error.message;
      } finally {
        button.disabled = false;
      }
    });
  maps.set(id, {
    get: () => ({
      latitude: point?.latitude,
      longitude: point?.longitude,
      locationConfirmed: confirmed
    }),
    resize: () => map.invalidateSize(),
    reset: (value) => {
      revision++;
      point = value
        ? { latitude: value.latitude, longitude: value.longitude }
        : null;
      ready = confirmed = Boolean(value);
      confirmation.checked = confirmed;
      confirmation.disabled = !ready;
      marker.setLatLng(
        value ? [point.latitude, point.longitude] : [-14.2, -51.9]
      );
      map.setView(marker.getLatLng(), value ? 15 : 4);
      feedback.textContent = '';
    }
  });
  const resize = () => {
    if (canvas.clientWidth && canvas.clientHeight) map.invalidateSize();
  };
  document.addEventListener('conexo:navigate', () => {
    if (!container.closest('[data-page]').hidden) requestAnimationFrame(resize);
  });
  if (globalThis.ResizeObserver) {
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
  }
}
export function locationValue(id) {
  return maps.get(id)?.get() || {};
}

export function resetLocation(id, initial) {
  maps.get(id)?.reset(initial);
}
