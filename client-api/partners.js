import { api, sessionUser } from '../auth-client.js';
import { candidateView } from './views.js';

export async function listPartners() {
  if (sessionUser?.perfil !== 'aacd' || !sessionUser.homologado) return [];
  return (await api('/parceiros?homologado=true')).items.map((record) => ({
    id: record.id,
    name: record.nome_instituicao,
    location: record.cidade + ' / ' + record.uf,
    statusLabel: 'Homologado',
    statusClass: 'aacd-status finished',
    icon: 'assets/aacd-c1b09.svg',
    fleet: record.impressoras.length + ' Impressoras FDM',
    technicalLabel: 'RESPONSÁVEL',
    technical: record.responsavel,
    materials: [
      ...new Set(
        record.impressoras.flatMap((printer) => printer.materiais_compativeis)
      )
    ]
  }));
}

export async function listReviews() {
  return sessionUser?.perfil === 'aacd' && sessionUser.homologado
    ? (await api('/parceiros?homologado=false')).items.map(candidateView)
    : [];
}

export async function reviewPartner(id, approved) {
  if (!approved)
    throw new Error(
      'Nesta etapa, registre a homologação após a avaliação externa.'
    );
  const records = await listReviews();
  const candidate = records.find((item) => item.id === id);
  await api('/parceiros/' + encodeURIComponent(id) + '/homologacao', {
    method: 'POST',
    body: { homologado: true }
  });
  return candidate;
}

export async function listHomePartners() {
  return (await listReviews()).map((record) => ({
    name: record.name,
    description: record.description,
    icon: 'assets/aacd-c6315.svg',
    approve: true
  }));
}
