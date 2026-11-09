(async () => {
const data = await dataReady;
const partnerSections = new Set(['parceiro-inicio', 'parceiro-pedidos', 'parceiro-impressora', 'parceiro-perfil']);
const printerForm = document.getElementById('printer-form');
const profileForm = document.getElementById('partner-profile-form');
const printerGrid = document.getElementById('printer-grid');
let selectedPrinter = null;
const instance = id => document.getElementById(id).content.firstElementChild.cloneNode(true);
const text = (root, selector, value) => { root.querySelector(selector).textContent = value ?? ''; };
function tail(node, value) {
  [...node.childNodes].filter(child => child.nodeType === Node.TEXT_NODE).forEach(child => child.remove());
  node.append(value);
}
function renderPrinter(record) {
  const card = instance('printer-template');
  card.dataset.printerId = record.id;
  card.querySelectorAll('[data-edit-printer]').forEach(button => { button.dataset.editPrinter = record.id; });
  card.querySelector('.edit-printer').setAttribute('aria-label', `Editar ${record.name}`);
  text(card, '[data-printer-name]', record.name);
  text(card, '[data-art-label]', record.label);
  card.querySelector('.printer-art img').src = `assets/partner-${record.asset}.svg`;
  card.querySelector('.printer-art').classList.toggle('blue', record.asset === 'creality');
  const availability = card.querySelector('.availability');
  availability.classList.toggle('available', record.available);
  tail(availability, record.available ? 'Disponível' : 'Indisponível');
  text(card, '.printer-id', `ID: IMP-${record.id.padStart(2, '0')} • ${record.kind}`);
  text(card, '[data-printer-material]', record.materials.map(material => record.materialLabels?.[material] || material).join(', '));
  text(card, '[data-printer-nozzle]', `${record.nozzles.join(' / ')}mm • Pronto`);
  return card;
}
async function renderPrinters() {
  const printers = await data.listPrinters();
  printerGrid.replaceChildren(...printers.map(renderPrinter));
  document.getElementById('printer-count').textContent = printers.length;
  document.getElementById('connected-count').textContent = `${printers.length} conectadas`;
  document.getElementById('next-printer').hidden = printers.length < 2;
}
function renderPartnerOrder(order) {
  const active = order.status === 'active';
  const card = instance(active ? 'active-order-template' : 'pending-order-template');
  card.dataset.orderId = order.id;
  card.dataset.state = order.status;
  text(card, 'h3', `Pedido ${order.code}`);
  text(card, '.order-heading p', `Solicitado por: ${order.requester || 'AACD'}`);
  const values = card.querySelectorAll('.order-data strong');
  [order.device, order.material, active ? order.started : order.deadline, order.deadline].forEach((value, i) => {
    if (values[i]) values[i].textContent = value || '';
  });
  if (!active) {
    const priority = card.querySelector('.order-status.urgent');
    priority.className = `order-status ${order.priority === 'Urgente' ? 'urgent' : 'standard'}`;
    priority.textContent = order.priority;
  }
  const detail = card.querySelector('.order-extra');
  detail.id = `order-details-${order.id}`;
  detail.querySelectorAll('p').forEach((paragraph, i) => {
    paragraph.querySelector('strong').textContent = ['Pedido: ', 'Solicitante: ', 'Dispositivo: ', 'Material: ', 'Prazo: '][i];
    tail(paragraph, [order.code, order.requester || 'AACD', order.device, order.material, order.deadline][i]);
  });
  card.querySelector('[data-order-action="details"]').setAttribute('aria-controls', detail.id);
  return card;
}
async function renderPartnerOrders() {
  const orders = await data.listOrders({ partnerId: 'current-partner' });
  for (const [type, state] of [['active', 'active'], ['pending', 'pending']]) {
    const records = orders.filter(order => order.status === state);
    const list = document.getElementById(`${type}-orders`);
    list.querySelectorAll('.order-card').forEach(card => card.remove());
    list.prepend(...records.map(renderPartnerOrder));
    document.getElementById(`${type}-orders-count`).textContent = records.length;
    list.querySelector('.order-empty').hidden = records.length > 0;
    document.getElementById(type === 'active' ? 'service-count' : 'pending-count').textContent = records.length;
  }
}
async function renderHistory() {
  const history = await data.listHistory();
  document.getElementById('production-history').replaceChildren(...history.map(record => {
    const row = instance('history-template');
    text(row, '.history-id', '#' + record.id);
    text(row, 'strong', record.device);
    text(row, '.history-material', record.material);
    const status = row.querySelector('.history-status');
    status.className = 'history-status ' + record.status;
    status.querySelector('img').src = `assets/partner-${record.status === 'done' ? 'done' : record.status === 'cancelled' ? 'cancelled' : 'pending'}.svg`;
    tail(status, { done: 'Concluído', cancelled: 'Cancelado', pending: 'Em andamento' }[record.status]);
    text(row, '.history-date', record.date);
    return row;
  }));
}
async function renderPartner() { await Promise.all([renderPrinters(), renderPartnerOrders(), renderHistory()]); }
function syncPartnerHeader() {
  document.getElementById('partner-header').hidden = !partnerSections.has(activeSection);
  document.querySelectorAll('.partner-nav [data-section]').forEach(link => {
    if (link.dataset.section === activeSection) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  bootstrap.Dropdown.getInstance(document.getElementById('account-button'))?.hide();
}
document.addEventListener('conexo:navigate', syncPartnerHeader);
document.addEventListener('conexo:data-changed', renderPartner);
syncPartnerHeader();
document.addEventListener('conexo:partner-login', async event => {
  const profile = await data.getProfile('partner');
  if (!profile['profile-email']) {
    await data.saveProfile('partner', { ...profile, 'profile-email': event.detail.email });
    profileForm.elements.namedItem('profile-email').value = event.detail.email;
  }
});
document.querySelector('[data-logout]').addEventListener('click', () => {
  document.querySelector('#login [name="password"]').value = '';
  navigate('login', { mode: 'parceiro' });
});
async function openPrinter(id) {
  selectedPrinter = id;
  const record = id ? await data.getPrinter(id) : null;
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
  for (const axis of ['X', 'Y', 'Z']) printerForm.elements.namedItem('edit-volume' + axis).value = record?.volumes[axis] || '';
  printerForm.querySelectorAll('[name="materials"]').forEach(input => { input.checked = record?.materials.includes(input.value) || false; });
  printerForm.querySelectorAll('[name="nozzles"]').forEach(input => { input.checked = (record?.nozzles || ['0.2', '0.4', '0.6', '0.8']).includes(input.value); });
  document.getElementById('edit-needs-material').value = record?.needsMaterial || '';
  navigate('parceiro-impressora');
}
document.addEventListener('click', event => {
  const edit = event.target.closest('[data-edit-printer]');
  if (edit) openPrinter(edit.dataset.editPrinter);
});
document.getElementById('add-printer').addEventListener('click', () => openPrinter(null));
printerForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (!printerForm.reportValidity()) return;
  const materials = [...printerForm.querySelectorAll('[name="materials"]:checked')].map(input => input.value);
  const nozzles = [...printerForm.querySelectorAll('[name="nozzles"]:checked')].map(input => input.value);
  if (!materials.length || !nozzles.length) {
    printerForm.querySelector('.form-error').textContent = 'Selecione pelo menos um material e um bico disponível.';
    return;
  }
  const creating = selectedPrinter === null;
  const previous = creating ? {} : await data.getPrinter(selectedPrinter);
  const record = await data.savePrinter({ ...previous,
    ...(creating ? { name: document.getElementById('new-printer-name').value.trim(), asset: 'bambu', label: 'BAMBU LAB COREXY', kind: 'FDM Industrial', available: true } : {}),
    materials, nozzles,
    volumes: Object.fromEntries(['X', 'Y', 'Z'].map(axis => [axis, printerForm.elements.namedItem('edit-volume' + axis).value])),
    needsMaterial: document.getElementById('edit-needs-material').value
  });
  await renderPrinters();
  document.getElementById('printer-feedback').textContent = `${record.name}: ${creating ? 'adicionada' : 'atualizada'} nesta demonstração.`;
  navigate('parceiro-inicio');
});
document.getElementById('remove-printer').addEventListener('click', async () => {
  const record = await data.removePrinter(selectedPrinter);
  if (!record) return;
  await renderPrinters();
  document.getElementById('printer-feedback').textContent = `${record.name}: removida nesta demonstração.`;
  navigate('parceiro-inicio');
});
document.getElementById('next-printer').addEventListener('click', () => {
  if (matchMedia('(max-width: 600px)').matches) {
    const atEnd = printerGrid.scrollLeft + printerGrid.clientWidth >= printerGrid.scrollWidth - 2;
    printerGrid.scrollTo({ left: atEnd ? 0 : printerGrid.scrollLeft + printerGrid.clientWidth + 16, behavior: 'smooth' });
  } else if (printerGrid.firstElementChild) printerGrid.append(printerGrid.firstElementChild);
});
profileForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (!profileForm.reportValidity()) return;
  const institution = profileForm.elements.namedItem('profile-institution');
  if (!institution.value.trim()) { institution.setCustomValidity('Informe o nome da instituição.'); institution.reportValidity(); return; }
  const profile = await data.saveProfile('partner', Object.fromEntries(new FormData(profileForm)));
  document.querySelector('[data-account-name]').textContent = profile['profile-institution'];
  document.getElementById('parceiro-perfil-titulo').textContent = profile['profile-institution'];
  document.getElementById('parceiro-inicio-titulo').textContent = profile['profile-institution'];
  document.getElementById('profile-feedback').textContent = 'Perfil atualizado nesta demonstração.';
});
profileForm.addEventListener('input', () => profileForm.elements.namedItem('profile-institution').setCustomValidity(''));
async function renderPartnerProfile() {
  const profile = await data.getProfile('partner');
  for (const [name, value] of Object.entries(profile)) {
    const control = profileForm.elements.namedItem(name);
    if (control) control.value = value;
  }
}
document.getElementById('cancel-profile').addEventListener('click', async () => {
  await renderPartnerProfile();
  document.getElementById('profile-feedback').textContent = '';
  navigate('parceiro-inicio');
});
document.getElementById('parceiro-pedidos').addEventListener('click', async event => {
  const button = event.target.closest('[data-order-action]');
  if (!button) return;
  const action = button.dataset.orderAction;
  if (action === 'details') {
    const detail = document.getElementById(button.getAttribute('aria-controls'));
    detail.hidden = !detail.hidden;
    button.setAttribute('aria-expanded', String(!detail.hidden));
    button.textContent = detail.hidden ? 'Visualizar Detalhes' : 'Ocultar Detalhes';
    return;
  }
  const order = await data.getOrder(button.closest('[data-order-id]').dataset.orderId);
  if (!order) return;
  if (action === 'accept') await data.saveOrder({ ...order, status: 'active' });
  else {
    await data.saveOrder({ ...order, status: action === 'complete' ? 'done' : 'cancelled' });
    await data.addHistory({ id: order.id, device: order.device, material: order.material, status: action === 'complete' ? 'done' : 'cancelled', date: new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' }).format(new Date()) });
  }
  await Promise.all([renderPartnerOrders(), renderHistory()]);
  document.dispatchEvent(new CustomEvent('conexo:data-changed'));
  document.getElementById('orders-feedback').textContent = `Pedido #${order.id} ${action === 'accept' ? 'aceito' : action === 'complete' ? 'concluído' : 'recusado'} nesta demonstração.`;
});
await Promise.all([renderPartner(), renderPartnerProfile()]);
})();
