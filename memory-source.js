import { MATERIALS } from './material-catalog.js';
import { ORDER_STATUS, assertOrderStatus } from './order-status.js';

// Adaptador privado em memória. Somente data.js é consumido pelas telas.
export function createMemorySource(seed) {
  const state = structuredClone(seed);
  state.orders.forEach(order => assertOrderStatus(order.status));
  let codeSequence = 0;
  const collection = name => state[name];
  const find = (name, id) => collection(name).find(item => item.id === id) ?? null;
  const nextId = name => String(Math.max(0, ...collection(name).map(item => Number(item.id) || 0)) + 1);
  function save(name, record) {
    const index = collection(name).findIndex(item => item.id === record.id);
    const saved = { ...(index < 0 ? {} : collection(name)[index]), ...record, id: record.id || nextId(name) };
    if (index < 0) collection(name).push(saved);
    else collection(name)[index] = saved;
    return saved;
  }
  function remove(name, id) {
    const index = collection(name).findIndex(item => item.id === id);
    return index < 0 ? null : collection(name).splice(index, 1)[0];
  }
  return {
    async listPrinters() { return state.printers; },
    async getPrinter(id) { return find('printers', id); },
    async savePrinter(record) {
      const merged = { ...(find('printers', record.id) || {}), ...record };
      if (!merged.name?.trim() || !merged.materials?.length || !merged.nozzles?.length
          || !['Sim', 'Não'].includes(merged.needsMaterial)
          || !['X', 'Y', 'Z'].every(axis => Number(merged.volumes?.[axis]) > 0)) {
        throw new TypeError('Informe os dados obrigatórios da impressora.');
      }
      return save('printers', merged);
    },
    async removePrinter(id) { return remove('printers', id); },
    async listOrders(filters = {}) {
      return state.orders.filter(order => Object.entries(filters).every(([key, value]) => order[key] === value));
    },
    async getOrder(id) { return find('orders', id); },
    async createOrder(record) {
      if (state.orders.some(order => order.code === record.code)) throw new Error('Este código de pedido já foi conectado nesta demonstração.');
      const status = record.status ?? ORDER_STATUS.NOT_ACCEPTED;
      assertOrderStatus(status);
      return save('orders', { ...record, status, id: nextId('orders') });
    },
    async acceptOrder(id) {
      const order = find('orders', id);
      if (!order || !order.partnerId || order.status !== ORDER_STATUS.NOT_ACCEPTED) throw new Error('Pedido indisponível para aceite.');
      return save('orders', { ...order, status: ORDER_STATUS.IN_PRODUCTION });
    },
    async finishOrder(id) {
      const order = find('orders', id);
      if (!order || order.status !== ORDER_STATUS.IN_PRODUCTION) throw new Error('Apenas pedidos em produção podem ser finalizados.');
      return save('orders', { ...order, status: ORDER_STATUS.FINISHED,
        completedDate: new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' }).format(new Date()) });
    },
    async refuseOrder(id) {
      const order = find('orders', id);
      if (!order || !order.partnerId || order.status !== ORDER_STATUS.NOT_ACCEPTED) throw new Error('Pedido indisponível para recusa.');
      // Recusa não é status nem evento: apenas devolve o pedido sem associação.
      return save('orders', { ...order, status: ORDER_STATUS.NOT_ACCEPTED, partnerId: null, lab: '' });
    },
    async listHistory(partnerId = 'current-partner') {
      return state.orders.filter(order => order.partnerId === partnerId && order.status === ORDER_STATUS.FINISHED);
    },
    async listPartners() { return state.partners; },
    async listReviews() { return state.reviews; },
    async reviewPartner(id, approved) {
      const candidate = find('reviews', id);
      if (!candidate) return null;
      if (approved) save('partners', {
        id: 'approved-' + id, name: candidate.name,
        location: candidate.info[2].value, statusLabel: '● Homologado', statusClass: 'aacd-status delivered',
        icon: 'assets/aacd-c1b09.svg', fleet: `${candidate.machines.length} Impressoras FDM`,
        technicalLabel: 'CAPACIDADE TÉCNICA', technical: 'Engenharia Biomédica',
        materials: ['Materiais sujeitos à validação clínica AACD']
      });
      remove('reviews', id);
      return candidate;
    },
    async listHomePartners() { return state.homePartners; },
    async listMatches() { return state.matches; },
    async getProfile(area) { return state.profiles[area]; },
    async saveProfile(area, record) { state.profiles[area] = record; return record; },
    async getCurrentUser() { return state.currentUser; },
    async generateRequestCode(material) {
      if (!MATERIALS.includes(material)) throw new TypeError('Escolha um material válido.');
      const id=String(++codeSequence);return {id,material,code:material+'-'+id.padStart(6,'0')};
    }
  };
}
