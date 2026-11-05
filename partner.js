'use strict';

// Demonstração em memória: as alterações não são enviadas a um servidor.
const partnerSections = new Set(['parceiro-inicio', 'parceiro-pedidos', 'parceiro-impressora', 'parceiro-perfil']);
const printerRecords = new Map([
  ['1', { name: 'Bambu Lab X1-Carbon', asset: 'bambu', label: 'BAMBU LAB COREXY', kind: 'FDM Industrial' }],
  ['2', { name: 'Creality Ender 3 S1 Pro', asset: 'creality', label: 'CREALITY FDM STANDBY', kind: 'FDM Standby' }],
  ['3', { name: 'Anycubic Photon Mono X', asset: 'resin', label: 'ANYCUBIC MONO SLA', kind: 'SLA Resina' }]
]);
let printerSequence = 3;
let selectedPrinter = '1';
let savedProfile = null;
const printerForm = document.getElementById('printer-form');
const profileForm = document.getElementById('partner-profile-form');
const printerGrid = document.getElementById('printer-grid');
const printerTemplate = printerGrid.firstElementChild.cloneNode(true);
const historyTemplate = document.querySelector('.history-row').cloneNode(true);
printerForm.querySelectorAll('[name="nozzles"]').forEach(input => { input.checked = true; });

