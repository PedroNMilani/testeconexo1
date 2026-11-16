import { bindAreaHeader, bindLogout } from './shared-ui.js';
import { initPartnerProfile } from './ui/partner-profile.js';
import { initPartnerPrinters } from './ui/partner-printers.js';
import { initPartnerOrders } from './ui/partner-orders.js';

// Inicializa os módulos e coordena as atualizações da área do parceiro.
export async function initPartner() {
  const sections = new Set([
    'parceiro-inicio',
    'parceiro-pedidos',
    'parceiro-impressora',
    'parceiro-perfil'
  ]);
  bindAreaHeader({
    sections,
    headerId: 'partner-header',
    nav: '.partner-nav',
    accountButtonId: 'account-button'
  });
  bindLogout('[data-logout]', 'parceiro');
  const renderProfile = initPartnerProfile();
  const printers = initPartnerPrinters();
  const orders = initPartnerOrders();

  async function refresh() {
    try {
      await Promise.all([printers.refresh(), orders.refresh()]);
    } catch (error) {
      document.getElementById('printer-feedback').textContent = error.message;
    }
  }
  function onSessionChanged() {
    printers.clear();
    orders.clear();
    refresh();
  }
  document.addEventListener('conexo:data-changed', refresh);
  document.addEventListener('conexo:session', onSessionChanged);
  await Promise.all([refresh(), renderProfile()]);
}
