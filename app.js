import { activeSection, loginMode, navigate, setLoginMode, configureRouter, bindRouter } from './router.js';
import { initPartner } from './partner.js';
import { initAacd } from './aacd.js';

// Todas as telas já existem no HTML. Navegar apenas alterna hidden/inert;
// nenhum formulário é recriado e os valores permanecem nos próprios campos.
const app = document.getElementById('app');
const partnerSteps = ['parceiro-dados', 'parceiro-equipamentos', 'parceiro-logistica'];
const resetDialog = bootstrap.Modal.getOrCreateInstance(document.getElementById('reset-dialog'));
const evaluationDialog = bootstrap.Modal.getOrCreateInstance(document.getElementById('evaluation-dialog'));
let termsReachedEnd = false;
let termsAccepted = false;

function renderLoginMode() {
  document.querySelectorAll('#login [data-login-mode]').forEach(button => {
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
  guard: destination => partnerSteps.includes(destination) && !termsAccepted ? 'termos-uso' : destination,
  renderMode: renderLoginMode
});
bindRouter();

// Confirmar continua desativado até o scroll interno alcançar o final.
const termsScroll = document.getElementById('termos-uso-terms-scroll');
const confirmTerms = document.getElementById('termos-uso-confirm-terms');
const termsStatus = document.getElementById('termos-uso-terms-status');
termsScroll.addEventListener('scroll', () => {
  const max = termsScroll.scrollHeight - termsScroll.clientHeight;
  const percentage = max > 0 ? Math.min(100, termsScroll.scrollTop / max * 100) : 0;
  document.getElementById('termos-uso-terms-progress').style.width = `${percentage}%`;
  if (max > 0 && termsScroll.scrollTop >= max - 2) {
    termsReachedEnd = true;
    confirmTerms.disabled = false;
    termsStatus.textContent = 'Leitura concluída. Você já pode confirmar os termos e avançar.';
  }
}, { passive: true });

app.addEventListener('click', event => {
  const reset = event.target.closest('[data-dialog="reset"]');
  if (reset) resetDialog.show();

  const button = event.target.closest('[data-reveal]');
  if (!button) return;
  const input = document.getElementById(button.dataset.reveal);
  const visible = input.type === 'password';
  input.type = visible ? 'text' : 'password';
  button.textContent = visible ? 'Ocultar' : 'Mostrar';
  button.setAttribute('aria-label', visible ? 'Ocultar senha' : 'Mostrar senha');
});

app.addEventListener('input', event => {
  const form = event.target.form;
  if (!form) return;
  if (event.target.name === 'confirmation' || event.target.name === 'password') {
    form.elements.namedItem('confirmation')?.setCustomValidity('');
  }
  const error = form.querySelector('.form-error');
  if (error) error.textContent = '';
});

app.addEventListener('submit', event => {
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
    const matches = form.elements.namedItem('password').value === confirmation.value;
    confirmation.setCustomValidity(matches ? '' : 'As senhas precisam ser iguais.');
    if (!matches) {
      confirmation.reportValidity();
      return;
    }
  }

  switch (activeSection) {
    case 'login':
      if (loginMode === 'parceiro') {
        document.dispatchEvent(new CustomEvent('conexo:partner-login', {
          detail: { email: form.elements.namedItem('email').value }
        }));
        navigate('parceiro-inicio');
        break;
      }
      document.dispatchEvent(new CustomEvent('conexo:aacd-login', {
        detail: { email: form.elements.namedItem('email').value }
      }));
      navigate('aacd-inicio');
      break;
    case 'parceiro-dados':
      navigate('parceiro-equipamentos');
      break;
    case 'parceiro-equipamentos': {
      const hasMaterials = form.querySelector('[name="materials"]:checked');
      const hasNozzles = form.querySelector('[name="nozzles"]:checked');
      if (!hasMaterials || !hasNozzles) {
        form.querySelector('.form-error').textContent = 'Selecione pelo menos um material e um bico disponível.';
        return;
      }
      navigate('parceiro-logistica');
      break;
    }
    case 'parceiro-logistica':
    case 'cadastro-aacd':
      evaluationDialog.show();
      break;
  }
});

document.getElementById('reset-form').addEventListener('submit', event => {
  event.preventDefault();
  if (!event.target.reportValidity()) return;
  document.getElementById('reset-feedback').textContent =
    'Demonstração: solicitação de redefinição validada. O envio do e-mail depende da integração com o servidor.';
});

// Senhas e dados permanecem apenas nos campos desta aba. Não há persistência
// em cookies, localStorage ou sessionStorage, nem envio a um backend.
await Promise.all([initPartner(), initAacd()]);
setLoginMode('aacd');
navigate(location.hash.slice(1) || 'sobre-nos', { replace: true });
