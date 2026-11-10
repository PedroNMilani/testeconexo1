import { backendEnabled, sessionUser, sessionKey } from './auth-client.js';
import * as data from './data.js';
import { ORDER_STATUS, ORDER_STATUS_UI } from './data.js';
import { activeSection, navigate } from './router.js';
import { instance, text, tail, bindAreaHeader, bindProfile, bindLogout } from './shared-ui.js';

export async function initPartner() {
const partnerSections = new Set(['parceiro-inicio', 'parceiro-pedidos', 'parceiro-impressora', 'parceiro-perfil']);
const printerForm = document.getElementById('printer-form');
const printerGrid = document.getElementById('printer-grid');
let selectedPrinter = null;
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
  const actor=sessionKey();const printers = await data.listPrinters();
  if(backendEnabled&&actor!==sessionKey())return;
  printerGrid.replaceChildren(...printers.map(renderPrinter));
  document.getElementById('printer-count').textContent = printers.length;
  document.getElementById('connected-count').textContent = `${printers.length} conectadas`;
  document.getElementById('next-printer').hidden = printers.length < 2;
}
function renderPartnerOrder(order) {
  const active = order.status === ORDER_STATUS.IN_PRODUCTION;
  const card = instance(active ? 'active-order-template' : 'pending-order-template');
  card.dataset.orderId = order.id;
  card.dataset.state = order.status;
  text(card, 'h3', `Pedido ${order.code}`);
  const stateBadge = card.querySelector('.order-status');
  stateBadge.className = 'order-status ' + ORDER_STATUS_UI[order.status].partnerClass;
  stateBadge.textContent = ORDER_STATUS_UI[order.status].partnerLabel;
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
  for (const [type, state] of [['active', ORDER_STATUS.IN_PRODUCTION], ['pending', ORDER_STATUS.NOT_ACCEPTED]]) {
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
    text(row, '.history-id', record.code);
    text(row, 'strong', record.device);
    text(row, '.history-material', record.material);
    const status = row.querySelector('.history-status');
    status.className = 'history-status ' + ORDER_STATUS_UI[record.status].partnerClass;
    status.querySelector('img').src = 'assets/partner-done.svg';
    tail(status, ORDER_STATUS_UI[record.status].label);
    text(row, '.history-date', record.completedDate || '');
    return row;
  }));
}
async function renderPartner() { try{await Promise.all([renderPrinters(), renderPartnerOrders(), renderHistory()]);}catch(error){document.getElementById('printer-feedback').textContent=error.message;} }
bindAreaHeader({ sections: partnerSections, headerId: 'partner-header', nav: '.partner-nav', accountButtonId: 'account-button' });
bindLogout('[data-logout]', 'parceiro');
const renderPartnerProfile = bindProfile({
  area: 'partner', formId: 'partner-profile-form', nameField: 'profile-institution', emailField: 'profile-email',
  titles: ['[data-account-name]', '#parceiro-perfil-titulo', '#parceiro-inicio-titulo'],
  feedbackId: 'profile-feedback', cancelId: 'cancel-profile', home: 'parceiro-inicio',
  loginEvent: 'conexo:partner-login', nameError: 'Informe o nome da instituição.', success: 'Perfil atualizado nesta demonstração.'
});
document.addEventListener('conexo:data-changed', renderPartner);

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
  if(backendEnabled){document.getElementById('edit-needs-material').closest('.field').hidden=true;document.getElementById('edit-needs-material').required=false;}
  printerForm.querySelectorAll('[name="materialsAvailable"]').forEach(input=>{input.checked=(record?.materialsAvailable||[]).includes(input.value);});
  navigate('parceiro-impressora');
}
document.addEventListener('click', event => {
  const edit = event.target.closest('[data-edit-printer]');
  if (edit) openPrinter(edit.dataset.editPrinter).catch(error=>{document.getElementById('printer-feedback').textContent=error.message;});
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
  const saveButton=document.getElementById('save-printer');saveButton.disabled=true;
  try{
  const creating = selectedPrinter === null;
  const previous = creating ? {} : await data.getPrinter(selectedPrinter);
  const record = await data.savePrinter({ ...previous,
    ...(creating ? { name: document.getElementById('new-printer-name').value.trim(), asset: 'bambu', label: 'BAMBU LAB COREXY', kind: 'FDM Industrial', available: true } : {}),
    materials, nozzles,
    materialsAvailable:[...printerForm.querySelectorAll('[name="materialsAvailable"]:checked')].map(input=>input.value),
    volumes: Object.fromEntries(['X', 'Y', 'Z'].map(axis => [axis, printerForm.elements.namedItem('edit-volume' + axis).value])),
    needsMaterial: document.getElementById('edit-needs-material').value
  });
  await renderPrinters();
  document.getElementById('printer-feedback').textContent = `${record.name}: ${creating ? 'adicionada' : 'atualizada'} nesta demonstração.`;
  navigate('parceiro-inicio');
  }catch(error){printerForm.querySelector('.form-error').textContent=error.message;}finally{saveButton.disabled=false;}
});
document.getElementById('remove-printer').addEventListener('click', async () => {
  try{
  const record = await data.removePrinter(selectedPrinter);
  if (!record) return;
  await renderPrinters();
  document.getElementById('printer-feedback').textContent = `${record.name}: removida nesta demonstração.`;
  navigate('parceiro-inicio');
  }catch(error){printerForm.querySelector('.form-error').textContent=error.message;}
});
document.getElementById('next-printer').addEventListener('click', () => {
  if (matchMedia('(max-width: 600px)').matches) {
    const atEnd = printerGrid.scrollLeft + printerGrid.clientWidth >= printerGrid.scrollWidth - 2;
    printerGrid.scrollTo({ left: atEnd ? 0 : printerGrid.scrollLeft + printerGrid.clientWidth + 16, behavior: 'smooth' });
  } else if (printerGrid.firstElementChild) printerGrid.append(printerGrid.firstElementChild);
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
  if (action === 'accept') await data.acceptOrder(order.id);
  else if (action === 'complete') await data.finishOrder(order.id);
  else if (action === 'refuse') await data.refuseOrder(order.id);
  else return;
  await Promise.all([renderPartnerOrders(), renderHistory()]);
  document.dispatchEvent(new CustomEvent('conexo:data-changed'));
  document.getElementById('orders-feedback').textContent = `Pedido #${order.id} ${action === 'accept' ? 'aceito' : action === 'complete' ? 'concluído' : 'recusado'} nesta demonstração.`;
});
document.addEventListener('conexo:session',()=>{if(sessionUser?.perfil==='parceiro')renderPartner();else if(backendEnabled){printerGrid.replaceChildren();document.getElementById('printer-count').textContent='0';}});
await Promise.all([renderPartner(), renderPartnerProfile()]);
}
