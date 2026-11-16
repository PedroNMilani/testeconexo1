import { api, sessionUser } from '../auth-client.js';
import { printerView } from './views.js';

export async function listPrinters() {
  return sessionUser?.perfil === 'parceiro'
    ? (await api('/impressoras')).items.map(printerView)
    : [];
}

export async function getPrinter(id) {
  return printerView(await api('/impressoras/' + encodeURIComponent(id)));
}

export async function savePrinter(record) {
  return printerView(
    await api(
      '/impressoras' + (record.id ? '/' + encodeURIComponent(record.id) : ''),
      {
        method: record.id ? 'PATCH' : 'POST',
        body: {
          modelo: record.name,
          capacidade: {
            x: Number(record.volumes.X),
            y: Number(record.volumes.Y),
            z: Number(record.volumes.Z)
          },
          bicos: record.nozzles.map(Number),
          materiais_compativeis: record.materials,
          materiais_disponiveis: record.materialsAvailable || []
        }
      }
    )
  );
}

export async function removePrinter(id) {
  return printerView(
    await api('/impressoras/' + encodeURIComponent(id), { method: 'DELETE' })
  );
}
