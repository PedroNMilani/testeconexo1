import { sessionUser, api, sessionKey } from '../auth-client.js';
import * as data from '../data.js';
import { instance, text, tail, normalizeText } from '../shared-ui.js';

export function initAacdPartners() {
  const aacdNetwork = document.getElementById('aacd-network-grid');
  let partners = [];
  let reviews = [];
  function renderNetwork() {
    const search = normalizeText(
      document.getElementById('aacd-partner-search').value.trim()
    );
    const filtered = partners.filter((partner) =>
      normalizeText(
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
        text(card, '[data-network-fleet]', partner.fleet);
        text(card, '[data-network-technical]', partner.technical);
        text(card, '[data-network-technical-label]', partner.technicalLabel);
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
    text(review, 'h2', candidate.name);
    text(review, 'summary p', candidate.description);
    candidate.info.forEach((info) => {
      const cell = review.querySelector(`[data-review-info="${info.key}"]`);
      text(cell, 'small', info.label);
      tail(cell.querySelector('strong'), info.value);
      text(cell, 'p', info.note);
      cell.querySelector('img').src = info.icon;
    });
    text(
      review,
      '[data-review-machine-count]',
      `${candidate.machines.length} Máquinas Cadastradas`
    );
    review.querySelector('.review-machine-grid').replaceChildren(
      ...candidate.machines.map((machine) => {
        const card = instance('machine-template');
        text(card, 'h4', machine.name);
        text(card, 'p', machine.kind);
        text(card, '[data-machine-volume]', machine.volumeLabel);
        text(card, '[data-machine-nozzles]', machine.nozzleLabel);
        text(card, '[data-machine-materials]', machine.materialLabel);
        return card;
      })
    );
    return review;
  }
  function renderReviews() {
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
      const button = event.target.closest('[data-review-action="approve"]');
      if (!button) return;
      const id = button.closest('[data-candidate]').dataset.candidate;
      const candidate = reviews.find((record) => record.id === id);
      if (!candidate) return;
      const actor = sessionKey();
      button.disabled = true;
      try {
        await data.approvePartner(id);
        if (actor !== sessionKey()) return;
        await refreshPartners();
        if (actor !== sessionKey()) return;
        document.getElementById('aacd-review-feedback').textContent =
          `${candidate.name}: cadastro homologado.`;
      } catch (error) {
        if (actor === sessionKey())
          document.getElementById('aacd-review-feedback').textContent =
            error.message;
      } finally {
        button.disabled = false;
      }
    });
  function renderHomePartners() {
    const container = document.querySelector('[data-home-partners]');
    container
      .querySelectorAll('.home-partner-line')
      .forEach((line) => line.remove());
    const link = container.querySelector('.aacd-action-link');
    for (const candidate of reviews) {
      const line = instance('home-partner-template');
      text(line, 'strong', candidate.name);
      text(line, 'small', candidate.description);
      link.before(line);
    }
  }
  async function renderAacdUsers() {
    const panel = document.getElementById('aacd-users-panel');
    panel.hidden = sessionUser?.perfil !== 'aacd' || !sessionUser.homologado;
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

  async function refreshPartners() {
    const actor = sessionKey();
    const [approved, pending] = await Promise.all([
      data.listPartners(),
      data.listReviews()
    ]);
    if (actor !== sessionKey()) return;
    partners = approved;
    reviews = pending;
    renderNetwork();
    renderReviews();
    renderHomePartners();
  }
  async function refresh() {
    await Promise.all([refreshPartners(), renderAacdUsers()]);
  }
  function clear() {
    partners = [];
    reviews = [];
    renderNetwork();
    renderReviews();
    renderHomePartners();
    document.getElementById('aacd-users-list').replaceChildren();
    document.getElementById('aacd-users-panel').hidden = true;
    document.getElementById('aacd-review-feedback').textContent = '';
  }
  return { refresh, clear };
}
