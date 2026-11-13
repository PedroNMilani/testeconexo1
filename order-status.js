// Único enum de status de pedido. Prioridade e disponibilidade não são status.
export const ORDER_STATUS = Object.freeze({
  NOT_ACCEPTED: 'não aceito',
  IN_PRODUCTION: 'em produção',
  FINISHED: 'finalizado',
  REFUSED: 'recusado',
  CANCELLED: 'cancelado'
});
export const ORDER_STATUS_UI = Object.freeze({
  [ORDER_STATUS.NOT_ACCEPTED]: Object.freeze({
    label: 'Aguardando aceite',
    filterLabel: 'Aguardando aceite',
    className: '',
    partnerLabel: 'Não aceito',
    partnerClass: 'waiting'
  }),
  [ORDER_STATUS.IN_PRODUCTION]: Object.freeze({
    label: 'Em Produção',
    filterLabel: 'Em Produção',
    className: 'production',
    partnerLabel: 'EM PRODUÇÃO',
    partnerClass: ''
  }),
  [ORDER_STATUS.REFUSED]: Object.freeze({
    label: 'Recusado',
    filterLabel: 'Recusados',
    className: 'cancelled',
    partnerLabel: 'Recusado',
    partnerClass: 'cancelled'
  }),
  [ORDER_STATUS.CANCELLED]: Object.freeze({
    label: 'Cancelado',
    filterLabel: 'Cancelados',
    className: 'cancelled',
    partnerLabel: 'Cancelado',
    partnerClass: 'cancelled'
  }),
  [ORDER_STATUS.FINISHED]: Object.freeze({
    label: 'Finalizado',
    filterLabel: 'Finalizados',
    className: 'finished',
    partnerLabel: 'Finalizado',
    partnerClass: 'done'
  })
});
export function assertOrderStatus(status) {
  if (!Object.values(ORDER_STATUS).includes(status))
    throw new TypeError('Status de pedido inválido.');
}
