import {
  ORDER_STATUS,
  ORDER_STATUS_UI,
  PRIORITY_LABELS
} from '../order-status.js';

// Converte somente o formato dos dados: resposta da API -> campos usados pelas telas.
export function printerView(record) {
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
      X: Number(record.capacidade.x),
      Y: Number(record.capacidade.y),
      Z: Number(record.capacidade.z)
    }
  };
}
export function candidateView(record) {
  return {
    id: record.id,
    name: record.nome_instituicao,
    description: record.cidade + ' / ' + record.uf,
    info: [
      {
        key: 'responsible',
        label: 'RESPONSÁVEL',
        value: record.responsavel,
        note: '',
        icon: 'assets/aacd-1ff05.svg'
      },
      {
        key: 'contact',
        label: 'CONTATO',
        value: record.email,
        note: record.telefone,
        icon: 'assets/aacd-b8992.svg'
      },
      {
        key: 'location',
        label: 'LOCALIZAÇÃO',
        value: record.cidade + ' / ' + record.uf,
        note: record.rua,
        icon: 'assets/aacd-ebe27.svg'
      },
      {
        key: 'printers',
        label: 'IMPRESSORAS CADASTRADAS',
        value: String(record.impressoras.length),
        note: '',
        icon: 'assets/aacd-da6d7.svg'
      }
    ],
    machines: record.impressoras.map((printer) => ({
      name: printer.modelo,
      kind: 'FDM',
      volumeLabel:
        'Vol: ' + Object.values(printer.capacidade).join('×') + ' mm',
      nozzleLabel: 'Bicos: ' + printer.bicos.join(' / ') + ' mm',
      materialLabel: 'Materiais: ' + printer.materiais_compativeis.join(', ')
    }))
  };
}
export function orderView(record) {
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
    priority: PRIORITY_LABELS[record.prioridade],
    partnerId: record.id_parceiro,
    scope: 'aacd',
    requester: 'AACD — ' + record.unidade,
    volumes: {
      X: Number(record.capacidade_x),
      Y: Number(record.capacidade_y),
      Z: Number(record.capacidade_z)
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
export function requestBody(draft) {
  return {
    code: draft.code,
    priority: draft.priority,
    volumes: {
      X: Number(draft.volumes.X),
      Y: Number(draft.volumes.Y),
      Z: Number(draft.volumes.Z)
    },
    materials: draft.materials,
    nozzles: draft.nozzles.map(Number),
    url: draft.url,
    notes: draft.notes
  };
}
