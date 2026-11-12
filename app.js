import {
  backendEnabled,
  sessionUser,
  login,
  api,
  restoreSession,
  canOpen,
  internalDestination,
  renderBackendNotice
} from './auth-client.js';
import { mountLocation, locationValue, resetLocation } from './location-ui.js';
import * as data from './data.js';
import {
  activeSection,
  loginMode,
  navigate,
  setLoginMode,
  configureRouter,
  bindRouter
} from './router.js';
import { initPartner } from './partner.js';
import { initAacd } from './aacd.js';

// Todas as telas já existem no HTML. Navegar apenas alterna hidden/inert;
// nenhum formulário é recriado e os valores permanecem nos próprios campos.
const app = document.getElementById('app');
const partnerSteps = [
  'parceiro-dados',
  'parceiro-equipamentos',
  'parceiro-logistica'
];
const resetDialog = bootstrap.Modal.getOrCreateInstance(
  document.getElementById('reset-dialog')
);
const evaluationElement = document.getElementById('evaluation-dialog');
const evaluationDialog = bootstrap.Modal.getOrCreateInstance(
  evaluationElement,
  {
    backdrop: 'static',
    keyboard: false
  }
);
let termsReachedEnd = false;
let termsAccepted = false;
let partnerAccountCreated = false,
  previousSession = null;

function partnerPending() {
  return (
    backendEnabled &&
    sessionUser?.perfil === 'parceiro' &&
    sessionUser.homologado !== true
  );
}

function showPendingPartner() {
  navigate('login', { mode: 'parceiro', replace: true });
  evaluationDialog.show();
}

// O mesmo modal também é usado pelo cadastro AACD.
evaluationElement.addEventListener('show.bs.modal', () => {
  evaluationElement
    .querySelectorAll('[data-bs-dismiss="modal"]')
    .forEach((button) => {
      button.hidden = false;
    });

  document.getElementById('partner-evaluation-actions').hidden =
    !partnerPending();
});

//Redireciona a página sobre nós ao fechar o pop-up de homologação
evaluationElement.addEventListener('hidden.bs.modal', () => {
  if (partnerPending()) {
    navigate('sobre-nos', { replace: true });
  }
});

