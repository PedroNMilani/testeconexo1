// Navegação única por seções. Nenhum dado de negócio é armazenado aqui.
const pages = new Map(
  [...document.querySelectorAll('#app [data-page]')].map((section) => [
    section.id,
    section
  ])
);
export let activeSection = 'sobre-nos';
export let loginMode = 'aacd';
let guard = (destination) => destination;
let renderMode = () => {};
export function configureRouter(options) {
  guard = options.guard;
  renderMode = options.renderMode;
}
export function setLoginMode(mode) {
  loginMode = mode === 'parceiro' ? 'parceiro' : 'aacd';
  renderMode(loginMode);
}
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

export function navigate(
  sectionId,
  { replace = false, fromHistory = false, mode } = {}
) {
  let destination = pages.has(sectionId) ? sectionId : 'sobre-nos';
  destination = guard(destination);

  if (mode) setLoginMode(mode);
  const state = { section: destination, loginMode };
  const hash = `#${destination}`;
  if (replace || fromHistory) {
    history.replaceState(state, '', hash);
  } else if (
    !fromHistory &&
    (location.hash !== hash || history.state?.loginMode !== loginMode)
  ) {
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
  document.dispatchEvent(
    new CustomEvent('conexo:navigate', { detail: { section: destination } })
  );
}

export function bindRouter() {
  // Cada link mantém seu href real. O JavaScript intercepta somente a navegação
  // interna normal, preservando cliques modificados e o histórico do navegador.
  document.addEventListener('click', (event) => {
    const target = event.target.closest('[data-section]');
    if (
      !target ||
      event.button !== 0 ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    event.preventDefault();
    navigate(target.dataset.section, { mode: target.dataset.loginMode });
  });

  function readLocation() {
    const id = location.hash.slice(1) || 'sobre-nos';
    // O link de pular conteúdo deve focar o título, sem trocar de seção.
    if (id === `${activeSection}-titulo`) return;
    if (
      id === activeSection &&
      (!history.state?.loginMode || history.state.loginMode === loginMode)
    )
      return;
    navigate(id, { fromHistory: true, mode: history.state?.loginMode });
  }
  window.addEventListener('popstate', readLocation);
  window.addEventListener('hashchange', readLocation);
}
