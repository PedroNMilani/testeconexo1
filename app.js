'use strict';

// Ponte temporária até a conversão de todos os controladores em módulos ES.
const dataReady = import('./data.js');

// Todas as telas já existem no HTML. Navegar apenas alterna hidden/inert;
// nenhum formulário é recriado e os valores permanecem nos próprios campos.
const app = document.getElementById('app');
const pages = new Map(
  [...app.querySelectorAll('[data-page]')].map(section => [section.id, section])
);
const titles = {
  'sobre-nos': 'Sobre Nós',
  login: 'Login',
  'termos-uso': 'Termos de Uso',
  'parceiro-dados': 'Dados do Parceiro',
  'parceiro-equipamentos': 'Capacidade Técnica e Equipamentos',
  'parceiro-logistica': 'Disponibilidade e Logística',
  'cadastro-aacd': 'Cadastro AACD',
  'parceiro-inicio': 'Início do Parceiro',
  'parceiro-pedidos': 'Pedidos do Parceiro',
  'parceiro-impressora': 'Sua impressora',
  'parceiro-perfil': 'Editar a Conta',
  'aacd-inicio': 'Minhas Conexões',
  'aacd-pedidos': 'Histórico e Atividades da Rede',
  'aacd-parceiros': 'Rede de Parceiros Ativos',
  'aacd-homologacao': 'Homologação de Parceiros',
  'aacd-pedido-1': 'Novo Pedido — Informações Gerais',
  'aacd-pedido-2': 'Novo Pedido — Especificações Técnicas',
  'aacd-pedido-3': 'Novo Pedido — Upload do Link',
  'aacd-conectar': 'Conectar Pedido aos Parceiros',
  'aacd-perfil': 'Editar a Conta AACD'
};
const partnerSteps = ['parceiro-dados', 'parceiro-equipamentos', 'parceiro-logistica'];
const resetDialog = bootstrap.Modal.getOrCreateInstance(document.getElementById('reset-dialog'));
const evaluationDialog = bootstrap.Modal.getOrCreateInstance(document.getElementById('evaluation-dialog'));
let activeSection = 'sobre-nos';
let loginMode = 'aacd';
let termsReachedEnd = false;
let termsAccepted = false;

function setLoginMode(mode) {
  loginMode = mode === 'parceiro' ? 'parceiro' : 'aacd';
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

function navigate(sectionId, { replace = false, fromHistory = false, mode } = {}) {
  let destination = pages.has(sectionId) ? sectionId : 'sobre-nos';
  if (partnerSteps.includes(destination) && !termsAccepted) destination = 'termos-uso';

  if (mode) setLoginMode(mode);
  const state = { section: destination, loginMode };
  const hash = `#${destination}`;
  if (replace || fromHistory) {
    history.replaceState(state, '', hash);
  } else if (!fromHistory && (location.hash !== hash || history.state?.loginMode !== loginMode)) {
    history.pushState(state, '', hash);
  }

  for (const [id, section] of pages) {
    const visible = id === destination;
    section.hidden = !visible;
    section.inert = !visible;
  }
  activeSection = destination;
  const header = document.getElementById('site-header');
  header.hidden = destination !== 'sobre-nos' && destination !== 'login';
  header.classList.toggle('center', destination === 'login');
  document.getElementById('header-login').hidden = destination !== 'sobre-nos';
  document.title = `CoNexo — ${titles[destination]}`;
  const heading = document.getElementById(`${destination}-titulo`);
  document.getElementById('skip-link').setAttribute('href', `#${heading.id}`);
  window.scrollTo(0, 0);
  heading.focus({ preventScroll: true });
  document.dispatchEvent(new CustomEvent('conexo:navigate', { detail: { section: destination } }));
}

// Cada link mantém seu href real. O JavaScript intercepta somente a navegação
// interna normal, preservando cliques modificados e o histórico do navegador.
document.addEventListener('click', event => {
  const target = event.target.closest('[data-section]');
  if (!target || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  navigate(target.dataset.section, { mode: target.dataset.loginMode });
});

function readLocation() {
  const id = location.hash.slice(1) || 'sobre-nos';
  // O link de pular conteúdo deve focar o título, sem trocar de seção.
  if (id === `${activeSection}-titulo`) return;
  navigate(id, { fromHistory: true, mode: history.state?.loginMode });
}
window.addEventListener('popstate', readLocation);
window.addEventListener('hashchange', readLocation);

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
setLoginMode('aacd');
navigate(location.hash.slice(1) || 'sobre-nos', { replace: true });
