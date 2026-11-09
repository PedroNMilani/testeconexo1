'use strict';

// Dados e ações demonstrativos. A interface não autentica nem envia solicitações
// a laboratórios ou serviços externos; as alterações duram apenas nesta aba.
const aacdSections = new Set(['aacd-inicio', 'aacd-pedidos', 'aacd-parceiros', 'aacd-homologacao', 'aacd-pedido-1', 'aacd-pedido-2', 'aacd-pedido-3', 'aacd-conectar', 'aacd-perfil']);
const aacdOrderForms = [1, 2, 3].map(n => document.getElementById(`aacd-order-step-${n}`));
const aacdOrderList = document.getElementById('aacd-order-list');
const aacdOrderTemplate = aacdOrderList.firstElementChild.cloneNode(true);
const aacdNetwork = document.getElementById('aacd-network-grid');
const aacdNetworkTemplate = aacdNetwork.firstElementChild.cloneNode(true);
const aacdProfileForm = document.getElementById('aacd-profile-form');
const aacdOrderSearch = document.getElementById('aacd-order-search');
const aacdMaterialFilter = document.getElementById('aacd-filter-material');
const aacdPriorityFilter = document.getElementById('aacd-filter-priority');
let aacdStatusFilter = 'all';
let aacdCurrentPage = 1;
let aacdTotalOrders = 42;
let aacdCreatedSequence = 2000;
let aacdSavedProfile = null;
let aacdDraft = null;
const aacdSubmittedCodes = new Set();