function syncPartnerHeader() {
  document.getElementById('partner-header').hidden = !partnerSections.has(activeSection);
  document.querySelectorAll('.partner-nav [data-section]').forEach(link => {
    if (link.dataset.section === activeSection) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  const menuButton = document.getElementById('account-button');
  bootstrap.Dropdown.getInstance(menuButton)?.hide();
}
document.addEventListener('conexo:navigate', syncPartnerHeader);
syncPartnerHeader();

document.addEventListener('conexo:partner-login', event => {
  if (!profileForm.elements.namedItem('profile-email').value) {
    profileForm.elements.namedItem('profile-email').value = event.detail.email;
  }
});

document.querySelector('[data-logout]').addEventListener('click', () => {
  document.querySelector('#login [name="password"]').value = '';
  navigate('login', { mode: 'parceiro' });
});

function openPrinter(id) {
  selectedPrinter = id;
  const record = printerRecords.get(id);
  const creating = !record;
  printerForm.reset();
  printerForm.querySelector('.form-error').textContent = '';
  document.getElementById('new-printer-fields').hidden = !creating;
  document.getElementById('new-printer-name').required = creating;
  document.getElementById('remove-printer').hidden = creating;
  document.getElementById('save-printer').textContent = creating ? 'Adicionar' : 'Atualizar';
  document.getElementById('parceiro-impressora-titulo').textContent = creating ? 'Adicionar impressora' : 'Sua impressora';
  document.getElementById('editor-name').textContent = record?.name || 'Nova impressora';
  document.getElementById('editor-id').textContent = record ? `ID: IMP-${id.padStart(2, '0')} • ${record.kind}` : 'Informe as especificações da impressora';
  const art = document.getElementById('editor-art');
  art.querySelector('img').src = `assets/partner-${record?.asset || 'bambu'}.svg`;
  art.querySelector('span').textContent = record?.label || 'BAMBU LAB COREXY';
  art.classList.toggle('blue', record?.asset === 'creality');
  for (const axis of ['X', 'Y', 'Z']) {
    printerForm.elements.namedItem('edit-volume' + axis).value = record?.volumes?.[axis] || '';
  }
  printerForm.querySelectorAll('[name="materials"]').forEach(input => {
    input.checked = record?.materials?.includes(input.value) || false;
  });
  printerForm.querySelectorAll('[name="nozzles"]').forEach(input => {
    input.checked = (record?.nozzles || ['0.2', '0.4', '0.6', '0.8']).includes(input.value);
  });
  document.getElementById('edit-needs-material').value = record?.needsMaterial || '';
  navigate('parceiro-impressora');
}

document.addEventListener('click', event => {
  const edit = event.target.closest('[data-edit-printer]');
  if (edit) openPrinter(edit.dataset.editPrinter);
});
document.getElementById('add-printer').addEventListener('click', () => openPrinter(null));

function updatePrinterCount() {
  document.getElementById('printer-count').textContent = printerRecords.size;
  document.getElementById('connected-count').textContent = `${printerRecords.size} conectadas`;
  document.getElementById('next-printer').hidden = printerRecords.size < 2;
}

printerForm.addEventListener('submit', event => {
  event.preventDefault();
  if (!printerForm.reportValidity()) return;
  const materials = [...printerForm.querySelectorAll('[name="materials"]:checked')].map(input => input.value);
  const nozzles = [...printerForm.querySelectorAll('[name="nozzles"]:checked')].map(input => input.value);
  if (!materials.length || !nozzles.length) {
    printerForm.querySelector('.form-error').textContent = 'Selecione pelo menos um material e um bico disponível.';
    return;
  }
  const creating = selectedPrinter === null;
  const id = creating ? String(++printerSequence) : selectedPrinter;
  const record = creating ? { name: document.getElementById('new-printer-name').value.trim(), asset: 'bambu', label: 'BAMBU LAB COREXY', kind: 'FDM Industrial' } : printerRecords.get(id);
  if (!record || !record.name) return;
  record.materials = materials;
  record.nozzles = nozzles;
  record.volumes = Object.fromEntries(['X', 'Y', 'Z'].map(axis => [axis, printerForm.elements.namedItem('edit-volume' + axis).value]));
  record.needsMaterial = document.getElementById('edit-needs-material').value;
  printerRecords.set(id, record);
  let card = printerGrid.querySelector(`[data-printer-id="${id}"]`);
  if (!card) {
    card = printerTemplate.cloneNode(true);
    card.dataset.printerId = id;
    card.querySelectorAll('[data-edit-printer]').forEach(button => { button.dataset.editPrinter = id; });
    card.querySelector('.edit-printer').setAttribute('aria-label', `Editar ${record.name}`);
    card.querySelector('[data-printer-name]').textContent = record.name;
    card.querySelector('.printer-id').textContent = `ID: IMP-${id.padStart(2, '0')} • ${record.kind}`;
    printerGrid.append(card);
  }
  card.querySelector('[data-printer-material]').textContent = materials.join(', ');
  card.querySelector('[data-printer-nozzle]').textContent = `${nozzles.join(' / ')} mm • Pronto`;
  updatePrinterCount();
  document.getElementById('printer-feedback').textContent = `${record.name}: ${creating ? 'adicionada' : 'atualizada'} nesta demonstração.`;
  navigate('parceiro-inicio');
});

document.getElementById('remove-printer').addEventListener('click', () => {
  const record = printerRecords.get(selectedPrinter);
  if (!record) return;
  printerGrid.querySelector(`[data-printer-id="${selectedPrinter}"]`)?.remove();
  printerRecords.delete(selectedPrinter);
  updatePrinterCount();
  document.getElementById('printer-feedback').textContent = `${record.name}: removida nesta demonstração.`;
  navigate('parceiro-inicio');
});

document.getElementById('next-printer').addEventListener('click', () => {
  if (matchMedia('(max-width: 600px)').matches) {
    const atEnd = printerGrid.scrollLeft + printerGrid.clientWidth >= printerGrid.scrollWidth - 2;
    printerGrid.scrollTo({ left: atEnd ? 0 : printerGrid.scrollLeft + printerGrid.clientWidth + 16, behavior: 'smooth' });
  } else if (printerGrid.firstElementChild) {
    printerGrid.append(printerGrid.firstElementChild);
  }
});

profileForm.addEventListener('submit', event => {
  event.preventDefault();
  if (!profileForm.reportValidity()) return;
  const institution = profileForm.elements.namedItem('profile-institution');
  if (!institution.value.trim()) {
    institution.setCustomValidity('Informe o nome da instituição.');
    institution.reportValidity();
    return;
  }
  savedProfile = Object.fromEntries(new FormData(profileForm));
  document.querySelector('[data-account-name]').textContent = institution.value;
  document.getElementById('parceiro-perfil-titulo').textContent = institution.value;
  document.getElementById('parceiro-inicio-titulo').textContent = institution.value;
  document.getElementById('profile-feedback').textContent = 'Perfil atualizado nesta demonstração.';
});
profileForm.addEventListener('input', () => profileForm.elements.namedItem('profile-institution').setCustomValidity(''));
document.getElementById('cancel-profile').addEventListener('click', () => {
  if (savedProfile) {
    for (const [name, value] of Object.entries(savedProfile)) profileForm.elements.namedItem(name).value = value;
  } else profileForm.reset();
  document.getElementById('profile-feedback').textContent = '';
  navigate('parceiro-inicio');
});

function addHistory(card, status) {
  const row = historyTemplate.cloneNode(true);
  row.querySelector('.history-id').textContent = `#${card.dataset.orderId}`;
  const values = card.querySelectorAll('.order-data strong');
  row.querySelector('strong').textContent = values[0].textContent;
  row.querySelector('.history-material').textContent = values[1].textContent;
  const statusElement = row.querySelector('.history-status');
  statusElement.className = `history-status ${status === 'Concluído' ? 'done' : 'cancelled'}`;
  statusElement.querySelector('img').src = `assets/partner-${status === 'Concluído' ? 'done' : 'cancelled'}.svg`;
  statusElement.lastChild.textContent = status;
  row.querySelector('.history-date').textContent = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' }).format(new Date());
  document.getElementById('production-history').prepend(row);
}

function updateOrders() {
  for (const type of ['active', 'pending']) {
    const list = document.getElementById(`${type}-orders`);
    const count = list.querySelectorAll('.order-card').length;
    document.getElementById(`${type}-orders-count`).textContent = count;
    list.querySelector('.order-empty').hidden = count > 0;
  }
}

document.getElementById('parceiro-pedidos').addEventListener('click', event => {
  const button = event.target.closest('[data-order-action]');
  if (!button) return;
  const card = button.closest('[data-order-id]');
  const action = button.dataset.orderAction;
  if (action === 'details') {
    const detail = document.getElementById(button.getAttribute('aria-controls'));
    detail.hidden = !detail.hidden;
    button.setAttribute('aria-expanded', String(!detail.hidden));
    button.textContent = detail.hidden ? 'Visualizar Detalhes' : 'Ocultar Detalhes';
    return;
  }
  if (action === 'accept') {
    card.dataset.state = 'active';
    card.querySelector('.order-refuse').remove();
    const status = card.querySelector('.order-status');
    status.className = 'order-status';
    status.textContent = 'EM PRODUÇÃO';
    card.querySelectorAll('.order-status.urgent, .order-status.standard').forEach(badge => badge.remove());
    button.dataset.orderAction = 'complete';
    button.textContent = 'Concluir Pedido';
    document.getElementById('active-orders').prepend(card);
  } else {
    addHistory(card, action === 'complete' ? 'Concluído' : 'Cancelado');
    card.remove();
  }
  if (action === 'accept' || action === 'refuse') {
    const metric = document.getElementById('pending-count');
    metric.textContent = Math.max(0, Number(metric.textContent) - 1);
  }
  const serviceMetric = document.getElementById('service-count');
  if (action === 'accept') serviceMetric.textContent = Number(serviceMetric.textContent) + 1;
  if (action === 'complete') serviceMetric.textContent = Math.max(0, Number(serviceMetric.textContent) - 1);
  updateOrders();
  document.getElementById('orders-feedback').textContent = `Pedido #${card.dataset.orderId} ${action === 'accept' ? 'aceito' : action === 'complete' ? 'concluído' : 'recusado'} nesta demonstração.`;
});
