import { sessionUser } from './auth-client.js';
import { bindAreaHeader, bindLogout } from './shared-ui.js';
import { initAacdProfile } from './ui/aacd-profile.js';
import { initAacdOrders } from './ui/aacd-orders.js';
import { initAacdPartners } from './ui/aacd-partners.js';
import { initAacdRequests } from './ui/aacd-requests.js';

export async function initAacd() {
  const sections = new Set([
    'aacd-inicio',
    'aacd-pedidos',
    'aacd-parceiros',
    'aacd-homologacao',
    'aacd-pedido-1',
    'aacd-pedido-2',
    'aacd-pedido-3',
    'aacd-conectar',
    'aacd-perfil'
  ]);
  function navigationGroup(section) {
    if (section === 'aacd-homologacao') return 'aacd-parceiros';
    if (
      [
        'aacd-pedido-1',
        'aacd-pedido-2',
        'aacd-pedido-3',
        'aacd-conectar'
      ].includes(section)
    )
      return 'aacd-pedidos';
    return section;
  }
  bindAreaHeader({
    sections,
    headerId: 'aacd-header',
    nav: '.aacd-nav',
    accountButtonId: 'aacd-account-button',
    group: navigationGroup
  });
  bindLogout('#aacd-logout', 'aacd');
  const renderProfile = initAacdProfile();
  const orders = initAacdOrders({ onOrdersChanged: refresh });
  const partners = initAacdPartners();
  const requests = initAacdRequests({
    onOrdersChanged: refresh,
    resetOrderFilters: orders.resetFilters
  });

  async function refresh() {
    if (sessionUser?.perfil !== 'aacd' || !sessionUser.homologado) {
      orders.clear();
      partners.clear();
      requests.clear();
      return;
    }
    try {
      await Promise.all([
        orders.refresh(),
        partners.refresh(),
        requests.refreshOpenRequests()
      ]);
    } catch (error) {
      document.getElementById('aacd-orders-feedback').textContent =
        error.message;
    }
  }
  document.addEventListener('conexo:data-changed', refresh);
  document.addEventListener('conexo:session', refresh);
  await Promise.all([refresh(), renderProfile()]);
}
