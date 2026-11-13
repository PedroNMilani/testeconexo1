import { ORDER_STATUS, ORDER_STATUS_UI } from './order-status.js';
import {
  backendEnabled,
  api,
  sessionUser,
  profileFromUser,
  saveProfileToApi,
  sessionKey
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
// No modo conectado, leituras e alterações usam a API; os exemplos ficam restritos à prévia estática.
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
function orderView(record) {
  const statuses = {
    pendente: ORDER_STATUS.NOT_ACCEPTED,
    em_producao: ORDER_STATUS.IN_PRODUCTION,
    recusado: ORDER_STATUS.REFUSED,
    cancelado: ORDER_STATUS.CANCELLED,
    finalizado: ORDER_STATUS.FINISHED
  };
  const snapshot =
    typeof record.snapshot === 'string'
      ? JSON.parse(record.snapshot)
      : record.snapshot;
  return {
    id: record.id,
    requestId: record.id_solicitacao,
    code: record.codigo || 'SOL-' + record.id_solicitacao,
    device: record.codigo || 'Solicitação ' + record.id_solicitacao,
    lab: snapshot?.lab || record.lab,
    material: record.material,
    status: statuses[record.status],
    priority: { padrao: 'Padrão', medio: 'Médio', urgente: 'Urgente' }[
      record.prioridade
    ],
    partnerId: record.id_parceiro,
    scope: 'aacd',
    requester: 'AACD — ' + record.unidade,
    volumes: {
      X: String(record.capacidade_x),
      Y: String(record.capacidade_y),
      Z: String(record.capacidade_z)
    },
    nozzles: [String(record.bico_mm)],
    url: record.link,
    notes: record.observacoes || '',
    deadline: '',
    started: '',
    completedDate: ['finalizado', 'cancelado', 'recusado'].includes(
      record.status
    )
      ? new Intl.DateTimeFormat('pt-BR', {
          timeZone: 'America/Sao_Paulo'
        }).format(new Date(record.atualizado_em))
      : '',
    statusNote: ORDER_STATUS_UI[statuses[record.status]].label
  };
}
function requestBody(draft) {
  return {
    code: draft.code,
    priority: draft.priority,
    volumes: Object.fromEntries(
      ['X', 'Y', 'Z'].map((axis, i) => [
        axis,
        Number(
          Array.isArray(draft.volumes) ? draft.volumes[i] : draft.volumes[axis]
        )
      ])
    ),
    materials: draft.materials,
    nozzles: draft.nozzles.map(Number),
    url: draft.url,
    notes: draft.notes
  };
}
export async function cancelOrder(id) {
  return api('/pedidos/' + encodeURIComponent(id) + '/acoes/cancelar', {
    method: 'POST'
  });
}
export async function listRequests() {
  return backendEnabled &&
    sessionUser?.perfil === 'aacd' &&
    sessionUser.homologado
    ? (await api('/solicitacoes')).items
    : [];
}
export async function getRequest(id) {
  return api('/solicitacoes/' + encodeURIComponent(id));
}
if (backendEnabled) {
  source.listOrders = async () => {
    if (!sessionUser?.homologado) return [];
    const actor = sessionKey();
    const result = await api('/pedidos');
    return actor === sessionKey() ? result.items.map(orderView) : [];
  };
  source.getOrder = async (id) =>
    orderView(await api('/pedidos/' + encodeURIComponent(id)));
  source.createOrder = async (record) => {
    const created = await api('/pedidos', {
      method: 'POST',
      body: { request: requestBody(record), selection: record.selection }
    });
    return source.getOrder(created.id);
  };
  for (const [method, action] of [
    ['acceptOrder', 'aceitar'],
    ['finishOrder', 'finalizar'],
    ['refuseOrder', 'recusar']
  ])
    source[method] = async (id) => {
      await api('/pedidos/' + encodeURIComponent(id) + '/acoes/' + action, {
        method: 'POST'
      });
      return source.getOrder(id);
    };
  source.listHistory = async () =>
    sessionUser?.perfil === 'parceiro'
      ? (await source.listOrders()).filter((o) =>
          [
            ORDER_STATUS.FINISHED,
            ORDER_STATUS.CANCELLED,
            ORDER_STATUS.REFUSED
          ].includes(o.status)
        )
      : [];
  source.listMatches = async (draft) => {
    if (!draft || sessionUser?.perfil !== 'aacd' || !sessionUser.homologado)
      return [];
    const { items } = draft.requestId
      ? await api(
          '/solicitacoes/' +
            encodeURIComponent(draft.requestId) +
            '/recomendacoes'
        )
      : await api('/recomendacoes', {
          method: 'POST',
          body: requestBody(draft)
        });
    return items.map((m, i) => ({
      ...m,
      id: String(i),
      recommended: i === 0,
      description: m.printerName,
      icon: 'assets/aacd-4631c.svg',
      score: String(m.distanceKm) + ' km',
      scoreIcon: 'assets/aacd-8da20.svg',
      scoreLabel: 'Distância em linha reta',
      scoreNote: 'Origem: unidade AACD',
      specs: [
        m.printerName,
        m.material + ' • bico ' + m.nozzle + ' mm',
        m.needsMaterial ? 'AACD fornece material' : 'Material disponível'
      ],
      note: m.needsMaterial
        ? 'A AACD deverá fornecer o material escolhido.'
        : 'O parceiro dispõe do material escolhido.'
    }));
  };
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
