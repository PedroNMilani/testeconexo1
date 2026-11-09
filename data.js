import { createMockData } from './mock-data.js';
import { createMemorySource } from './memory-source.js';

// Contrato assíncrono independente da origem dos dados. Um adaptador HTTP poderá
// implementar estes mesmos métodos; as telas continuam usando esta interface.
const methods = [
  'listPrinters', 'getPrinter', 'savePrinter', 'removePrinter',
  'listOrders', 'getOrder', 'createOrder', 'saveOrder', 'listHistory', 'addHistory',
  'listPartners', 'listReviews', 'reviewPartner', 'listMatches',
  'getProfile', 'saveProfile', 'getCurrentUser'
];
export function createDataService(source) {
  return Object.freeze(Object.fromEntries(methods.map(method => {
    if (typeof source[method] !== 'function') throw new TypeError(`Fonte sem o método ${method}`);
    return [method, async (...args) => structuredClone(await source[method](...structuredClone(args)))];
  })));
}
const service = createDataService(createMemorySource(createMockData()));
export const {
  listPrinters, getPrinter, savePrinter, removePrinter,
  listOrders, getOrder, createOrder, saveOrder, listHistory, addHistory,
  listPartners, listReviews, reviewPartner, listMatches,
  getProfile, saveProfile, getCurrentUser
} = service;