function renderLoginMode() {
  document.querySelectorAll('#login [data-login-mode]').forEach((button) => {
    const selected = button.dataset.loginMode === loginMode;
    button.classList.toggle('active', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  const signup = document.getElementById('login-cadastro');
  const destination = loginMode === 'parceiro' ? 'termos-uso' : 'cadastro-aacd';
  signup.dataset.section = destination;
  signup.setAttribute('href', `#${destination}`);
  document.getElementById('login-feedback').textContent = '';
}

configureRouter({
  guard: (destination) => {
    if (!canOpen(destination)) {
      if (partnerPending()) {
        queueMicrotask(showPendingPartner);
      }

      return 'login';
    }

    if (partnerSteps.includes(destination) && !termsAccepted) {
      return 'termos-uso';
    }

    return destination;
  },
  renderMode: renderLoginMode
});
bindRouter();

// Confirmar continua desativado até o scroll interno alcançar o final.
const termsScroll = document.getElementById('termos-uso-terms-scroll');
const confirmTerms = document.getElementById('termos-uso-confirm-terms');
const termsStatus = document.getElementById('termos-uso-terms-status');
termsScroll.addEventListener(
  'scroll',
  () => {
    const max = termsScroll.scrollHeight - termsScroll.clientHeight;
    const percentage =
      max > 0 ? Math.min(100, (termsScroll.scrollTop / max) * 100) : 0;
    document.getElementById('termos-uso-terms-progress').style.width =
      `${percentage}%`;
    if (max > 0 && termsScroll.scrollTop >= max - 2) {
      termsReachedEnd = true;
      confirmTerms.disabled = false;
      termsStatus.textContent =
        'Leitura concluída. Você já pode confirmar os termos e avançar.';
    }
  },
  { passive: true }
);

app.addEventListener('click', (event) => {
  const reset = event.target.closest('[data-dialog="reset"]');
  if (reset) resetDialog.show();

  const button = event.target.closest('[data-reveal]');
  if (!button) return;
  const input = document.getElementById(button.dataset.reveal);
  const visible = input.type === 'password';
  input.type = visible ? 'text' : 'password';
  button.textContent = visible ? 'Ocultar' : 'Mostrar';
  button.setAttribute(
    'aria-label',
    visible ? 'Ocultar senha' : 'Mostrar senha'
  );
});

app.addEventListener('input', (event) => {
  const form = event.target.form;
  if (!form) return;
  if (
    event.target.name === 'confirmation' ||
    event.target.name === 'password'
  ) {
    form.elements.namedItem('confirmation')?.setCustomValidity('');
  }
  const error = form.querySelector('.form-error');
  if (error) error.textContent = '';
});

app.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.target;
  // Um envio disparado por script de uma seção inativa não avança o fluxo.
  if (form.closest('[data-page]')?.id !== activeSection) return;
  if (!form.reportValidity()) return;

  if (form.dataset.form === 'terms') {
    if (!termsReachedEnd) return;
    termsAccepted = true;
    navigate('parceiro-dados');
    return;
  }

  const confirmation = form.elements.namedItem('confirmation');
  if (confirmation) {
    const matches =
      form.elements.namedItem('password').value === confirmation.value;
    confirmation.setCustomValidity(
      matches ? '' : 'As senhas precisam ser iguais.'
    );
    if (!matches) {
      confirmation.reportValidity();
      return;
    }
  }

  switch (activeSection) {
    case 'login':
      if (backendEnabled) {
        const button = form.querySelector('[type=submit]');
        button.disabled = true;
        try {
          const user = await login({
            email: form.elements.namedItem('email').value,
            password: form.elements.namedItem('password').value
          });
          form.elements.namedItem('password').value = '';
          renderBackendNotice();
          document.dispatchEvent(new CustomEvent('conexo:data-changed'));
          if (partnerPending()) {
            showPendingPartner();
          } else if (user.perfil === 'aacd' && !user.homologado) {
            document.getElementById('login-feedback').textContent =
              'Sua conta AACD aguarda homologação por um integrante já homologado.';
          } else {
            navigate(internalDestination(user));
          }
        } catch (error) {
          document.getElementById('login-feedback').textContent = error.message;
        } finally {
          button.disabled = false;
        }
        break;
      }
      if (loginMode === 'parceiro') {
        document.dispatchEvent(
          new CustomEvent('conexo:partner-login', {
            detail: { email: form.elements.namedItem('email').value }
          })
        );
        navigate('parceiro-inicio');
        break;
      }
      document.dispatchEvent(
        new CustomEvent('conexo:aacd-login', {
          detail: { email: form.elements.namedItem('email').value }
        })
      );
      navigate('aacd-inicio');
      break;
    case 'parceiro-dados':
      navigate('parceiro-equipamentos');
      break;
    case 'parceiro-equipamentos': {
      const hasMaterials = form.querySelector('[name="materials"]:checked');
      const hasNozzles = form.querySelector('[name="nozzles"]:checked');
      if (!hasMaterials || !hasNozzles) {
        form.querySelector('.form-error').textContent =
          'Selecione pelo menos um material e um bico disponível.';
        return;
      }
      navigate('parceiro-logistica');
      break;
    }
    case 'parceiro-logistica':
      if (backendEnabled) {
        await registerPartner(form);
        break;
      }
      evaluationDialog.show();
      break;
    case 'cadastro-aacd':
      if (backendEnabled) {
        const button = form.querySelector('[type=submit]');
        button.disabled = true;
        try {
          await api('/auth/cadastros/aacd', {
            method: 'POST',
            body: {
              email: form.elements.namedItem('email').value,
              password: form.elements.namedItem('password').value,
              phone: form.elements.namedItem('phone').value,
              unit: form.elements.namedItem('unit').value,
              holder: form.elements.namedItem('holder').value
            }
          });
          form.elements.namedItem('password').value = '';
          form.elements.namedItem('confirmation').value = '';
          evaluationDialog.show();
        } catch (error) {
          form.querySelector('.form-error').textContent = error.message;
        } finally {
          button.disabled = false;
        }
        break;
      }
      evaluationDialog.show();
      break;
  }
});

document.getElementById('reset-form').addEventListener('submit', (event) => {
  event.preventDefault();
  if (!event.target.reportValidity()) return;
  document.getElementById('reset-feedback').textContent =
    'Demonstração: solicitação de redefinição validada. O envio do e-mail depende da integração com o servidor.';
});

// Senhas e dados permanecem apenas nos campos desta aba. Não há persistência
// em cookies, localStorage ou sessionStorage, nem envio a um backend.
// O mapa é parte da tela, inclusive na prévia. Não aguarda catálogos ou sessão.
mountLocation('registration-location', {
  street: '#parceiro-dados-street',
  city: '#parceiro-dados-city',
  state: '#parceiro-dados-state',
  number: '#parceiro-dados-number'
});
await Promise.all([initPartner(), initAacd()]);
if (backendEnabled) {
  try {
    const catalog = await api('/catalogos');
    for (const id of ['cadastro-aacd-unit', 'aacd-profile-unit']) {
      const select = document.getElementById(id),
        selected = select.value;
      select.replaceChildren(
        ...['', ...catalog.unidades].map((unit) => {
          const option = document.createElement('option');
          option.value = unit;
          option.textContent = unit || 'Selecione sua unidade';
          return option;
        })
      );
      select.value = selected;
    }
  } catch (error) {
    document.getElementById('login-feedback').textContent = error.message;
  }
  try {
    await restoreSession();
    renderBackendNotice();
    document.dispatchEvent(new CustomEvent('conexo:data-changed'));
  } catch (error) {
    document.getElementById('login-feedback').textContent = error.message;
  }
}
setLoginMode('aacd');
navigate(location.hash.slice(1) || 'sobre-nos', { replace: true });
if (partnerPending()) {
  showPendingPartner();
}

// O gerador também funciona no protótipo; a API reserva um ID persistente quando o Express está ativo.
const codeDialog = bootstrap.Modal.getOrCreateInstance(
  document.getElementById('code-dialog')
);
document
  .getElementById('generate-request-code')
  .addEventListener('click', () => {
    document.getElementById('code-generator-feedback').textContent = '';
    codeDialog.show();
  });
document
  .getElementById('code-generator-form')
  .addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!event.target.reportValidity()) return;
    const button = event.target.querySelector('[type=submit]');
    button.disabled = true;
    try {
      const generated = await data.generateRequestCode(
        document.getElementById('code-material').value
      );
      const field = document.getElementById('aacd-order-code');
      field.value = generated.code;
      field.setCustomValidity('');
      codeDialog.hide();
    } catch (error) {
      document.getElementById('code-generator-feedback').textContent =
        error.message;
    } finally {
      button.disabled = false;
    }
  });
