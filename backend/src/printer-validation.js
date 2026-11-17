import { MATERIALS } from './material-catalog.js';
import { check } from './errors.js';
import { string } from './validations.js';

export function validatePrinter(body) {
  const capacity = body.capacidade;
  check(
    capacity &&
      ['x', 'y', 'z'].every(
        (axis) =>
          typeof capacity[axis] === 'number' &&
          Number.isFinite(capacity[axis]) &&
          capacity[axis] > 0
      ),
    'Informe um volume positivo em X/Y/Z.'
  );
  check(
    Array.isArray(body.bicos) &&
      body.bicos.length > 0 &&
      body.bicos.every(
        (value) =>
          typeof value === 'number' && Number.isFinite(value) && value > 0
      ),
    'Selecione ao menos um bico válido.'
  );
  check(
    Array.isArray(body.materiais_compativeis) &&
      body.materiais_compativeis.length > 0 &&
      body.materiais_compativeis.every((value) => MATERIALS.includes(value)),
    'Selecione materiais compatíveis válidos.'
  );
  check(
    Array.isArray(body.materiais_disponiveis) &&
      body.materiais_disponiveis.every((value) =>
        body.materiais_compativeis.includes(value)
      ),
    'Materiais disponíveis devem ser compatíveis com a impressora.'
  );
  const compatible = [...new Set(body.materiais_compativeis)],
    available = [...new Set(body.materiais_disponiveis)];
  return {
    modelo: string(body.modelo, 'o modelo da impressora'),
    capacidade: { x: capacity.x, y: capacity.y, z: capacity.z },
    bicos: [...new Set(body.bicos)],
    materiais_compativeis: compatible,
    materiais_disponiveis: available,
    // Compatibilidade com o campo do banco enviado: indicação geral, nunca prevalece sobre a opção escolhida.
    precisa_material: compatible.some(
      (material) => !available.includes(material)
    )
  };
}
