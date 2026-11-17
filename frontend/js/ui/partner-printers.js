import { sessionKey } from '../auth-client.js';
import * as data from '../data.js';
import { navigate } from '../router.js';
import { instance, text, tail } from '../shared-ui.js';

// Lista, criação e edição das impressoras do parceiro.
export function initPartnerPrinters() {
  const printerForm = document.getElementById('printer-form');
  const printerGrid = document.getElementById('printer-grid');
  let selectedPrinter = null;
  function renderPrinter(record) {
    const card = instance('printer-template');
    card.dataset.printerId = record.id;
    card.querySelectorAll('[data-edit-printer]').forEach((button) => {
      button.dataset.editPrinter = record.id;
    });
    card
      .querySelector('.edit-printer')
      .setAttribute('aria-label', `Editar ${record.name}`);
    text(card, '[data-printer-name]', record.name);
    text(card, '[data-art-label]', record.label);
    card.querySelector('.printer-art img').src =
      record.asset === 'creality'
        ? 'assets/partner-printer-3d-blue.svg'
        : 'assets/partner-printer-3d-green.svg';
    card
      .querySelector('.printer-art')
      .classList.toggle('blue', record.asset === 'creality');
    const availability = card.querySelector('.availability');
    availability.classList.toggle('available', record.available);
    tail(availability, record.available ? 'Disponível' : 'Indisponível');
    text(
      card,
      '.printer-id',
      `ID: IMP-${record.id.padStart(2, '0')} • ${record.kind}`
    );
    text(
      card,
      '[data-printer-material]',
      record.materials
        .map((material) => record.materialLabels?.[material] || material)
        .join(', ')
    );
    text(
      card,
      '[data-printer-nozzle]',
      `${record.nozzles.join(' / ')}mm • Pronto`
    );
    return card;
  }
  async function renderPrinters() {
    const actor = sessionKey();
    const printers = await data.listPrinters();
    if (actor !== sessionKey()) return;
    printerGrid.replaceChildren(...printers.map(renderPrinter));
    document.getElementById('printer-count').textContent = printers.length;
    document.getElementById('connected-count').textContent =
      `${printers.length} conectadas`;
    document.getElementById('next-printer').hidden = printers.length < 2;
  }
  async function openPrinter(id) {
    const actor = sessionKey();
    const record = id ? await data.getPrinter(id) : null;
    if (actor !== sessionKey()) return;
    populatePrinterForm(record);
    navigate('parceiro-impressora');
  }
  function populatePrinterForm(record) {
    selectedPrinter = record;
    const creating = !record;
    printerForm.reset();
    printerForm.querySelector('.form-error').textContent = '';
    document.getElementById('new-printer-fields').hidden = !creating;
    document.getElementById('new-printer-name').required = creating;
    document.getElementById('remove-printer').hidden = creating;
    document.getElementById('save-printer').textContent = creating
      ? 'Adicionar'
      : 'Atualizar';
    document.getElementById('parceiro-impressora-titulo').textContent = creating
      ? 'Adicionar impressora'
      : 'Sua impressora';
    document.getElementById('editor-name').textContent =
      record?.name || 'Nova impressora';
    document.getElementById('editor-id').textContent = record
      ? `ID: IMP-${record.id.padStart(2, '0')} • ${record.kind}`
      : 'Informe as especificações da impressora';
    const art = document.getElementById('editor-art');
    art.querySelector('img').src =
      `assets/partner-${record?.asset || 'bambu'}.svg`;
    art.querySelector('span').textContent = record?.label || 'BAMBU LAB COREXY';
    art.classList.toggle('blue', record?.asset === 'creality');
    for (const axis of ['X', 'Y', 'Z'])
      printerForm.elements.namedItem('edit-volume' + axis).value =
        record?.volumes[axis] || '';
    printerForm.querySelectorAll('[name="materials"]').forEach((input) => {
      input.checked = record?.materials.includes(input.value) || false;
    });
    printerForm.querySelectorAll('[name="nozzles"]').forEach((input) => {
      input.checked = (
        record?.nozzles || ['0.2', '0.4', '0.6', '0.8']
      ).includes(input.value);
    });
    printerForm
      .querySelectorAll('[name="materialsAvailable"]')
      .forEach((input) => {
        input.checked = (record?.materialsAvailable || []).includes(
          input.value
        );
      });
  }
  document.addEventListener('click', (event) => {
    const edit = event.target.closest('[data-edit-printer]');
    if (edit)
      openPrinter(edit.dataset.editPrinter).catch((error) => {
        document.getElementById('printer-feedback').textContent = error.message;
      });
  });
  document
    .getElementById('add-printer')
    .addEventListener('click', () => openPrinter(null));
  function readPrinterForm() {
    const fields = new FormData(printerForm);
    return {
      id: selectedPrinter?.id,
      name: selectedPrinter
        ? selectedPrinter.name
        : String(fields.get('new-printer-name')).trim(),
      materials: fields.getAll('materials'),
      nozzles: fields.getAll('nozzles'),
      materialsAvailable: fields.getAll('materialsAvailable'),
      volumes: {
        X: Number(fields.get('edit-volumeX')),
        Y: Number(fields.get('edit-volumeY')),
        Z: Number(fields.get('edit-volumeZ'))
      }
    };
  }
  function validatePrinterForm(record) {
    if (!printerForm.reportValidity()) return false;
    if (!record.materials.length || !record.nozzles.length) {
      printerForm.querySelector('.form-error').textContent =
        'Selecione pelo menos um material e um bico disponível.';
      return false;
    }
    return true;
  }
  async function submitPrinterForm(event) {
    event.preventDefault();
    const record = readPrinterForm();
    if (!validatePrinterForm(record)) return;
    const saveButton = document.getElementById('save-printer');
    const actor = sessionKey();
    saveButton.disabled = true;
    try {
      const creating = selectedPrinter === null;
      const saved = await data.savePrinter(record);
      if (actor !== sessionKey()) return;
      selectedPrinter = saved;
      await renderPrinters();
      if (actor !== sessionKey()) return;
      document.getElementById('printer-feedback').textContent =
        `${saved.name}: ${creating ? 'adicionada' : 'atualizada'}.`;
      navigate('parceiro-inicio');
    } catch (error) {
      printerForm.querySelector('.form-error').textContent = error.message;
    } finally {
      saveButton.disabled = false;
    }
  }
  printerForm.addEventListener('submit', submitPrinterForm);
  document
    .getElementById('remove-printer')
    .addEventListener('click', async () => {
      try {
        const record = await data.removePrinter(selectedPrinter.id);
        if (!record) return;
        await renderPrinters();
        document.getElementById('printer-feedback').textContent =
          `${record.name}: removida.`;
        navigate('parceiro-inicio');
      } catch (error) {
        printerForm.querySelector('.form-error').textContent = error.message;
      }
    });
  document.getElementById('next-printer').addEventListener('click', () => {
    if (matchMedia('(max-width: 600px)').matches) {
      const atEnd =
        printerGrid.scrollLeft + printerGrid.clientWidth >=
        printerGrid.scrollWidth - 2;
      printerGrid.scrollTo({
        left: atEnd ? 0 : printerGrid.scrollLeft + printerGrid.clientWidth + 16,
        behavior: 'smooth'
      });
    } else if (printerGrid.firstElementChild)
      printerGrid.append(printerGrid.firstElementChild);
  });
  function clear() {
    populatePrinterForm(null);
    printerGrid.replaceChildren();
    document.getElementById('printer-count').textContent = '0';
    document.getElementById('connected-count').textContent = '0 conectadas';
    document.getElementById('next-printer').hidden = true;
    document.getElementById('printer-feedback').textContent = '';
  }
  return { refresh: renderPrinters, clear };
}
