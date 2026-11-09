// Adaptador privado em memória. Somente data.js é consumido pelas telas.
export function createMemorySource(seed) {
  const state = structuredClone(seed);
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
    async savePrinter(record) { return save('printers', record); },
    async removePrinter(id) { return remove('printers', id); },
    async listOrders(filters = {}) {
      return state.orders.filter(order => Object.entries(filters).every(([key, value]) => order[key] === value));
    },
    async getOrder(id) { return find('orders', id); },
    async createOrder(record) {
      if (state.orders.some(order => order.code === record.code)) throw new Error('Este código de pedido já foi conectado nesta demonstração.');
      return save('orders', { ...record, id: nextId('orders') });
    },
    async saveOrder(record) { return save('orders', record); },
    async listHistory() { return state.history; },
    async addHistory(record) { state.history.unshift(record); return record; },
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
    async getCurrentUser() { return state.currentUser; }
  };
}
