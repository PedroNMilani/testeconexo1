import { sessionKey } from '../auth-client.js';
import * as data from '../data.js';
import { ORDER_STATUS, ORDER_STATUS_UI } from '../order-status.js';
import { instance, text, tail, normalizeText } from '../shared-ui.js';

export function initAacdOrders({ onOrdersChanged }) {
  const aacdOrderList = document.getElementById('aacd-order-list');
  const aacdOrderSearch = document.getElementById('aacd-order-search');
  const aacdMaterialFilter = document.getElementById('aacd-filter-material');
  const aacdPriorityFilter = document.getElementById('aacd-filter-priority');
  let aacdStatusFilter = 'all';
  let aacdCurrentPage = 1;
  const pageSize = 4;
  let orders = [];
  const expandedOrders = new Set();
  function aacdFilteredOrders() {
    const search = normalizeText(aacdOrderSearch.value.trim());
    const material = normalizeText(aacdMaterialFilter.value);
    return orders.filter(
      (order) =>
        (aacdStatusFilter === 'all' || order.status === aacdStatusFilter) &&
        normalizeText(
          [
            order.code,
            order.device,
            order.lab,
            order.material,
            ORDER_STATUS_UI[order.status].label,
            order.priority
          ].join(' ')
        ).includes(search) &&
        normalizeText(order.material).includes(material) &&
        (!aacdPriorityFilter.value ||
          order.priority === aacdPriorityFilter.value)
    );
  }
  function renderAacdOrder(order) {
    const row = instance('aacd-order-template');
    row.dataset.aacdOrder = order.id;
    row.dataset.status = order.status;
    row.dataset.lab = order.lab;
    row.dataset.material = order.material;
    row.dataset.priority = order.priority;
    row.querySelector('.aacd-device-icon img').src =
      order.icon || 'assets/aacd-6a97c.svg';
    text(row, '[data-order-code]', order.code + ' •');
    text(row, 'h2', order.device);
    const urgent = row.querySelector('.urgent-tag');
    // A prioridade é informativa e não participa da recomendação.
    if (urgent) {
      urgent.hidden = order.priority !== 'Urgente';
      urgent.textContent = order.priority;
    }
    tail(row.querySelector('.aacd-order-info p'), order.lab);
    text(row, '[data-order-material]', 'Material: ' + order.material);
    const status = row.querySelector('.aacd-status');
    status.className = 'aacd-status ' + ORDER_STATUS_UI[order.status].className;
    status.replaceChildren(
      ORDER_STATUS_UI[order.status].label || 'Aguardando aceite'
    );
    text(row, '.aacd-order-state>small', order.statusNote || '');
    const detail = row.querySelector('.aacd-order-detail');
    detail.id = `aacd-order-detail-${order.id}`;
    const fields = [
      ['Pedido', order.code],
      ['Dispositivo', order.device],
      ['Polo', order.lab],
      ['Material', order.material],
      ['Situação', ORDER_STATUS_UI[order.status].label || 'Aguardando aceite']
    ];
    if (order.volumes)
      fields.push(
        ['Volume', Object.values(order.volumes).join('×') + ' mm'],
        ['Bicos', order.nozzles.join(', ') + ' mm'],
        ['Prioridade', order.priority],
        ['Observações', order.notes || 'Não informadas']
      );
    detail.replaceChildren(
      ...fields.map(([label, value]) => {
        const paragraph = document.createElement('p'),
          title = document.createElement('strong');
        title.textContent = label + ': ';
        paragraph.append(title, value);
        return paragraph;
      })
    );
    if (order.url) {
      // Mesmo um adaptador futuro não deve transformar uma URL arbitrária em link ativo.
      let safe = false;
      try {
        safe = ['http:', 'https:'].includes(new URL(order.url).protocol);
      } catch {
        /* inválida */
      }
      if (safe) {
        const anchor = document.createElement('a');
        anchor.href = order.url;
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
        anchor.textContent = 'Abrir arquivo do pedido';
        detail.append(anchor);
      }
    }
    detail.hidden = !expandedOrders.has(order.id);
    const trigger = row.querySelector('[data-aacd-detail]');
    trigger.setAttribute('aria-controls', detail.id);
    trigger.setAttribute('aria-expanded', String(!detail.hidden));
    trigger.setAttribute('aria-label', `Detalhes do pedido ${order.code}`);
    if (
      [ORDER_STATUS.NOT_ACCEPTED, ORDER_STATUS.IN_PRODUCTION].includes(
        order.status
      )
    ) {
      const cancel = document.createElement('button');
      cancel.type = 'button';
      cancel.className = 'btn-back';
      cancel.dataset.cancelOrder = order.id;
      cancel.textContent = 'Cancelar pedido';
      row.querySelector('.aacd-order-detail').append(cancel);
    }
    return row;
  }
  function renderAacdOrders({ resetPage = false } = {}) {
    if (resetPage) aacdCurrentPage = 1;
    const filtered = aacdFilteredOrders();
    const maxPage = Math.max(1, Math.ceil(filtered.length / pageSize));
    aacdCurrentPage = Math.min(aacdCurrentPage, maxPage);
    const pageOrders = filtered.slice(
      (aacdCurrentPage - 1) * pageSize,
      aacdCurrentPage * pageSize
    );
    aacdOrderList.replaceChildren(...pageOrders.map(renderAacdOrder));
    document.getElementById('aacd-order-empty').hidden = filtered.length !== 0;
    document.getElementById('aacd-order-count').textContent =
      `Exibindo ${pageOrders.length} de ${filtered.length} pedidos encontrados`;
    document.querySelectorAll('[data-aacd-page]').forEach((button) => {
      const page = button.dataset.aacdPage;
      button.disabled =
        page === 'previous'
          ? aacdCurrentPage <= 1
          : page === 'next'
            ? aacdCurrentPage >= maxPage
            : Number(page) > maxPage;
      if (Number(page) === aacdCurrentPage)
        button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
  }
  for (const control of [
    aacdOrderSearch,
    aacdMaterialFilter,
    aacdPriorityFilter
  ])
    control.addEventListener('input', () =>
      renderAacdOrders({ resetPage: true })
    );
  const statusTabs = document.querySelector('#aacd-pedidos .history-tabs');
  statusTabs.replaceChildren(
    ...[
      ['all', 'Todos'],
      ...Object.values(ORDER_STATUS).map((status) => [
        status,
        ORDER_STATUS_UI[status].filterLabel
      ])
    ].map(([value, label]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.aacdTab = value;
      button.textContent = label;
      button.setAttribute('aria-pressed', String(value === 'all'));
      return button;
    })
  );
  document.querySelectorAll('[data-aacd-tab]').forEach((button) =>
    button.addEventListener('click', () => {
      aacdStatusFilter = button.dataset.aacdTab;
      document
        .querySelectorAll('[data-aacd-tab]')
        .forEach((tab) =>
          tab.setAttribute('aria-pressed', String(tab === button))
        );
      renderAacdOrders({ resetPage: true });
    })
  );
  document
    .getElementById('aacd-clear-filters')
    .addEventListener('click', () => {
      aacdOrderSearch.value = '';
      aacdMaterialFilter.value = '';
      aacdPriorityFilter.value = '';
      document.querySelector('[data-aacd-tab="all"]').click();
    });
  document.querySelectorAll('[data-aacd-page]').forEach((button) =>
    button.addEventListener('click', () => {
      const requested = button.dataset.aacdPage;
      aacdCurrentPage =
        requested === 'next'
          ? aacdCurrentPage + 1
          : requested === 'previous'
            ? aacdCurrentPage - 1
            : Number(requested);
      renderAacdOrders();
    })
  );
  aacdOrderList.addEventListener('click', async (event) => {
    const cancel = event.target.closest('[data-cancel-order]');
    if (cancel) {
      cancel.disabled = true;
      try {
        await data.cancelOrder(cancel.dataset.cancelOrder);
        await onOrdersChanged();
        document.getElementById('aacd-orders-feedback').textContent =
          'Pedido cancelado e solicitação encerrada.';
      } catch (error) {
        document.getElementById('aacd-orders-feedback').textContent =
          error.message;
      } finally {
        cancel.disabled = false;
      }
      return;
    }

    const button = event.target.closest('[data-aacd-detail]');
    if (!button) return;
    const id = button.closest('[data-aacd-order]').dataset.aacdOrder;
    if (expandedOrders.has(id)) expandedOrders.delete(id);
    else expandedOrders.add(id);
    const detail = document.getElementById(
      button.getAttribute('aria-controls')
    );
    detail.hidden = !expandedOrders.has(id);
    button.setAttribute('aria-expanded', String(!detail.hidden));
  });
  document.getElementById('aacd-export').addEventListener('click', () => {
    const cell = (value) => {
      let valueText = String(value).replace(/\r?\n/g, ' ');
      if (/^[=+@-]/.test(valueText)) valueText = "'" + valueText;
      return '"' + valueText.replace(/"/g, '""') + '"';
    };
    const rows = [
      ['Pedido', 'Dispositivo', 'Polo', 'Material', 'Situação', 'Prioridade'],
      ...aacdFilteredOrders().map((order) => [
        order.code,
        order.device,
        order.lab,
        order.material,
        ORDER_STATUS_UI[order.status].label || 'Aguardando aceite',
        order.priority
      ])
    ];
    const url = URL.createObjectURL(
      new Blob(
        ['\ufeff' + rows.map((row) => row.map(cell).join(';')).join('\r\n')],
        { type: 'text/csv;charset=utf-8;' }
      )
    );
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'pedidos-aacd.csv';
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    document.getElementById('aacd-orders-feedback').textContent =
      `${rows.length - 1} pedidos exportados conforme os filtros selecionados.`;
  });
  function renderAacdMetrics() {
    document.getElementById('aacd-metric-open').textContent = String(
      orders.filter((order) => order.status === ORDER_STATUS.NOT_ACCEPTED)
        .length
    ).padStart(2, '0');
    document.getElementById('aacd-metric-production').textContent = String(
      orders.filter((order) => order.status === ORDER_STATUS.IN_PRODUCTION)
        .length
    ).padStart(2, '0');
    document.getElementById('aacd-metric-finished').textContent = String(
      orders.filter((order) => order.status === ORDER_STATUS.FINISHED).length
    ).padStart(2, '0');
    document.querySelector(
      '#aacd-inicio .metric-bottom small.blue'
    ).textContent =
      `${orders.filter((order) => order.status === ORDER_STATUS.NOT_ACCEPTED && order.priority === 'Urgente').length} prioritários`;
    document.querySelector(
      '#aacd-inicio .metric-bottom small.cyan'
    ).textContent =
      `${new Set(orders.filter((order) => order.status === ORDER_STATUS.IN_PRODUCTION).map((order) => order.lab)).size} Laboratórios`;
  }

  async function refresh() {
    const actor = sessionKey();
    const records = await data.listOrders();
    if (actor !== sessionKey()) return;
    orders = records.sort((a, b) => Number(b.id) - Number(a.id));
    renderAacdOrders();
    renderAacdMetrics();
  }
  function resetFilters() {
    aacdOrderSearch.value = '';
    aacdMaterialFilter.value = '';
    aacdPriorityFilter.value = '';
    aacdStatusFilter = 'all';
    aacdCurrentPage = 1;
    document
      .querySelectorAll('[data-aacd-tab]')
      .forEach((tab) =>
        tab.setAttribute('aria-pressed', String(tab.dataset.aacdTab === 'all'))
      );
  }
  function clear() {
    orders = [];
    expandedOrders.clear();
    resetFilters();
    renderAacdOrders();
    renderAacdMetrics();
  }
  return { refresh, resetFilters, clear };
}