function syncAacdHeader() {
  document.getElementById('aacd-header').hidden = !aacdSections.has(activeSection);
  const group = activeSection === 'aacd-homologacao' ? 'aacd-parceiros'
    : ['aacd-pedido-1', 'aacd-pedido-2', 'aacd-pedido-3', 'aacd-conectar'].includes(activeSection) ? 'aacd-pedidos'
    : activeSection;
  document.querySelectorAll('.aacd-nav [data-section]').forEach(link => {
    if (link.dataset.section === group) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  bootstrap.Dropdown.getInstance(document.getElementById('aacd-account-button'))?.hide();
}
document.addEventListener('conexo:navigate', syncAacdHeader);
syncAacdHeader();

document.addEventListener('conexo:aacd-login', event => {
  if (!document.getElementById('aacd-profile-email').value) {
    document.getElementById('aacd-profile-email').value = event.detail.email;
  }
});
document.getElementById('aacd-logout').addEventListener('click', () => {
  document.querySelector('#login [name="password"]').value = '';
  navigate('login', { mode: 'aacd' });
});

function aacdNormalize(value) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
}

function aacdFilteredOrders() {
  const search = aacdNormalize(aacdOrderSearch.value.trim());
  const material = aacdNormalize(aacdMaterialFilter.value);
  return [...aacdOrderList.querySelectorAll('[data-aacd-order]')].filter(row => {
    const stateMatches = aacdStatusFilter === 'all' || row.dataset.status === aacdStatusFilter;
    return stateMatches && aacdNormalize(row.textContent).includes(search)
      && aacdNormalize(row.dataset.material).includes(material)
      && (!aacdPriorityFilter.value || row.dataset.priority === aacdPriorityFilter.value);
  });
}

function refreshAacdOrders({ resetPage = false } = {}) {
  if (resetPage) aacdCurrentPage = 1;
  const filtered = aacdFilteredOrders();
  const maxPage = Math.max(1, Math.ceil(filtered.length / 4));
  aacdCurrentPage = Math.min(aacdCurrentPage, maxPage);
  const visible = new Set(filtered.slice((aacdCurrentPage - 1) * 4, aacdCurrentPage * 4));
  aacdOrderList.querySelectorAll('[data-aacd-order]').forEach(row => { row.hidden = !visible.has(row); });
  document.getElementById('aacd-order-empty').hidden = filtered.length !== 0;
  const hasFilters = aacdStatusFilter !== 'all' || aacdOrderSearch.value.trim() || aacdMaterialFilter.value || aacdPriorityFilter.value;
  document.getElementById('aacd-order-count').textContent = hasFilters
    ? `Exibindo ${visible.size} de ${filtered.length} pedidos encontrados nesta demonstração`
    : `Exibindo ${visible.size} de ${aacdTotalOrders} ordens homologadas na rede CoNexo`;
  document.querySelectorAll('[data-aacd-page]').forEach(button => {
    const page = button.dataset.aacdPage;
    button.disabled = page === 'previous' ? aacdCurrentPage <= 1 : page === 'next' ? aacdCurrentPage >= maxPage : Number(page) > maxPage;
    if (Number(page) === aacdCurrentPage) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
}

for (const control of [aacdOrderSearch, aacdMaterialFilter, aacdPriorityFilter]) {
  control.addEventListener('input', () => refreshAacdOrders({ resetPage: true }));
}
document.querySelectorAll('[data-aacd-tab]').forEach(button => button.addEventListener('click', () => {
  aacdStatusFilter = button.dataset.aacdTab;
  document.querySelectorAll('[data-aacd-tab]').forEach(tab => tab.setAttribute('aria-pressed', String(tab === button)));
  refreshAacdOrders({ resetPage: true });
}));
document.getElementById('aacd-clear-filters').addEventListener('click', () => {
  aacdOrderSearch.value = '';
  aacdMaterialFilter.value = '';
  aacdPriorityFilter.value = '';
  document.querySelector('[data-aacd-tab="all"]').click();
});
document.querySelectorAll('[data-aacd-page]').forEach(button => button.addEventListener('click', () => {
  const requested = button.dataset.aacdPage;
  aacdCurrentPage = requested === 'next' ? aacdCurrentPage + 1 : requested === 'previous' ? aacdCurrentPage - 1 : Number(requested);
  refreshAacdOrders();
}));

aacdOrderList.addEventListener('click', event => {
  const button = event.target.closest('[data-aacd-detail]');
  if (!button) return;
  const detail = document.getElementById(button.getAttribute('aria-controls'));
  detail.hidden = !detail.hidden;
  button.setAttribute('aria-expanded', String(!detail.hidden));
});

document.getElementById('aacd-export').addEventListener('click', () => {
  const cell = value => {
    let text = String(value).replace(/\r?\n/g, ' ');
    if (/^[=+@-]/.test(text)) text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
  };
  const rows = [['Pedido', 'Dispositivo', 'Polo', 'Material', 'Situação', 'Prioridade']];
  for (const row of aacdFilteredOrders()) rows.push([
    row.querySelector('.aacd-order-info>small').textContent.replace(' •', ''),
    row.querySelector('h2').textContent, row.dataset.lab, row.dataset.material,
    row.querySelector('.aacd-status').textContent, row.dataset.priority
  ]);
  const blob = new Blob(['\ufeff' + rows.map(row => row.map(cell).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'pedidos-aacd.csv';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  document.getElementById('aacd-orders-feedback').textContent = `${rows.length - 1} pedidos exportados conforme os filtros selecionados.`;
});

function filterAacdPartners() {
  const search = aacdNormalize(document.getElementById('aacd-partner-search').value.trim());
  let count = 0;
  aacdNetwork.querySelectorAll('.aacd-network-card').forEach(card => {
    card.hidden = !aacdNormalize(card.textContent).includes(search);
    if (!card.hidden) count++;
  });
  document.getElementById('aacd-partner-empty').hidden = count > 0;
}
document.getElementById('aacd-partner-search').addEventListener('input', filterAacdPartners);

// A fila expandida e a fila recolhida do Figma usam a mesma seção e os mesmos
// elementos details. Nenhum formulário ou tela é reconstruído ao navegar.
function syncReviewVisibility() {
  const reviews = [...document.querySelectorAll('.aacd-review')];
  const expanded = reviews.find(review => review.open);
  reviews.forEach(review => { review.hidden = Boolean(expanded && review !== expanded); });
}
document.getElementById('aacd-review-list').addEventListener('toggle', event => {
  if (event.target.matches('.aacd-review')) syncReviewVisibility();
}, true);

document.getElementById('aacd-review-list').addEventListener('click', event => {
  const button = event.target.closest('[data-review-action]');
  if (!button) return;
  const candidate = button.closest('[data-candidate]');
  const name = candidate.querySelector('h2').textContent;
  const approved = button.dataset.reviewAction === 'approve';
  if (approved) {
    const card = aacdNetworkTemplate.cloneNode(true);
    card.querySelector('h2').textContent = name;
    const location = card.querySelector('.network-card-header p');
    location.lastChild.textContent = 'São Paulo, SP • Butantã';
    card.querySelector('.aacd-status').textContent = '● Homologado';
    const info = card.querySelectorAll('.network-info strong');
    info[0].textContent = '4 Impressoras FDM';
    info[1].textContent = 'Engenharia Biomédica';
    card.querySelector('.network-materials p').textContent = 'Materiais sujeitos à validação clínica AACD';
    aacdNetwork.append(card);
    document.querySelectorAll('[data-homologated-count]').forEach(count => { count.textContent = Number(count.textContent) + 1; });
    filterAacdPartners();
  }
  candidate.remove();
  syncReviewVisibility();
  const queueCount = document.getElementById('aacd-review-count');
  queueCount.textContent = Math.max(0, Number(queueCount.textContent) - 1);
  document.getElementById('aacd-review-feedback').textContent = `${name}: cadastro ${approved ? 'homologado' : 'rejeitado'} nesta demonstração.`;
});

// Etapas do pedido: validar a seção ativa e preservar os controles ao voltar.
for (const axis of ['X', 'Y', 'Z']) {
  const input = document.getElementById('aacd-volume' + axis);
  input.min = '1'; input.max = '10000'; input.step = '0.1';
}
aacdOrderForms[1].querySelectorAll('[name="nozzles"]').forEach(input => { input.checked = true; });
function validateAacdStep(step) {
  const form = aacdOrderForms[step - 1];
  if (step === 1) {
    const input = document.getElementById('aacd-order-code');
    input.setCustomValidity(input.value.trim() ? '' : 'Informe o nome ou código do pedido.');
  }
  if (step === 3) {
    const input = document.getElementById('aacd-order-url');
    let valid = false;
    try { valid = ['https:', 'http:'].includes(new URL(input.value).protocol); } catch { /* campo inválido */ }
    input.setCustomValidity(valid ? '' : 'Informe um link HTTP ou HTTPS válido para o arquivo.');
  }
  if (!form.checkValidity()) {
    navigate(`aacd-pedido-${step}`);
    form.reportValidity();
    return false;
  }
  if (step === 2 && (!form.querySelector('[name="materials"]:checked') || !form.querySelector('[name="nozzles"]:checked'))) {
    navigate('aacd-pedido-2');
    form.querySelector('.form-error').textContent = 'Selecione pelo menos um material e um bico disponível.';
    return false;
  }
  return true;
}

function readAacdDraft() {
  const technical = aacdOrderForms[1];
  return {
    code: document.getElementById('aacd-order-code').value.trim(),
    priority: aacdOrderForms[0].querySelector('[name="priority"]:checked').value,
    materials: [...technical.querySelectorAll('[name="materials"]:checked')].map(input => input.value),
    nozzles: [...technical.querySelectorAll('[name="nozzles"]:checked')].map(input => input.value),
    volumes: ['X', 'Y', 'Z'].map(axis => document.getElementById('aacd-volume' + axis).value),
    url: document.getElementById('aacd-order-url').value,
    notes: document.getElementById('aacd-order-notes').value
  };
}
for (const [index, form] of aacdOrderForms.entries()) {
  form.addEventListener('input', event => {
    if ('setCustomValidity' in event.target) event.target.setCustomValidity('');
    const error = form.querySelector('.form-error');
    if (error) error.textContent = '';
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (activeSection !== `aacd-pedido-${index + 1}`) return;
    if (!validateAacdStep(index + 1)) return;
    if (index < 2) navigate(`aacd-pedido-${index + 2}`);
    else {
      if (!validateAacdStep(1) || !validateAacdStep(2)) return;
      aacdDraft = readAacdDraft();
      document.getElementById('aacd-demand-code').textContent = aacdDraft.code;
      document.getElementById('aacd-demand-material').textContent = aacdDraft.materials.join(', ');
      document.querySelector('#aacd-demand-volume span').textContent = aacdDraft.volumes.join('×') + ' mm';
      document.getElementById('aacd-connect-feedback').textContent = '';
      navigate('aacd-conectar');
    }
  });
}

document.getElementById('aacd-match-list').addEventListener('click', event => {
  const detailButton = event.target.closest('[data-match-detail]');
  if (detailButton) {
    const detail = document.getElementById(detailButton.getAttribute('aria-controls'));
    detail.hidden = !detail.hidden;
    detailButton.setAttribute('aria-expanded', String(!detail.hidden));
    detailButton.textContent = detail.hidden ? 'Ver Ficha Técnica' : 'Ocultar Ficha Técnica';
    return;
  }
  const button = event.target.closest('[data-connect-order]');
  if (!button) return;
  // Impede envio incompleto inclusive ao abrir a seção diretamente pelo endereço.
  if (![1, 2, 3].every(validateAacdStep)) return;
  aacdDraft = readAacdDraft();
  if (aacdSubmittedCodes.has(aacdDraft.code)) {
    document.getElementById('aacd-connect-feedback').textContent = 'Este código de pedido já foi conectado nesta demonstração. Use outro código para criar um novo pedido.';
    return;
  }
  const card = button.closest('[data-match]');
  const lab = card.querySelector('h2').childNodes[0].textContent.trim();
  const row = aacdOrderTemplate.cloneNode(true);
  const id = String(++aacdCreatedSequence);
  row.dataset.aacdOrder = id;
  row.dataset.status = 'pending';
  row.dataset.lab = lab;
  row.dataset.material = aacdDraft.materials.join(', ');
  row.dataset.priority = aacdDraft.priority;
  row.querySelector('.aacd-order-info>small').textContent = aacdDraft.code + ' •';
  row.querySelector('h2').textContent = 'Órtese Dinâmica AFO';
  const urgent = row.querySelector('.urgent-tag');
  urgent.hidden = aacdDraft.priority !== 'Urgente';
  const labParagraph = row.querySelector('.aacd-order-info p');
  labParagraph.lastChild.textContent = lab;
  row.querySelector('.aacd-order-info>small:last-child').textContent = 'Material: ' + row.dataset.material;
  const status = row.querySelector('.aacd-status');
  status.className = 'aacd-status';
  status.textContent = 'Aguardando aceite';
  row.querySelector('.aacd-order-state>small').textContent = 'Enviado nesta demonstração';
  const detail = row.querySelector('.aacd-order-detail');
  detail.id = `aacd-order-detail-${id}`;
  detail.replaceChildren();
  for (const [label, value] of [['Pedido', aacdDraft.code], ['Laboratório', lab], ['Material', row.dataset.material], ['Volume', aacdDraft.volumes.join('×') + ' mm'], ['Bicos', aacdDraft.nozzles.join(', ') + ' mm'], ['Prioridade', aacdDraft.priority], ['Observações', aacdDraft.notes || 'Não informadas']]) {
    const paragraph = document.createElement('p');
    const title = document.createElement('strong');
    title.textContent = label + ': ';
    paragraph.append(title, value);
    detail.append(paragraph);
  }
  const anchor = document.createElement('a');
  anchor.href = aacdDraft.url;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
  anchor.textContent = 'Abrir arquivo do pedido';
  detail.append(anchor);
  const trigger = row.querySelector('[data-aacd-detail]');
  trigger.setAttribute('aria-controls', detail.id);
  trigger.setAttribute('aria-label', `Detalhes do pedido ${aacdDraft.code}`);
  aacdOrderList.prepend(row);
  aacdSubmittedCodes.add(aacdDraft.code);
  aacdTotalOrders++;
  const metric = document.getElementById('aacd-metric-open');
  metric.textContent = String(Number(metric.textContent) + 1).padStart(2, '0');
  aacdOrderSearch.value = '';
  aacdMaterialFilter.value = '';
  aacdPriorityFilter.value = '';
  document.querySelector('[data-aacd-tab="all"]').click();
  refreshAacdOrders({ resetPage: true });
  document.getElementById('aacd-orders-feedback').textContent = `${aacdDraft.code} conectado a ${lab} nesta demonstração. Nenhum envio real foi realizado.`;
  navigate('aacd-pedidos');
});

aacdProfileForm.addEventListener('submit', event => {
  event.preventDefault();
  if (!aacdProfileForm.reportValidity()) return;
  const name = document.getElementById('aacd-profile-name');
  if (!name.value.trim()) { name.setCustomValidity('Informe o nome do responsável.'); name.reportValidity(); return; }
  aacdSavedProfile = Object.fromEntries(new FormData(aacdProfileForm));
  document.querySelector('[data-aacd-account]').textContent = name.value;
  document.getElementById('aacd-perfil-titulo').textContent = name.value;
  document.getElementById('aacd-profile-feedback').textContent = 'Perfil AACD atualizado nesta demonstração.';
});
aacdProfileForm.addEventListener('input', () => document.getElementById('aacd-profile-name').setCustomValidity(''));
document.getElementById('aacd-profile-cancel').addEventListener('click', () => {
  if (aacdSavedProfile) {
    for (const [name, value] of Object.entries(aacdSavedProfile)) aacdProfileForm.elements.namedItem(name).value = value;
  } else aacdProfileForm.reset();
  document.getElementById('aacd-profile-feedback').textContent = '';
  navigate('aacd-inicio');
});
refreshAacdOrders();
