import { instance, text, tail } from '../shared-ui.js';

export function renderMatches(matches) {
  document.getElementById('aacd-match-list').replaceChildren(
    ...matches.map((match) => {
      const card = instance('match-template');
      card.dataset.match = match.id;
      card.classList.toggle('recommended', match.recommended);
      card.querySelector('.recommendation-banner').hidden = !match.recommended;
      const name = card.querySelector('h2'),
        location = document.createElement('small');
      location.textContent = match.location;
      name.replaceChildren(match.name + ' ', location);
      text(card, '.match-header p', match.description);
      card.querySelector('.round-icon img').src = match.icon;
      text(
        card,
        '[data-match-distance]',
        Number.isFinite(match.distanceKm)
          ? new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(
              match.distanceKm
            ) + ' km'
          : 'Não informada'
      );
      text(card, '[data-match-printer]', match.printerName);
      text(card, '[data-match-material]', match.materialLabel);
      text(card, '[data-match-supply]', match.supplyLabel);
      tail(card.querySelector('.match-actions>small'), match.note);
      const detail = card.querySelector('.aacd-order-detail');
      detail.id = `match-detail-${match.id}`;
      tail(detail.querySelector('[data-match-detail-lab]'), match.name);
      tail(
        detail.querySelector('[data-match-detail-printer]'),
        match.printerName
      );
      tail(
        detail.querySelector('[data-match-detail-material]'),
        match.materialLabel
      );
      text(detail, '[data-match-detail-note]', match.note);
      card
        .querySelector('[data-match-detail]')
        .setAttribute('aria-controls', detail.id);
      card.querySelector('[data-connect-order]').dataset.connectOrder =
        match.id;
      return card;
    })
  );
}
