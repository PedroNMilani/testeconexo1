import { sessionUser, sessionKey } from '../auth-client.js';
import * as data from '../data.js';
import { ORDER_STATUS, ORDER_STATUS_UI } from '../order-status.js';
import { instance, text, tail } from '../shared-ui.js';

// A mesma consulta alimenta pedidos pendentes, em produção e o histórico.
export function initPartnerOrders() {
  function renderPartnerOrder(order) {
    const active = order.status === ORDER_STATUS.IN_PRODUCTION;
    const card = instance(
      active ? 'active-order-template' : 'pending-order-template'
    );
    card.dataset.orderId = order.id;
    card.dataset.state = order.status;
    text(card, 'h3', `Pedido ${order.code}`);
    const stateBadge = card.querySelector('.order-status');
    stateBadge.className =
      'order-status ' + ORDER_STATUS_UI[order.status].partnerClass;
    stateBadge.textContent = ORDER_STATUS_UI[order.status].partnerLabel;
    text(
      card,
      '.order-heading p',
      `Solicitado por: ${order.requester || 'AACD'}`
    );
    text(card, '[data-order-device]', order.device);
    text(card, '[data-order-material]', order.material);
    text(card, '[data-order-deadline]', order.deadline);
    if (active) text(card, '[data-order-started]', order.started);
    if (!active) {
      const priority = card.querySelector('.order-status.urgent');
      priority.className = `order-status ${order.priority === 'Urgente' ? 'urgent' : 'standard'}`;
      priority.textContent = order.priority;
    }
    const detail = card.querySelector('.order-extra');
    detail.id = `order-details-${order.id}`;
    tail(detail.querySelector('[data-order-detail-code]'), order.code);
    tail(
      detail.querySelector('[data-order-detail-requester]'),
      order.requester || 'AACD'
    );
    tail(detail.querySelector('[data-order-detail-device]'), order.device);
    tail(detail.querySelector('[data-order-detail-material]'), order.material);
    tail(detail.querySelector('[data-order-detail-deadline]'), order.deadline);
    card
      .querySelector('[data-order-action="details"]')
      .setAttribute('aria-controls', detail.id);
    return card;
  }
  function renderPartnerOrders(orders) {
    for (const [type, state] of [
      ['active', ORDER_STATUS.IN_PRODUCTION],
      ['pending', ORDER_STATUS.NOT_ACCEPTED]
    ]) {
      const records = orders.filter((order) => order.status === state);
      const list = document.getElementById(`${type}-orders`);
      list.querySelectorAll('.order-card').forEach((card) => card.remove());
      list.prepend(...records.map(renderPartnerOrder));
      document.getElementById(`${type}-orders-count`).textContent =
        records.length;
      list.querySelector('.order-empty').hidden = records.length > 0;
      document.getElementById(
        type === 'active' ? 'service-count' : 'pending-count'
      ).textContent = records.length;
    }
  }
  function renderHistory(orders) {
    const history = orders.filter((order) =>
      [
        ORDER_STATUS.FINISHED,
        ORDER_STATUS.CANCELLED,
        ORDER_STATUS.REFUSED
      ].includes(order.status)
    );
    document.getElementById('production-history').replaceChildren(
      ...history.map((record) => {
        const row = instance('history-template');
        text(row, '.history-id', record.code);
        text(row, 'strong', record.device);
        text(row, '.history-material', record.material);
        const status = row.querySelector('.history-status');
        status.className =
          'history-status ' + ORDER_STATUS_UI[record.status].partnerClass;
        status.querySelector('img').src =
          record.status === ORDER_STATUS.FINISHED
            ? 'assets/partner-done.svg'
            : 'assets/partner-cancelled.svg';
        tail(status, ORDER_STATUS_UI[record.status].label);
        text(row, '.history-date', record.completedDate || '');
        return row;
      })
    );
  }
  // Uma consulta alimenta as listas de pedidos e o histórico.
  async function refreshOrders() {
    const actor = sessionKey();
    const orders =
      sessionUser?.perfil === 'parceiro' ? await data.listOrders() : [];
    if (actor !== sessionKey()) return;
    renderPartnerOrders(orders);
    renderHistory(orders);
  }
  document
    .getElementById('parceiro-pedidos')
    .addEventListener('click', async (event) => {
      const button = event.target.closest('[data-order-action]');
      if (!button) return;
      const action = button.dataset.orderAction;
      if (action === 'details') {
        const detail = document.getElementById(
          button.getAttribute('aria-controls')
        );
        detail.hidden = !detail.hidden;
        button.setAttribute('aria-expanded', String(!detail.hidden));
        button.textContent = detail.hidden
          ? 'Visualizar Detalhes'
          : 'Ocultar Detalhes';
        return;
      }
      const order = await data.getOrder(
        button.closest('[data-order-id]').dataset.orderId
      );
      if (!order) return;
      if (action === 'accept') await data.acceptOrder(order.id);
      else if (action === 'complete') await data.finishOrder(order.id);
      else if (action === 'refuse') await data.refuseOrder(order.id);
      else return;
      await refreshOrders();
      document.getElementById('orders-feedback').textContent =
        `Pedido #${order.id} ${action === 'accept' ? 'aceito' : action === 'complete' ? 'concluído' : 'recusado'}.`;
    });
  function clear() {
    renderPartnerOrders([]);
    renderHistory([]);
    document.getElementById('orders-feedback').textContent = '';
  }
  return { refresh: refreshOrders, clear };
}
