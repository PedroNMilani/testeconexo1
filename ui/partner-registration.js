import {
  api,
  login,
  sessionUser,
  renderBackendNotice
} from '../auth-client.js';
import { locationValue } from '../location-ui.js';
import { savePrinter } from '../data.js';
import { navigate } from '../router.js';

export function initPartnerRegistration(onRegistered) {
  const accountForm = document.querySelector('#parceiro-dados form');
  const equipmentForm = document.querySelector('#parceiro-equipamentos form');
  let accountCreated = false;

  function selectedValues(name) {
    return [...equipmentForm.querySelectorAll(`[name="${name}"]:checked`)].map(
      (input) => input.value
    );
  }

  function readPrinter() {
    return {
      name: document.getElementById('register-printer-name').value,
      materials: selectedValues('materials'),
      materialsAvailable: selectedValues('materialsAvailable'),
      nozzles: selectedValues('nozzles'),
      volumes: {
        X: Number(equipmentForm.elements.namedItem('volumeX').value),
        Y: Number(equipmentForm.elements.namedItem('volumeY').value),
        Z: Number(equipmentForm.elements.namedItem('volumeZ').value)
      }
    };
  }

  function validateSteps(printer) {
    // Após criar a conta, uma falha na impressora permite repetir apenas essa gravação.
    if (!accountCreated && !accountForm.checkValidity()) {
      navigate('parceiro-dados');
      accountForm.reportValidity();
      return false;
    }
    if (!equipmentForm.checkValidity()) {
      navigate('parceiro-equipamentos');
      equipmentForm.reportValidity();
      return false;
    }
    if (
      !printer.materials.length ||
      !printer.nozzles.length ||
      printer.materialsAvailable.some(
        (material) => !printer.materials.includes(material)
      )
    ) {
      navigate('parceiro-equipamentos');
      equipmentForm.querySelector('.form-error').textContent =
        'Selecione materiais compatíveis e bicos; os materiais disponíveis devem estar entre os compatíveis.';
      return false;
    }
    return true;
  }

  async function createAccount(fields, location, termsAccepted) {
    if (accountCreated) return;
    await api('/auth/cadastros/parceiros', {
      method: 'POST',
      body: {
        institution: fields.institution,
        responsible: fields.responsible,
        email: fields.email,
        phone: fields.phone,
        password: fields.password,
        street: fields.street,
        number: fields.number,
        city: fields.city,
        state: fields.state,
        ...location,
        termsAccepted
      }
    });
    accountCreated = true;
  }

  async function signIn(fields) {
    if (sessionUser?.email !== fields.email.trim().toLowerCase()) {
      if (!fields.password)
        throw new Error('Entre na conta criada para adicionar sua impressora.');
      await login({ email: fields.email, password: fields.password });
    }
    accountForm.elements.namedItem('password').value = '';
    accountForm.elements.namedItem('confirmation').value = '';
  }

  async function submit(form, termsAccepted) {
    const button = form.querySelector('[type=submit]');
    button.disabled = true;
    try {
      const printer = readPrinter();
      if (!validateSteps(printer)) return;
      const location = locationValue('registration-location');
      if (!location.locationConfirmed)
        throw new Error('Localize e confirme o pino da instituição no mapa.');
      const fields = Object.fromEntries(new FormData(accountForm));
      await createAccount(fields, location, termsAccepted);
      await signIn(fields);
      await savePrinter(printer);
      renderBackendNotice();
      document.dispatchEvent(new CustomEvent('conexo:data-changed'));
      onRegistered();
    } catch (error) {
      form.querySelector('.form-error').textContent =
        (accountCreated
          ? 'A conta foi criada. A impressora ainda precisa ser salva: '
          : '') + error.message;
    } finally {
      button.disabled = false;
    }
  }

  function reset() {
    accountCreated = false;
  }
  return { submit, reset };
}
