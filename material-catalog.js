// Lista controlada compartilhada entre navegador e backend; ainda não validada pela AACD.
export const MATERIALS = Object.freeze(['PLA', 'PETG', 'ABS', 'TPU']);

export function needsMaterialSupply(compatible, available, selected) {
  if (!compatible.includes(selected)) throw new TypeError('O material escolhido não é compatível.');
  return !available.includes(selected);
}
