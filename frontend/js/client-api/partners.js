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

export async function approvePartner(id) {
  return api('/parceiros/' + encodeURIComponent(id) + '/homologacao', {
    method: 'POST'
  });
}