async function registerPartner(form) {
  const errorBox = form.querySelector('.form-error'),
    button = form.querySelector('[type=submit]');
  button.disabled = true;
  try {
    for (const section of ['parceiro-dados', 'parceiro-equipamentos']) {
      if (partnerAccountCreated && section === 'parceiro-dados') continue;
      const previous = document.querySelector('#' + section + ' form');
      if (!previous.checkValidity()) {
        navigate(section);
        previous.reportValidity();
        return;
      }
    }
    const equipmentCheck = document.querySelector(
      '#parceiro-equipamentos form'
    );
    const compatible = [
      ...equipmentCheck.querySelectorAll('[name=materials]:checked')
    ].map((input) => input.value);
    const available = [
      ...equipmentCheck.querySelectorAll('[name=materialsAvailable]:checked')
    ].map((input) => input.value);
    if (
      !compatible.length ||
      !equipmentCheck.querySelector('[name=nozzles]:checked') ||
      available.some((material) => !compatible.includes(material))
    ) {
      navigate('parceiro-equipamentos');
      equipmentCheck.querySelector('.form-error').textContent =
        'Selecione materiais compatíveis e bicos; os materiais disponíveis devem estar entre os compatíveis.';
      return;
    }
    const location = locationValue('registration-location');
    if (!location.locationConfirmed)
      throw new Error('Localize e confirme o pino da instituição no mapa.');
    const fields = Object.fromEntries(
      new FormData(document.querySelector('#parceiro-dados form'))
    );
    if (!partnerAccountCreated) {
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
      partnerAccountCreated = true;
    }
    if (
      !sessionUser ||
      sessionUser.email !== fields.email.trim().toLowerCase()
    ) {
      if (!fields.password)
        throw new Error('Entre na conta criada para adicionar sua impressora.');
      await login({ email: fields.email, password: fields.password });
    }
    document.querySelector('#parceiro-dados [name=password]').value = '';
    document.querySelector('#parceiro-dados [name=confirmation]').value = '';
    const equipment = document.querySelector('#parceiro-equipamentos form');
    await data.savePrinter({
      name: document.getElementById('register-printer-name').value,
      materials: [
        ...equipment.querySelectorAll('[name=materials]:checked')
      ].map((input) => input.value),
      materialsAvailable: [
        ...equipment.querySelectorAll('[name=materialsAvailable]:checked')
      ].map((input) => input.value),
      nozzles: [...equipment.querySelectorAll('[name=nozzles]:checked')].map(
        (input) => input.value
      ),
      volumes: Object.fromEntries(
        ['X', 'Y', 'Z'].map((axis) => [
          axis,
          equipment.elements.namedItem('volume' + axis).value
        ])
      )
    });
    document.querySelector('#parceiro-dados [name=password]').value = '';
    document.querySelector('#parceiro-dados [name=confirmation]').value = '';
    renderBackendNotice();
    document.dispatchEvent(new CustomEvent('conexo:data-changed'));
    showPendingPartner();
  } catch (error) {
    errorBox.textContent =
      (partnerAccountCreated
        ? 'A conta foi criada. A impressora ainda precisa ser salva: '
        : '') + error.message;
  } finally {
    button.disabled = false;
  }
}

