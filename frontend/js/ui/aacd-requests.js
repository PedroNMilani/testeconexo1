import { sessionUser, sessionKey } from '../auth-client.js';
import * as data from '../data.js';
import { activeSection, navigate } from '../router.js';
import { renderMatches } from './aacd-matches.js';

export function initAacdRequests({ onOrdersChanged, resetOrderFilters }) {
  const forms = [1, 2, 3].map((step) =>
    document.getElementById(`aacd-order-step-${step}`)
  );
  const matchList = document.getElementById('aacd-match-list');
  const openPanel = document.getElementById('aacd-open-requests');
  const openList = openPanel.querySelector('[data-open-requests]');
  const feedback = document.getElementById('aacd-connect-feedback');
  let matches = [];
  // Ignora uma resposta de recomendações se o formulário mudar durante a busca.
  let revision = 0;

  function readDraft() {
    return {
      code: document.getElementById('aacd-order-code').value.trim(),
      priority: forms[0].querySelector('[name=priority]:checked').value,
      materials: [...forms[1].querySelectorAll('[name=materials]:checked')].map(
        (input) => input.value
      ),
      nozzles: [...forms[1].querySelectorAll('[name=nozzles]:checked')].map(
        (input) => input.value
      ),
      volumes: {
        X: Number(document.getElementById('aacd-volumeX').value),
        Y: Number(document.getElementById('aacd-volumeY').value),
        Z: Number(document.getElementById('aacd-volumeZ').value)
      },
      url: document.getElementById('aacd-order-url').value,
      notes: document.getElementById('aacd-order-notes').value
    };
  }
  function populateRequestForm(request) {
    document.getElementById('aacd-order-code').value = request.codigo;
    const priority = data.PRIORITY_LABELS[request.prioridade];
    forms[0]
      .querySelectorAll('[name=priority]')
      .forEach((input) => (input.checked = input.value === priority));
    for (const axis of ['X', 'Y', 'Z'])
      document.getElementById('aacd-volume' + axis).value =
        request['capacidade_' + axis.toLowerCase()];
    forms[1]
      .querySelectorAll('[name=materials]')
      .forEach(
        (input) => (input.checked = request.materials.includes(input.value))
      );
    forms[1]
      .querySelectorAll('[name=nozzles]')
      .forEach(
        (input) =>
          (input.checked = request.nozzles.includes(Number(input.value)))
      );
    document.getElementById('aacd-order-url').value = request.link;
    document.getElementById('aacd-order-notes').value =
      request.observacoes || '';
  }
  function renderDemandSummary(draft) {
    document.getElementById('aacd-demand-code').textContent = draft.code;
    document.getElementById('aacd-demand-material').textContent =
      draft.materials.join(', ');
    document.querySelector('#aacd-demand-volume span').textContent =
      `${draft.volumes.X}×${draft.volumes.Y}×${draft.volumes.Z} mm`;
    document.querySelector('[data-demand-unit]').textContent =
      sessionUser?.unidade || '';
    document.querySelector('[data-demand-priority]').textContent =
      draft.priority;
  }
  function validateStep(step) {
    const form = forms[step - 1];
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
        valid = ['http:', 'https:'].includes(new URL(input.value).protocol);
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
      (!form.querySelector('[name=materials]:checked') ||
        !form.querySelector('[name=nozzles]:checked'))
    ) {
      navigate('aacd-pedido-2');
      form.querySelector('.form-error').textContent =
        'Selecione pelo menos um material e um bico disponível.';
      return false;
    }
    return true;
  }
  async function showRecommendations(draft, requestId) {
    const actor = sessionKey(),
      requestedRevision = revision;
    const records = await data.listMatches(requestId ? { requestId } : draft);
    if (actor !== sessionKey() || requestedRevision !== revision) return;
    matches = records;
    renderMatches(matches);
    renderDemandSummary(draft);
    feedback.textContent = matches.length
      ? ''
      : 'Nenhuma impressora homologada atende aos requisitos. Revise materiais, bicos e dimensões.';
    navigate('aacd-conectar');
  }
  async function resumeRequest(button) {
    button.disabled = true;
    const actor = sessionKey(),
      requestedRevision = ++revision;
    try {
      const request = await data.getRequest(button.dataset.resumeRequest);
      if (actor !== sessionKey() || requestedRevision !== revision) return;
      populateRequestForm(request);
      await showRecommendations(readDraft(), request.id);
    } catch (error) {
      document.getElementById('aacd-orders-feedback').textContent =
        error.message;
    } finally {
      button.disabled = false;
    }
  }
  function renderOpenRequest(request) {
    const row = document.createElement('article');
    const label = document.createElement('span');
    const button = document.createElement('button');
    const status =
      request.ultimo_status === 'recusado'
        ? 'Recusado; escolha outro parceiro'
        : 'Aguardando encaminhamento';
    label.textContent =
      (request.codigo || 'SOL-' + request.id) + ' — ' + status;
    button.type = 'button';
    button.className = 'btn-back';
    button.textContent = 'Selecionar parceiro';
    button.dataset.resumeRequest = request.id;
    row.append(label, button);
    return row;
  }
  async function refreshOpenRequests() {
    const actor = sessionKey();
    const requests = await data.listRequests();
    if (actor !== sessionKey()) return;
    const open = requests.filter(
      (request) =>
        !request.encerrada_em &&
        !['pendente', 'em_producao'].includes(request.ultimo_status)
    );
    openPanel.hidden = !open.length;
    openList.replaceChildren(...open.map(renderOpenRequest));
  }
  async function submitStep(event, step) {
    event.preventDefault();
    if (activeSection !== `aacd-pedido-${step}` || !validateStep(step)) return;
    if (step < 3) {
      navigate(`aacd-pedido-${step + 1}`);
      return;
    }
    if (!validateStep(1) || !validateStep(2)) return;
    const form = forms[step - 1],
      button = form.querySelector('[type=submit]');
    button.disabled = true;
    try {
      await showRecommendations(readDraft());
    } catch (error) {
      form.querySelector('.form-error').textContent = error.message;
    } finally {
      button.disabled = false;
    }
  }
  function toggleMatchDetails(button) {
    const detail = document.getElementById(
      button.getAttribute('aria-controls')
    );
    detail.hidden = !detail.hidden;
    button.setAttribute('aria-expanded', String(!detail.hidden));
    button.textContent = detail.hidden
      ? 'Ver Ficha Técnica'
      : 'Ocultar Ficha Técnica';
  }
  async function connectOrder(button) {
    if (![1, 2, 3].every(validateStep)) return;
    const draft = readDraft();
    const match = matches.find(
      (record) => record.id === button.dataset.connectOrder
    );
    if (!match) return;
    const actor = sessionKey();
    button.disabled = true;
    try {
      await data.createOrder({
        ...draft,
        selection: {
          partnerId: match.partnerId,
          printerId: match.printerId,
          material: match.material,
          nozzle: match.nozzle
        }
      });
      if (actor !== sessionKey()) return;
      resetOrderFilters();
      await onOrdersChanged();
      feedback.textContent = '';
      matches = [];
      renderMatches(matches);
      document.getElementById('aacd-orders-feedback').textContent =
        `${draft.code} conectado a ${match.name}. Pedido salvo e disponível para o parceiro.`;
      navigate('aacd-pedidos');
    } catch (error) {
      feedback.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  }
  function onDraftInput(event) {
    revision++;
    matches = [];
    if ('setCustomValidity' in event.target) event.target.setCustomValidity('');
    const error = event.currentTarget.querySelector('.form-error');
    if (error) error.textContent = '';
  }
  forms.forEach((form, index) => {
    form.addEventListener('input', onDraftInput);
    form.addEventListener('submit', (event) => submitStep(event, index + 1));
  });
  openList.addEventListener('click', (event) => {
    const button = event.target.closest('[data-resume-request]');
    if (button) resumeRequest(button);
  });
  matchList.addEventListener('click', (event) => {
    const detail = event.target.closest('[data-match-detail]');
    if (detail) {
      toggleMatchDetails(detail);
      return;
    }
    const button = event.target.closest('[data-connect-order]');
    if (button) connectOrder(button);
  });
  function clear() {
    revision++;
    matches = [];
    renderMatches(matches);
    forms.forEach((form) => {
      form.reset();
      form
        .querySelectorAll('input')
        .forEach((input) => input.setCustomValidity(''));
      form
        .querySelectorAll('.form-error')
        .forEach((error) => (error.textContent = ''));
    });
    for (const selector of [
      '#aacd-demand-code',
      '#aacd-demand-material',
      '#aacd-demand-volume span',
      '[data-demand-unit]',
      '[data-demand-priority]'
    ]) {
      document.querySelector(selector).textContent = '';
    }
    openList.replaceChildren();
    openPanel.hidden = true;
    feedback.textContent = '';
  }
  return { refreshOpenRequests, clear };
}
