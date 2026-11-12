import {
  backendEnabled,
  api,
  sessionUser,
  profileFromUser,
  saveProfileToApi
} from './auth-client.js';
import { createMockData } from './mock-data.js';
import { createMemorySource } from './memory-source.js';

// Contrato assíncrono independente da origem dos dados. Um adaptador HTTP poderá
// implementar estes mesmos métodos; as telas continuam usando esta interface.
const methods = [
  'listPrinters',
  'getPrinter',
  'savePrinter',
  'removePrinter',
  'listOrders',
  'getOrder',
  'createOrder',
  'acceptOrder',
  'finishOrder',
  'refuseOrder',
  'listHistory',
  'listPartners',
  'listReviews',
  'reviewPartner',
  'listMatches',
  'listHomePartners',
  'getProfile',
  'saveProfile',
  'getCurrentUser',
  'generateRequestCode'
];
export function createDataService(source) {
  return Object.freeze(
    Object.fromEntries(
      methods.map((method) => {
        if (typeof source[method] !== 'function')
          throw new TypeError(`Fonte sem o método ${method}`);
        return [
          method,
          async (...args) =>
            structuredClone(await source[method](...structuredClone(args)))
        ];
      })
    )
  );
}
const source = createMemorySource(createMockData());
// Fatia atual: contas, perfis, impressoras, homologação e geração de código usam a API.
// Pedidos/match continuam no protótipo em memória, com aviso explícito na interface.
function printerView(record) {
  return {
    id: record._id,
    name: record.modelo,
    asset: 'bambu',
    label: 'IMPRESSORA FDM',
    kind: 'FDM',
    available: record.ativa,
    materials: record.materiais_compativeis,
    materialsAvailable: record.materiais_disponiveis,
    nozzles: record.bicos.map(String),
    volumes: {
      X: String(record.capacidade.x),
      Y: String(record.capacidade.y),
      Z: String(record.capacidade.z)
    },
    needsMaterial: record.precisa_material ? 'Sim' : 'Não'
  };
}
function candidateView(record) {
  return {
    id: record.id,
    name: record.nome_instituicao,
    description: record.cidade + ' / ' + record.uf,
    info: [
      {
        label: 'RESPONSÁVEL',
        value: record.responsavel,
        note: '',
        icon: 'assets/aacd-1ff05.svg'
      },
      {
        label: 'CONTATO',
        value: record.email,
        note: record.telefone,
        icon: 'assets/aacd-b8992.svg'
      },
      {
        label: 'LOCALIZAÇÃO',
        value: record.cidade + ' / ' + record.uf,
        note: record.rua,
        icon: 'assets/aacd-ebe27.svg'
      },
      {
        label: 'IMPRESSORAS CADASTRADAS',
        value: String(record.impressoras.length),
        note: '',
        icon: 'assets/aacd-da6d7.svg'
      }
    ],
    machines: record.impressoras.map((printer) => ({
      name: printer.modelo,
      kind: 'FDM',
      specs: [
        'Vol: ' + Object.values(printer.capacidade).join('×') + ' mm',
        'Bicos: ' + printer.bicos.join(' / ') + ' mm',
        'Materiais: ' + printer.materiais_compativeis.join(', ')
      ]
    }))
  };
}
if (backendEnabled) {
  source.getCurrentUser = async () =>
    sessionUser ? { ...sessionUser, role: sessionUser.perfil } : null;
  source.listPrinters = async () =>
    sessionUser?.perfil === 'parceiro'
      ? (await api('/impressoras')).items.map(printerView)
      : [];
  source.getPrinter = async (id) =>
    printerView(await api('/impressoras/' + encodeURIComponent(id)));
  source.savePrinter = async (record) =>
    printerView(
      await api(
        '/impressoras' + (record.id ? '/' + encodeURIComponent(record.id) : ''),
        {
          method: record.id ? 'PATCH' : 'POST',
          body: {
            modelo: record.name,
            capacidade: {
              x: Number(record.volumes.X),
              y: Number(record.volumes.Y),
              z: Number(record.volumes.Z)
            },
            bicos: record.nozzles.map(Number),
            materiais_compativeis: record.materials,
            materiais_disponiveis: record.materialsAvailable || []
          }
        }
      )
    );
  source.removePrinter = async (id) =>
    printerView(
      await api('/impressoras/' + encodeURIComponent(id), { method: 'DELETE' })
    );
  const originalProfile = source.getProfile;
  source.getProfile = async (area) =>
    (area === 'aacd' && sessionUser?.perfil === 'aacd') ||
    (area === 'partner' && sessionUser?.perfil === 'parceiro')
      ? profileFromUser(area, (await api('/auth/me')).user)
      : originalProfile(area);
  source.saveProfile = async (area, record) =>
    saveProfileToApi(area, record, record._location);
  source.generateRequestCode = async (material) =>
    api('/solicitacoes/codigos', { method: 'POST', body: { material } });
  source.listPartners = async () => {
    if (sessionUser?.perfil !== 'aacd' || !sessionUser.homologado) return [];
    return (await api('/parceiros?homologado=true')).items.map((record) => ({
      id: record.id,
      name: record.nome_instituicao,
      location: record.cidade + ' / ' + record.uf,
      statusLabel: 'Homologado',
      statusClass: 'aacd-status finished',
      icon: 'assets/aacd-c1b09.svg',
      fleet: record.impressoras.length + ' Impressoras FDM',
      technicalLabel: 'RESPONSÁVEL',
      technical: record.responsavel,
      materials: [
        ...new Set(
          record.impressoras.flatMap((printer) => printer.materiais_compativeis)
        )
      ]
    }));
  };
  source.listReviews = async () =>
    sessionUser?.perfil === 'aacd' && sessionUser.homologado
      ? (await api('/parceiros?homologado=false')).items.map(candidateView)
      : [];
  source.reviewPartner = async (id, approved) => {
    if (!approved)
      throw new Error(
        'Nesta etapa, registre a homologação após a avaliação externa.'
      );
    const records = await source.listReviews();
    const candidate = records.find((item) => item.id === id);
    await api('/parceiros/' + encodeURIComponent(id) + '/homologacao', {
      method: 'POST',
      body: { homologado: true }
    });
    return candidate;
  };
  source.listHomePartners = async () =>
    (await source.listReviews()).map((record) => ({
      name: record.name,
      description: record.description,
      icon: 'assets/aacd-c6315.svg',
      approve: true
    }));
}
const service = createDataService(source);
export const {
  listPrinters,
  getPrinter,
  savePrinter,
  removePrinter,
  listOrders,
  getOrder,
  createOrder,
  acceptOrder,
  finishOrder,
  refuseOrder,
  listHistory,
  listPartners,
  listReviews,
  reviewPartner,
  listMatches,
  listHomePartners,
  getProfile,
  saveProfile,
  getCurrentUser,
  generateRequestCode
} = service;

export { ORDER_STATUS, ORDER_STATUS_UI } from './order-status.js';
