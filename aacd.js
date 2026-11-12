import { backendEnabled, sessionUser, api, sessionKey } from './auth-client.js';
import * as data from './data.js';
import { ORDER_STATUS, ORDER_STATUS_UI } from './data.js';
import { activeSection, navigate } from './router.js';
import {
  instance,
  text,
  tail,
  bindAreaHeader,
  bindProfile,
  bindLogout
} from './shared-ui.js';

export async function initAacd() {
  const aacdSections = new Set([
    'aacd-inicio',
    'aacd-pedidos',
    'aacd-parceiros',
    'aacd-homologacao',
    'aacd-pedido-1',
    'aacd-pedido-2',
    'aacd-pedido-3',
    'aacd-conectar',
    'aacd-perfil'
  ]);
  const aacdOrderForms = [1, 2, 3].map((n) =>
    document.getElementById(`aacd-order-step-${n}`)
  );
  const aacdOrderList = document.getElementById('aacd-order-list');
  const aacdNetwork = document.getElementById('aacd-network-grid');
  const aacdOrderSearch = document.getElementById('aacd-order-search');
  const aacdMaterialFilter = document.getElementById('aacd-filter-material');
  const aacdPriorityFilter = document.getElementById('aacd-filter-priority');
  let aacdStatusFilter = 'all';
  let aacdCurrentPage = 1;
  let orders = [],
    partners = [],
    matches = [];
  const expandedOrders = new Set();
  bindAreaHeader({
    sections: aacdSections,
    headerId: 'aacd-header',
    nav: '.aacd-nav',
    accountButtonId: 'aacd-account-button',
    group: (section) =>
      section === 'aacd-homologacao'
        ? 'aacd-parceiros'
        : [
              'aacd-pedido-1',
              'aacd-pedido-2',
              'aacd-pedido-3',
              'aacd-conectar'
            ].includes(section)
          ? 'aacd-pedidos'
          : section
  });
  bindLogout('#aacd-logout', 'aacd');
  const renderAacdProfile = bindProfile({
    area: 'aacd',
    formId: 'aacd-profile-form',
    nameField: 'aacd-profile-name',
    emailField: 'aacd-profile-email',
    titles: ['[data-aacd-account]', '#aacd-perfil-titulo'],
    feedbackId: 'aacd-profile-feedback',
    cancelId: 'aacd-profile-cancel',
    home: 'aacd-inicio',
    loginEvent: 'conexo:aacd-login',
    nameError: 'Informe o nome do responsável.',
    success: backendEnabled
      ? 'Perfil AACD atualizado.'
      : 'Perfil AACD atualizado nesta demonstração.'
  });
  function aacdNormalize(value) {
    return String(value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('pt-BR');
  }
  function aacdFilteredOrders() {
    const search = aacdNormalize(aacdOrderSearch.value.trim());
    const material = aacdNormalize(aacdMaterialFilter.value);
    return orders.filter(
      (order) =>
        (aacdStatusFilter === 'all' || order.status === aacdStatusFilter) &&
        aacdNormalize(
          [
            order.code,
            order.device,
            order.lab,
            order.material,
            ORDER_STATUS_UI[order.status].label,
            order.priority
          ].join(' ')
        ).includes(search) &&
        aacdNormalize(order.material).includes(material) &&
        (!aacdPriorityFilter.value ||
          order.priority === aacdPriorityFilter.value)
    );
  }
  function renderAacdOrder(order, visible) {
    const row = instance('aacd-order-template');
    row.dataset.aacdOrder = order.id;
    row.dataset.status = order.status;
    row.dataset.lab = order.lab;
    row.dataset.material = order.material;
    row.dataset.priority = order.priority;
    row.hidden = !visible;
    row.querySelector('.aacd-device-icon img').src =
      order.icon || 'assets/aacd-6a97c.svg';
    text(row, '.aacd-order-info>small', order.code + ' •');
    text(row, 'h2', order.device);
    const urgent = row.querySelector('.urgent-tag');
    // A prioridade é informativa e não participa da recomendação.
    if (urgent) {
      urgent.hidden = order.priority !== 'Urgente';
      urgent.textContent = order.priority;
    }
    tail(row.querySelector('.aacd-order-info p'), order.lab);
    text(
      row,
      '.aacd-order-info>small:last-child',
      'Material: ' + order.material
    );
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
      backendEnabled &&
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
    const maxPage = Math.max(1, Math.ceil(filtered.length / 4));
    aacdCurrentPage = Math.min(aacdCurrentPage, maxPage);
    const visible = new Set(
      filtered
        .slice((aacdCurrentPage - 1) * 4, aacdCurrentPage * 4)
        .map((order) => order.id)
    );
    aacdOrderList.replaceChildren(
      ...orders.map((order) => renderAacdOrder(order, visible.has(order.id)))
    );
    document.getElementById('aacd-order-empty').hidden = filtered.length !== 0;
    document.getElementById('aacd-order-count').textContent =
      `Exibindo ${visible.size} de ${filtered.length} pedidos encontrados${backendEnabled ? '' : ' nesta demonstração'}`;
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
        await renderAacd();
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
  function renderNetwork() {
    const search = aacdNormalize(
      document.getElementById('aacd-partner-search').value.trim()
    );
    const filtered = partners.filter((partner) =>
      aacdNormalize(
        [
          partner.name,
          partner.location,
          partner.fleet,
          partner.technical,
          ...partner.materials
        ].join(' ')
      ).includes(search)
    );
    aacdNetwork.replaceChildren(
      ...filtered.map((partner) => {
        const card = instance('network-template');
        card.dataset.partnerId = partner.id;
        text(card, 'h2', partner.name);
        tail(card.querySelector('.network-card-header p'), partner.location);
        card.querySelector('.round-icon img').src = partner.icon;
        const status = card.querySelector('.aacd-status');
        status.className = partner.statusClass;
        status.textContent = partner.statusLabel;
        const values = card.querySelectorAll('.network-info strong');
        values[0].textContent = partner.fleet;
        values[1].textContent = partner.technical;
        card.querySelectorAll('.network-info small')[1].textContent =
          partner.technicalLabel;
        card.querySelector('.network-materials p').replaceChildren(
          ...partner.materials.map((material) => {
            const span = document.createElement('span');
            span.textContent = material;
            return span;
          })
        );
        return card;
      })
    );
    document.getElementById('aacd-partner-empty').hidden = filtered.length > 0;
    document.querySelectorAll('[data-homologated-count]').forEach((count) => {
      count.textContent = partners.length;
    });
    document.querySelector('#aacd-conectar .network-total').textContent =
      `● ${partners.length} Laboratórios Ativos na Rede`;
  }
  document
    .getElementById('aacd-partner-search')
    .addEventListener('input', renderNetwork);
  function renderReview(candidate) {
    const review = instance('review-template');
    review.dataset.candidate = candidate.id;
    if (backendEnabled)
      review.querySelector('[data-review-action=reject]').hidden = true;
    text(review, 'h2', candidate.name);
    text(review, 'summary p', candidate.description);
    review.querySelectorAll('.review-info-grid>div').forEach((cell, i) => {
      const info = candidate.info[i];
      text(cell, 'small', info.label);
      tail(cell.querySelector('strong'), info.value);
      text(cell, 'p', info.note);
      cell.querySelector('img').src = info.icon;
    });
    text(
      review,
      '.aacd-review-content h3:nth-of-type(2) small',
      `${candidate.machines.length} Máquinas ${backendEnabled ? 'Cadastradas' : 'Habilitadas'}`
    );
    review.querySelector('.review-machine-grid').replaceChildren(
      ...candidate.machines.map((machine) => {
        const card = instance('machine-template');
        if (backendEnabled)
          card.querySelector('.machine-approved').hidden = true;
        text(card, 'h4', machine.name);
        text(card, 'p', machine.kind);
        card.querySelectorAll('div>span').forEach((span, i) => {
          span.textContent = machine.specs[i];
        });
        return card;
      })
    );
    return review;
  }
  async function renderReviews() {
    const reviews = await data.listReviews();
    document
      .getElementById('aacd-review-list')
      .replaceChildren(...reviews.map(renderReview));
    document.getElementById('aacd-review-count').textContent = reviews.length;
  }
  function syncReviewVisibility() {
    const reviews = [...document.querySelectorAll('.aacd-review')],
      expanded = reviews.find((review) => review.open);
    reviews.forEach((review) => {
      review.hidden = Boolean(expanded && review !== expanded);
    });
  }
  document.getElementById('aacd-review-list').addEventListener(
    'toggle',
    (event) => {
      if (event.target.matches('.aacd-review')) syncReviewVisibility();
    },
    true
  );
  document
    .getElementById('aacd-review-list')
    .addEventListener('click', async (event) => {
      const button = event.target.closest('[data-review-action]');
      if (!button) return;
      const approved = button.dataset.reviewAction === 'approve';
      button.disabled = true;
      try {
        const candidate = await data.reviewPartner(
          button.closest('[data-candidate]').dataset.candidate,
          approved
        );
        if (!candidate) return;
        partners = await data.listPartners();
        await renderReviews();
        renderNetwork();
        document.getElementById('aacd-review-feedback').textContent =
          `${candidate.name}: cadastro ${approved ? 'homologado' : 'rejeitado'}${backendEnabled ? '' : ' nesta demonstração'}.`;
      } catch (error) {
        document.getElementById('aacd-review-feedback').textContent =
          error.message;
      } finally {
        button.disabled = false;
      }
    });
  function renderMatches() {
    document.getElementById('aacd-match-list').replaceChildren(
      ...matches.map((match) => {
        const card = instance('match-template');
        card.dataset.match = match.id;
        card.classList.toggle('recommended', match.recommended);
        card.querySelector('.recommendation-banner').hidden =
          !match.recommended;
        const name = card.querySelector('h2'),
          location = document.createElement('small');
        location.textContent = match.location;
        name.replaceChildren(match.name + ' ', location);
        text(card, '.match-header p', match.description);
        card.querySelector('.round-icon img').src = match.icon;
        text(card, '.match-score strong span', match.score);
        card.querySelector('.match-score img').src = match.scoreIcon;
        text(card, '.match-score b', match.scoreLabel);
        text(card, '.match-score small', match.scoreNote);
        if (backendEnabled)
          card.querySelectorAll('.match-specs small')[2].textContent =
            'Fornecimento de material';
        card.querySelectorAll('.match-specs strong').forEach((value, i) => {
          value.textContent = match.specs[i];
        });
        tail(card.querySelector('.match-actions>small'), match.note);
        const detail = card.querySelector('.aacd-order-detail');
        detail.id = `match-detail-${match.id}`;
        detail.querySelectorAll('p').forEach((paragraph, i) => {
          if (i < 3) {
            paragraph.querySelector('strong').textContent = [
              'Laboratório: ',
              'Impressora: ',
              'Matéria-prima: '
            ][i];
            tail(paragraph, [match.name, match.specs[0], match.specs[1]][i]);
          } else paragraph.textContent = match.note;
        });
        card
          .querySelector('[data-match-detail]')
          .setAttribute('aria-controls', detail.id);
        card.querySelector('[data-connect-order]').dataset.connectOrder =
          match.id;
        return card;
      })
    );
  }
  async function renderHomePartners() {
    const suggestions = await data.listHomePartners();
    const container = document.querySelector(
      '#aacd-inicio .aacd-action-card:last-child'
    );
    container
      .querySelectorAll('.home-partner-line')
      .forEach((line) => line.remove());
    const link = container.querySelector('.aacd-action-link');
    for (const suggestion of suggestions) {
      const line = instance('home-partner-template');
      text(line, 'strong', suggestion.name);
      text(line, 'small', suggestion.description);
      line.querySelector('.round-icon img').src = suggestion.icon;
      if (suggestion.approve) {
        const anchor = document.createElement('a');
        anchor.href = '#aacd-homologacao';
        anchor.dataset.section = 'aacd-homologacao';
        anchor.className = 'home-approve';
        anchor.textContent = 'Aprovar';
        line.lastElementChild.replaceWith(anchor);
      }
      link.before(line);
    }
  }
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
  async function renderOpenRequests() {
    const panel = document.getElementById('aacd-open-requests');
    if (!backendEnabled) {
      panel.hidden = true;
      return;
    }
    const actor = sessionKey();
    const requests = await data.listRequests();
    if (actor !== sessionKey()) return;
    const open = requests.filter(
      (s) =>
        !s.encerrada_em &&
        !['pendente', 'em_producao'].includes(s.ultimo_status)
    );
    panel.hidden = !open.length;
    panel.querySelector('[data-open-requests]').replaceChildren(
      ...open.map((s) => {
        const row = document.createElement('article'),
          label = document.createElement('span'),
          button = document.createElement('button');
        label.textContent =
          (s.codigo || 'SOL-' + s.id) +
          ' — ' +
          (s.ultimo_status === 'recusado'
            ? 'Recusado; escolha outro parceiro'
            : 'Aguardando encaminhamento');
        button.type = 'button';
        button.className = 'btn-back';
        button.textContent = 'Selecionar parceiro';
        button.addEventListener('click', async () => {
          button.disabled = true;
          try {
            const request = await data.getRequest(s.id);
            document.getElementById('aacd-order-code').value = request.codigo;
            const priority = {
              padrao: 'Padrão',
              medio: 'Médio',
              urgente: 'Urgente'
            }[request.prioridade];
            aacdOrderForms[0]
              .querySelectorAll('[name=priority]')
              .forEach((input) => (input.checked = input.value === priority));
            for (const axis of ['X', 'Y', 'Z'])
              document.getElementById('aacd-volume' + axis).value =
                request['capacidade_' + axis.toLowerCase()];
            aacdOrderForms[1]
              .querySelectorAll('[name=materials]')
              .forEach(
                (input) =>
                  (input.checked = request.materials.includes(input.value))
              );
            aacdOrderForms[1]
              .querySelectorAll('[name=nozzles]')
              .forEach(
                (input) =>
                  (input.checked = request.nozzles.includes(
                    Number(input.value)
                  ))
              );
            document.getElementById('aacd-order-url').value = request.link;
            document.getElementById('aacd-order-notes').value =
              request.observacoes || '';
            const aacdDraft = readAacdDraft();
            matches = await data.listMatches({ requestId: s.id });
            renderMatches();
            document.getElementById('aacd-demand-code').textContent =
              aacdDraft.code;
            document.getElementById('aacd-demand-material').textContent =
              aacdDraft.materials.join(', ');
            document.querySelector('#aacd-demand-volume span').textContent =
              aacdDraft.volumes.join('×') + ' mm';
            document.getElementById('aacd-connect-feedback').textContent =
              matches.length
                ? ''
                : 'Nenhuma impressora homologada atende aos requisitos.';
            navigate('aacd-conectar');
          } catch (error) {
            document.getElementById('aacd-orders-feedback').textContent =
              error.message;
          } finally {
            button.disabled = false;
          }
        });
        row.append(label, button);
        return row;
      })
    );
  }
  async function renderAacd() {
    try {
      const actor = sessionKey();
      [orders, partners, matches] = await Promise.all([
        data.listOrders({ scope: 'aacd' }),
        data.listPartners(),
        data.listMatches()
      ]);
      if (backendEnabled && actor !== sessionKey()) return;
      // Os exemplos mantêm a ordem original; novos registros aparecem primeiro.
      orders.sort((a, b) => Number(b.id) - Number(a.id));
      renderAacdOrders();
      renderNetwork();
      renderMatches();
      renderAacdMetrics();
      await Promise.all([
        renderReviews(),
        renderHomePartners(),
        renderOpenRequests()
      ]);
    } catch (error) {
      document.getElementById('aacd-orders-feedback').textContent =
        error.message;
    }
  }
  document.addEventListener('conexo:data-changed', renderAacd);

  // Etapas do pedido: validar a seção ativa e preservar os controles ao voltar.
  for (const axis of ['X', 'Y', 'Z']) {
    const input = document.getElementById('aacd-volume' + axis);
    input.min = '1';
    input.max = '10000';
    input.step = backendEnabled ? '1' : '0.1';
  }
  aacdOrderForms[1].querySelectorAll('[name="nozzles"]').forEach((input) => {
    input.checked = true;
  });
  function validateAacdStep(step) {
    const form = aacdOrderForms[step - 1];
    if (step === 1) {
      const input = document.getElementById('aacd-order-code');
      input.setCustomValidity(
        input.value.trim() ? '' : 'Informe o nome ou código do pedido.'
      );
    }
    if (step === 3) {
      const input = document.getElementById('aacd-order-url');
      let valid = false;
      try {
        valid = ['https:', 'http:'].includes(new URL(input.value).protocol);
      } catch {
        /* campo inválido */
      }
      input.setCustomValidity(
        valid ? '' : 'Informe um link HTTP ou HTTPS válido para o arquivo.'
      );
    }
    if (!form.checkValidity()) {
      navigate(`aacd-pedido-${step}`);
      form.reportValidity();
      return false;
    }
    if (
      step === 2 &&
      (!form.querySelector('[name="materials"]:checked') ||
        !form.querySelector('[name="nozzles"]:checked'))
    ) {
      navigate('aacd-pedido-2');
      form.querySelector('.form-error').textContent =
        'Selecione pelo menos um material e um bico disponível.';
      return false;
    }
    return true;
  }

  function readAacdDraft() {
    const technical = aacdOrderForms[1];
    return {
      code: document.getElementById('aacd-order-code').value.trim(),
      priority: aacdOrderForms[0].querySelector('[name="priority"]:checked')
        .value,
      materials: [
        ...technical.querySelectorAll('[name="materials"]:checked')
      ].map((input) => input.value),
      nozzles: [...technical.querySelectorAll('[name="nozzles"]:checked')].map(
        (input) => input.value
      ),
      volumes: ['X', 'Y', 'Z'].map(
        (axis) => document.getElementById('aacd-volume' + axis).value
      ),
      url: document.getElementById('aacd-order-url').value,
      notes: document.getElementById('aacd-order-notes').value
    };
  }
  for (const [index, form] of aacdOrderForms.entries()) {
    form.addEventListener('input', (event) => {
      if ('setCustomValidity' in event.target)
        event.target.setCustomValidity('');
      const error = form.querySelector('.form-error');
      if (error) error.textContent = '';
    });
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (activeSection !== `aacd-pedido-${index + 1}`) return;
      if (!validateAacdStep(index + 1)) return;
      if (index < 2) navigate(`aacd-pedido-${index + 2}`);
      else {
        if (!validateAacdStep(1) || !validateAacdStep(2)) return;
        const aacdDraft = readAacdDraft();
        document.getElementById('aacd-demand-code').textContent =
          aacdDraft.code;
        document.getElementById('aacd-demand-material').textContent =
          aacdDraft.materials.join(', ');
        document.querySelector('#aacd-demand-volume span').textContent =
          aacdDraft.volumes.join('×') + ' mm';
        const button = form.querySelector('[type=submit]');
        button.disabled = true;
        try {
          const actor = sessionKey();
          matches = await data.listMatches(aacdDraft);
          if (backendEnabled && actor !== sessionKey()) return;
          renderMatches();
          document.getElementById('aacd-connect-feedback').textContent =
            matches.length
              ? ''
              : 'Nenhuma impressora homologada atende aos requisitos. Revise materiais, bicos e dimensões.';
          navigate('aacd-conectar');
        } catch (error) {
          form.querySelector('.form-error').textContent = error.message;
        } finally {
          button.disabled = false;
        }
      }
    });
  }

  document
    .getElementById('aacd-match-list')
    .addEventListener('click', async (event) => {
      const detailButton = event.target.closest('[data-match-detail]');
      if (detailButton) {
        const detail = document.getElementById(
          detailButton.getAttribute('aria-controls')
        );
        detail.hidden = !detail.hidden;
        detailButton.setAttribute('aria-expanded', String(!detail.hidden));
        detailButton.textContent = detail.hidden
          ? 'Ver Ficha Técnica'
          : 'Ocultar Ficha Técnica';
        return;
      }
      const button = event.target.closest('[data-connect-order]');
      if (!button) return;
      if (![1, 2, 3].every(validateAacdStep)) return;
      const draft = readAacdDraft();
      const match = matches.find(
        (record) => record.id === button.dataset.connectOrder
      );
      if (!match) return;
      button.disabled = true;
      try {
        await data.createOrder({
          ...draft,
          selection: backendEnabled
            ? {
                partnerId: match.partnerId,
                printerId: match.printerId,
                material: match.material,
                nozzle: match.nozzle
              }
            : undefined,
          volumes: Object.fromEntries(
            ['X', 'Y', 'Z'].map((axis, i) => [axis, draft.volumes[i]])
          ),
          scope: 'aacd',
          device: draft.code,
          lab: match.name,
          material: draft.materials.join(', '),
          partnerId: match.id === '0' ? 'current-partner' : match.id,
          status: ORDER_STATUS.NOT_ACCEPTED,
          statusNote: 'Enviado nesta demonstração',
          deadline: '',
          requester: 'AACD'
        });
      } catch (error) {
        document.getElementById('aacd-connect-feedback').textContent =
          error.message;
        return;
      } finally {
        button.disabled = false;
      }
      aacdOrderSearch.value = '';
      aacdMaterialFilter.value = '';
      aacdPriorityFilter.value = '';
      aacdStatusFilter = 'all';
      aacdCurrentPage = 1;
      document
        .querySelectorAll('[data-aacd-tab]')
        .forEach((tab) =>
          tab.setAttribute(
            'aria-pressed',
            String(tab.dataset.aacdTab === 'all')
          )
        );
      await renderAacd();
      document.dispatchEvent(new CustomEvent('conexo:data-changed'));
      document.getElementById('aacd-orders-feedback').textContent =
        backendEnabled
          ? `${draft.code} conectado a ${match.name}. Pedido salvo e disponível para o parceiro.`
          : `${draft.code} conectado a ${match.name} nesta demonstração. Nenhum envio real foi realizado.`;
      navigate('aacd-pedidos');
    });
  async function renderAacdUsers() {
    const panel = document.getElementById('aacd-users-panel');
    panel.hidden =
      !backendEnabled ||
      sessionUser?.perfil !== 'aacd' ||
      !sessionUser.homologado;
    if (panel.hidden) {
      document.getElementById('aacd-users-list').replaceChildren();
      return;
    }
    try {
      const actor = sessionKey();
      const { items } = await api('/aacd/pendentes');
      if (actor !== sessionKey()) return;
      document.getElementById('aacd-users-list').replaceChildren(
        ...items.map((user) => {
          const row = document.createElement('article'),
            title = document.createElement('h3'),
            info = document.createElement('p'),
            button = document.createElement('button');
          title.textContent = user.nome;
          info.textContent = user.email + ' — ' + user.unidade;
          button.type = 'button';
          button.className = 'btn btn-conexo';
          button.textContent = 'Homologar conta AACD';
          button.addEventListener('click', async () => {
            button.disabled = true;
            try {
              await api(
                '/aacd/' + encodeURIComponent(user.id) + '/homologacao',
                { method: 'POST' }
              );
              await renderAacdUsers();
              document.getElementById('aacd-users-feedback').textContent =
                'Conta AACD homologada.';
            } catch (error) {
              button.disabled = false;
              document.getElementById('aacd-users-feedback').textContent =
                error.message;
            }
          });
          row.append(title, info, button);
          return row;
        })
      );
      if (!items.length)
        document.getElementById('aacd-users-feedback').textContent =
          'Nenhuma conta AACD aguardando homologação.';
    } catch (error) {
      document.getElementById('aacd-users-feedback').textContent =
        error.message;
    }
  }
  document.addEventListener('conexo:navigate', (event) => {
    if (event.detail.section === 'aacd-homologacao') renderAacdUsers();
  });
  document.addEventListener('conexo:session', () => {
    if (sessionUser?.perfil === 'aacd' && sessionUser.homologado) renderAacd();
    else if (backendEnabled) {
      document.getElementById('aacd-network-grid').replaceChildren();
      document.getElementById('aacd-review-list').replaceChildren();
      partners = [];
    }
    renderAacdUsers();
  });
  await Promise.all([renderAacd(), renderAacdProfile()]);
}