document.addEventListener('conexo:session', () => {
  if (previousSession && !sessionUser) {
    partnerAccountCreated = false;
    termsAccepted = false;
    termsReachedEnd = false;
    confirmTerms.disabled = true;
    termsScroll.scrollTop = 0;
    document
      .querySelectorAll('#parceiro-dados form,#parceiro-equipamentos form')
      .forEach((form) => form.reset());
    resetRegistrationLocation();
  }
  previousSession = sessionUser
    ? sessionUser.perfil + '/' + sessionUser.id
    : null;
});
function resetRegistrationLocation() {
  resetLocation('registration-location', null);
}

// Vê se o parceiro está homologado ou não
document
  .getElementById('check-partner-approval')
  .addEventListener('click', async (event) => {
    const button = event.currentTarget;
    const feedback = document.getElementById('partner-evaluation-feedback');

    button.disabled = true;
    feedback.textContent = '';

    try {
      const user = await restoreSession();

      if (!user) {
        evaluationDialog.hide();
        navigate('login', { mode: 'parceiro', replace: true });
        return;
      }

      if (user.perfil !== 'parceiro') {
        feedback.textContent = 'Entre novamente na conta do parceiro.';
        return;
      }

      if (!user.homologado) {
        feedback.textContent =
          'Seu cadastro ainda está aguardando homologação pela AACD.';
        return;
      }

      renderBackendNotice();
      document.dispatchEvent(new CustomEvent('conexo:data-changed'));

      evaluationDialog.hide();
      navigate(internalDestination(user), { replace: true });
    } catch (error) {
      feedback.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });
