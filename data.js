// Interface usada pelas telas. Cada módulo abaixo conversa exclusivamente com a API.
export {
  listPrinters,
  getPrinter,
  savePrinter,
  removePrinter
} from './client-api/printers.js';
export {
  listOrders,
  getOrder,
  createOrder,
  acceptOrder,
  finishOrder,
  refuseOrder,
  cancelOrder,
  listHistory,
  listMatches,
  generateRequestCode,
  listRequests,
  getRequest
} from './client-api/orders.js';
export {
  listPartners,
  listReviews,
  reviewPartner,
  listHomePartners
} from './client-api/partners.js';
export {
  getProfile,
  saveProfile,
  getCurrentUser
} from './client-api/profiles.js';
export {
  ORDER_STATUS,
  ORDER_STATUS_UI,
  PRIORITY_LABELS
} from './order-status.js';
