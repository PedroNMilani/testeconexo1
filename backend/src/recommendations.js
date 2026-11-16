import { check } from './errors.js';
import { needsMaterialSupply } from './material-catalog.js';
import { insideBrazil } from './geo.js';
import { validateRequest, requireApprovedUser } from './request-validation.js';

export function haversine(a, b) {
  const rad = (v) => (v * Math.PI) / 180;
  const dlat = rad(b.latitude - a.latitude),
    dlon = rad(b.longitude - a.longitude);
  const h =
    Math.sin(dlat / 2) ** 2 +
    Math.cos(rad(a.latitude)) *
      Math.cos(rad(b.latitude)) *
      Math.sin(dlon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}
export function compatibleOptions(printer, request) {
  if (
    !printer.ativa ||
    !['x', 'y', 'z'].every(
      (axis) =>
        Number(printer.capacidade[axis]) >=
        Number(request['capacidade_' + axis])
    )
  )
    return [];
  const options = [];
  const supportedNozzles = printer.bicos.map(Number);
  for (const material of request.materials) {
    if (!printer.materiais_compativeis.includes(material)) continue;
    for (const nozzle of request.nozzles) {
      if (!supportedNozzles.includes(nozzle)) continue;
      options.push({
        material,
        nozzle,
        needsMaterial: needsMaterialSupply(
          printer.materiais_compativeis,
          printer.materiais_disponiveis,
          material
        )
      });
    }
  }
  return options;
}

// Filtra a capacidade e ordena pela distância; não cria pedidos.
export function createRecommendationService({
  pool,
  printers,
  config,
  requests
}) {
  async function matches(user, id) {
    const request = await requests.getRequest(user, id);
    return recommend(request);
  }
  async function preview(user, body) {
    requireApprovedUser(user);
    check(user.perfil === 'aacd', 'Acesso reservado à AACD.', 403);
    const values = validateRequest(body),
      origin = config.unitLocations?.[user.unidade];
    check(
      origin && insideBrazil(origin.latitude, origin.longitude),
      'Configure a localização confirmada da unidade AACD para calcular as distâncias.',
      409,
      'UNIT_LOCATION_REQUIRED'
    );
    return recommend({
      materials: values.materials,
      nozzles: values.nozzles,
      capacidade_x: values.volumes.X,
      capacidade_y: values.volumes.Y,
      capacidade_z: values.volumes.Z,
      origem_latitude: origin.latitude,
      origem_longitude: origin.longitude
    });
  }
  async function recommend(request) {
    check(!request.encerrada_em, 'Esta solicitação já foi encerrada.', 409);
    const [[active]] = await pool.execute(
      "SELECT COUNT(*) AS n FROM pedido WHERE id_solicitacao=? AND status IN ('pendente','em_producao')",
      [request.id || 0]
    );
    check(
      !Number(active.n),
      'Já existe um pedido ativo para esta solicitação.',
      409
    );
    const [partners] = await pool.execute(
      'SELECT id,nome_instituicao,cidade,uf,latitude,longitude FROM parceiro WHERE homologado=TRUE ORDER BY id'
    );
    check(
      request.origem_latitude !== null && request.origem_longitude !== null,
      'Configure a origem da unidade para esta solicitação.',
      409,
      'UNIT_LOCATION_REQUIRED'
    );
    const eligible = await printers.compatible(request);
    const byId = new Map(
      partners.map((partner) => [String(partner.id), partner])
    );
    const items = [];
    for (const printer of eligible) {
      const partner = byId.get(String(printer.id_parceiro));
      if (!partner) continue;
      const distance = haversine(
        {
          latitude: Number(request.origem_latitude),
          longitude: Number(request.origem_longitude)
        },
        {
          latitude: Number(partner.latitude),
          longitude: Number(partner.longitude)
        }
      );
      for (const option of compatibleOptions(printer, request))
        items.push({
          partnerId: String(partner.id),
          printerId: printer._id,
          name: partner.nome_instituicao,
          location: partner.cidade + ' / ' + partner.uf,
          printerName: printer.modelo,
          distanceKm: Number(distance.toFixed(2)),
          ...option
        });
    }
    return items.sort(
      (a, b) =>
        a.distanceKm - b.distanceKm ||
        a.partnerId.localeCompare(b.partnerId) ||
        a.printerId.localeCompare(b.printerId) ||
        a.material.localeCompare(b.material) ||
        a.nozzle - b.nozzle
    );
  }
  return { matches, preview };
}
