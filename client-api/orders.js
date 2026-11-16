import { api, sessionUser, sessionKey } from '../auth-client.js';
import { ORDER_STATUS } from '../order-status.js';
import { orderView, requestBody } from './views.js';

export async function listOrders() {
  if (!sessionUser?.homologado) return [];
  const actor = sessionKey();
  const result = await api('/pedidos');
  return actor === sessionKey() ? result.items.map(orderView) : [];
}

export async function getOrder(id) {
  return orderView(await api('/pedidos/' + encodeURIComponent(id)));
}

export async function createOrder(record) {
  const created = await api('/pedidos', {
    method: 'POST',
    body: { request: requestBody(record), selection: record.selection }
  });
  return getOrder(created.id);
}

export async function listHistory() {
  return sessionUser?.perfil === 'parceiro'
    ? (await listOrders()).filter((o) =>
        [
          ORDER_STATUS.FINISHED,
          ORDER_STATUS.CANCELLED,
          ORDER_STATUS.REFUSED
        ].includes(o.status)
      )
    : [];
}

export async function listMatches(draft) {
  if (!draft || sessionUser?.perfil !== 'aacd' || !sessionUser.homologado)
    return [];
  const { items } = draft.requestId
    ? await api(
        '/solicitacoes/' +
          encodeURIComponent(draft.requestId) +
          '/recomendacoes'
      )
    : await api('/recomendacoes', {
        method: 'POST',
        body: requestBody(draft)
      });
  return items.map((m, i) => ({
    ...m,
    id: String(i),
    recommended: i === 0,
    description: m.printerName,
    icon: 'assets/aacd-4631c.svg',
    score: String(m.distanceKm) + ' km',
    scoreIcon: 'assets/aacd-8da20.svg',
    scoreLabel: 'Distância em linha reta',
    scoreNote: 'Origem: unidade AACD',
    materialLabel: m.material + ' • bico ' + m.nozzle + ' mm',
    supplyLabel: m.needsMaterial
      ? 'AACD fornece material'
      : 'Material disponível',
    note: m.needsMaterial
      ? 'A AACD deverá fornecer o material escolhido.'
      : 'O parceiro dispõe do material escolhido.'
  }));
}

export async function generateRequestCode(material) {
  return api('/solicitacoes/codigos', { method: 'POST', body: { material } });
}

// Cada ação fica explícita; todas usam o mesmo endpoint de transição.
async function changeOrderStatus(id, action) {
  await api('/pedidos/' + encodeURIComponent(id) + '/acoes/' + action, {
    method: 'POST'
  });
  return getOrder(id);
}
export async function acceptOrder(id) {
  return changeOrderStatus(id, 'aceitar');
}
export async function finishOrder(id) {
  return changeOrderStatus(id, 'finalizar');
}
export async function refuseOrder(id) {
  return changeOrderStatus(id, 'recusar');
}
export async function cancelOrder(id) {
  return api('/pedidos/' + encodeURIComponent(id) + '/acoes/cancelar', {
    method: 'POST'
  });
}
export async function listRequests() {
  return sessionUser?.perfil === 'aacd' && sessionUser.homologado
    ? (await api('/solicitacoes')).items
    : [];
}
export async function getRequest(id) {
  return api('/solicitacoes/' + encodeURIComponent(id));
}
