// Exemplos fictícios, sem persistência. Não representam uma base validada pela AACD.
// PLACEHOLDERS: materiais e bicos reproduzem os cards; todos são exemplos.
// Volume X/Y/Z e needsMaterial das três impressoras são placeholders fictícios.
// PENDÊNCIA: validar a lista de materiais com a AACD.
const examples = {
  "printers": [
    {
      "id": "1",
      "name": "Bambu Lab X1-Carbon",
      "asset": "bambu",
      "label": "BAMBU LAB COREXY",
      "kind": "FDM Industrial",
      "available": false,
      "materials": [
        "PETG"
      ],
      "materialLabels": {
        "PETG": "PETG Hospitalar"
      },
      "nozzles": [
        "0.4"
      ],
      "volumes": {
        "X": "200",
        "Y": "200",
        "Z": "200"
      },
      "needsMaterial": "Não"
    },
    {
      "id": "2",
      "name": "Creality Ender 3 S1 Pro",
      "asset": "creality",
      "label": "CREALITY FDM STANDBY",
      "kind": "FDM Standby",
      "available": true,
      "materials": [
        "PLA"
      ],
      "materialLabels": {
        "PLA": "PLA Antibacteriano"
      },
      "nozzles": [
        "0.4"
      ],
      "volumes": {
        "X": "200",
        "Y": "200",
        "Z": "200"
      },
      "needsMaterial": "Não"
    },
    {
      "id": "3",
      "name": "Impressora FDM 03",
      "asset": "bambu",
      "label": "IMPRESSORA FDM 03",
      "kind": "FDM",
      "available": false,
      "materials": [
        "PLA"
      ],
      "materialLabels": {
        "PLA": "PLA"
      },
      "nozzles": [
        "0.4"
      ],
      "volumes": {
        "X": "200",
        "Y": "200",
        "Z": "200"
      },
      "needsMaterial": "Não"
    }
  ],
  "orders": [
    {
      "id": "1092",
      "scope": "aacd",
      "code": "#PED-1092",
      "device": "Órtese Dinâmica Supinadora de Punho",
      "lab": "IMT - FabLab Mauá",
      "material": "PETG Médico Biocompatível",
      "priority": "Urgente",
      "status": "production",
      "statusLabel": "Em Impressão (74%)",
      "statusNote": "Conclusão: Hoje, 15:40",
      "icon": "assets/aacd-f6ed4.svg"
    },
    {
      "id": "1090",
      "scope": "aacd",
      "code": "#PED-1090",
      "device": "Adaptador de Talheres Universal Articulado",
      "lab": "Lab Poli-USP Engenharia",
      "material": "TPU 95A Flexível",
      "priority": "Padrão",
      "status": "transit",
      "statusLabel": "Em Trânsito p/ AACD",
      "statusNote": "Previsão: Amanhã cedo",
      "icon": "assets/aacd-a12d8.svg"
    },
    {
      "id": "1087",
      "scope": "aacd",
      "code": "#PED-1087",
      "device": "Manípulo Anatômico de Joystick Cadeira Motorizada",
      "lab": "IMT - Mauá Núcleo Aditivo",
      "material": "PLA",
      "priority": "Padrão",
      "status": "delivered",
      "statusLabel": "Homologado & Entregue",
      "statusNote": "Concluído em 18/10/24",
      "icon": "assets/aacd-4649e.svg"
    },
    {
      "id": "1082",
      "scope": "aacd",
      "code": "#PED-1082",
      "device": "Extensor de Dedos com Retorno Elástico",
      "lab": "Maker Space Mackenzie",
      "material": "PLA Virgem Atóxico",
      "priority": "Padrão",
      "status": "delivered",
      "statusLabel": "Homologado & Entregue",
      "statusNote": "Concluído em 14/10/24",
      "icon": "assets/aacd-c2b1b.svg"
    },
    {
      "id": "MAU-2024-0892",
      "scope": "partner",
      "partnerId": "current-partner",
      "code": "#MAU-2024-0892",
      "device": "Órtese de Antebraço Personalizada",
      "material": "PLA Biodegradável",
      "requester": "Centro de Reabilitação Mauá",
      "started": "12/10/2024 • 09:30",
      "deadline": "14/10/2024 • 16:00",
      "priority": "Padrão",
      "status": "active"
    },
    {
      "id": "MAU-2024-089",
      "scope": "partner",
      "partnerId": "current-partner",
      "code": "#MAU-2024-089",
      "device": "Mão Ortótica 3D - Modelo 2.0",
      "material": "PLA Biodegradável - Cor: Verde",
      "requester": "Centro de Reabilitação de Mauá",
      "started": "",
      "deadline": "12/10/2024",
      "priority": "Urgente",
      "status": "pending"
    },
    {
      "id": "MAU-2024-091",
      "scope": "partner",
      "partnerId": "current-partner",
      "code": "#MAU-2024-091",
      "device": "Suporte de Cabeça para Cadeira",
      "material": "PETG - Cor: Azul",
      "requester": "APAE - Mauá",
      "started": "",
      "deadline": "15/10/2024",
      "priority": "Padrão",
      "status": "pending"
    }
  ],
  "history": [
    {
      "id": "PED-2026-084",
      "device": "Órtese Dinâmica AFO",
      "material": "PETG Médico",
      "status": "pending",
      "date": "14/20"
    },
    {
      "id": "PED-2026-079",
      "device": "Adaptador de Talher Pediátrico",
      "material": "TPU Flexível",
      "status": "done",
      "date": "10/04"
    },
    {
      "id": "PED-2026-071",
      "device": "Fixador de Punho Bilateral",
      "material": "PLA Biodegradável",
      "status": "cancelled",
      "date": "05/04"
    }
  ],
  "partners": [
    {
      "id": "network-1",
      "name": "Centro Tecnológico Mauá",
      "location": "São Caetano do Sul, SP • Polo Central",
      "statusLabel": "● Disponível (88%)",
      "statusClass": "aacd-status delivered",
      "icon": "assets/aacd-c1b09.svg",
      "fleet": "12 Impressoras FDM",
      "technicalLabel": "CAPACIDADE TÉCNICA",
      "technical": "Alta Precisão",
      "materials": [
        "PETG Biocompatível",
        "PLA Antimicrobiano",
        "Nylon PA12"
      ]
    },
    {
      "id": "network-2",
      "name": "FabLab Poli BioEngenharia",
      "location": "São Paulo, SP • Campus Butantã",
      "statusLabel": "● Operacional (65%)",
      "statusClass": "aacd-status transit",
      "icon": "assets/aacd-4f59e.svg",
      "fleet": "8 FDM Grande Volume",
      "technicalLabel": "ÁREA ÚTIL MÁXIMA",
      "technical": "500 x 500 x 600 mm",
      "materials": [
        "ABS Médico",
        "PETG Cinza",
        "TPU 95A"
      ]
    },
    {
      "id": "network-3",
      "name": "Hub Saúde 3D Campinas",
      "location": "Campinas, SP • Polo Tecnológico",
      "statusLabel": "● Disponível (92%)",
      "statusClass": "aacd-status delivered",
      "icon": "assets/aacd-425c9.svg",
      "fleet": "6 Impressoras FDM",
      "technicalLabel": "PROCESSO DE IMPRESSÃO",
      "technical": "FDM",
      "materials": [
        "PLA",
        "PETG"
      ]
    },
    {
      "id": "network-4",
      "name": "Laboratório BioFab Regional",
      "location": "Santos, SP • Polo Baixada Santista",
      "statusLabel": "● Disponível (74%)",
      "statusClass": "aacd-status delivered",
      "icon": "assets/aacd-a705b.svg",
      "fleet": "10 FDM Extrusão Dupla",
      "technicalLabel": "DUREZA SHORE",
      "technical": "Variável 60A a 95A",
      "materials": [
        "TPU Elastômero",
        "Filamento Copolímero",
        "Poliuretano Flexível"
      ]
    }
  ],
  "reviews": [
    {
      "id": "1",
      "name": "Laboratório BioMaker",
      "description": "Escola Politécnica da USP • Departamento de Mecatrônica e SistemasBiomédicos",
      "info": [
        {
          "label": "RESPONSÁVEL TÉCNICO / CRT",
          "value": "Prof. Dr. Ricardo Albuquerque (CREA 506198)",
          "note": "Especialista em Engenharia Biomédica e Biomecânica",
          "icon": "assets/aacd-1ff05.svg"
        },
        {
          "label": "CONTATO INSTITUCIONAL",
          "value": "contato.biomaker@usp.br",
          "note": "+55 (11) 3091-5000 | Ramal 420",
          "icon": "assets/aacd-b8992.svg"
        },
        {
          "label": "LOCALIZAÇÃO OPERACIONAL",
          "value": "São Paulo, SP • Butantã",
          "note": "Distância calculada até AACD Central: 7.4 km",
          "icon": "assets/aacd-ebe27.svg"
        },
        {
          "label": "CAPACIDADE OPERACIONAL DECLARADA",
          "value": "15 a 20 órteses / mês",
          "note": "Disponibilidade prioritária para ensaios clínicos",
          "icon": "assets/aacd-da6d7.svg"
        }
      ],
      "machines": [
        {
          "name": "Bambu Lab X1-Carbon",
          "kind": "FDM Fechada de Alta Temperatura",
          "specs": [
            "Vol: 256×256×256 mm",
            "Bico: Aço Temperado 0.4mm",
            "Câmara Fechada Ativa"
          ]
        },
        {
          "name": "Creality K1 Max",
          "kind": "FDM Grande Formato",
          "specs": [
            "Vol: 300×300×300 mm",
            "Bico: Bimetal 0.6mm",
            "Nivelamento Automático LiDAR"
          ]
        },
        {
          "name": "Prusa MK4 Enclosed",
          "kind": "FDM Precisão com Enclosure Oficial",
          "specs": [
            "Vol: 250×210×220 mm",
            "Nextruder 0.4mm",
            "Filtro HEPA Integrado"
          ]
        },
        {
          "name": "Impressora FDM 04 (fictícia)",
          "kind": "FDM",
          "specs": [
            "Vol: 218×122×260 mm",
            "Bico: 0.4mm",
            "Materiais: PLA / PETG"
          ]
        }
      ]
    },
    {
      "id": "2",
      "name": "Laboratório BioMaker",
      "description": "Escola Politécnica da USP • Departamento de Mecatrônica e SistemasBiomédicos",
      "info": [
        {
          "label": "RESPONSÁVEL TÉCNICO / CRT",
          "value": "Prof. Dr. Ricardo Albuquerque (CREA 506198)",
          "note": "Especialista em Engenharia Biomédica e Biomecânica",
          "icon": "assets/aacd-1ff05.svg"
        },
        {
          "label": "CONTATO INSTITUCIONAL",
          "value": "contato.biomaker@usp.br",
          "note": "+55 (11) 3091-5000 | Ramal 420",
          "icon": "assets/aacd-b8992.svg"
        },
        {
          "label": "LOCALIZAÇÃO OPERACIONAL",
          "value": "São Paulo, SP • Butantã",
          "note": "Distância calculada até AACD Central: 7.4 km",
          "icon": "assets/aacd-ebe27.svg"
        },
        {
          "label": "CAPACIDADE OPERACIONAL DECLARADA",
          "value": "15 a 20 órteses / mês",
          "note": "Disponibilidade prioritária para ensaios clínicos",
          "icon": "assets/aacd-da6d7.svg"
        }
      ],
      "machines": [
        {
          "name": "Bambu Lab X1-Carbon",
          "kind": "FDM Fechada de Alta Temperatura",
          "specs": [
            "Vol: 256×256×256 mm",
            "Bico: Aço Temperado 0.4mm",
            "Câmara Fechada Ativa"
          ]
        },
        {
          "name": "Creality K1 Max",
          "kind": "FDM Grande Formato",
          "specs": [
            "Vol: 300×300×300 mm",
            "Bico: Bimetal 0.6mm",
            "Nivelamento Automático LiDAR"
          ]
        },
        {
          "name": "Prusa MK4 Enclosed",
          "kind": "FDM Precisão com Enclosure Oficial",
          "specs": [
            "Vol: 250×210×220 mm",
            "Nextruder 0.4mm",
            "Filtro HEPA Integrado"
          ]
        },
        {
          "name": "Impressora FDM 04 (fictícia)",
          "kind": "FDM",
          "specs": [
            "Vol: 218×122×260 mm",
            "Bico: 0.4mm",
            "Materiais: PLA / PETG"
          ]
        }
      ]
    },
    {
      "id": "3",
      "name": "Laboratório BioMaker",
      "description": "Escola Politécnica da USP • Departamento de Mecatrônica e SistemasBiomédicos",
      "info": [
        {
          "label": "RESPONSÁVEL TÉCNICO / CRT",
          "value": "Prof. Dr. Ricardo Albuquerque (CREA 506198)",
          "note": "Especialista em Engenharia Biomédica e Biomecânica",
          "icon": "assets/aacd-1ff05.svg"
        },
        {
          "label": "CONTATO INSTITUCIONAL",
          "value": "contato.biomaker@usp.br",
          "note": "+55 (11) 3091-5000 | Ramal 420",
          "icon": "assets/aacd-b8992.svg"
        },
        {
          "label": "LOCALIZAÇÃO OPERACIONAL",
          "value": "São Paulo, SP • Butantã",
          "note": "Distância calculada até AACD Central: 7.4 km",
          "icon": "assets/aacd-ebe27.svg"
        },
        {
          "label": "CAPACIDADE OPERACIONAL DECLARADA",
          "value": "15 a 20 órteses / mês",
          "note": "Disponibilidade prioritária para ensaios clínicos",
          "icon": "assets/aacd-da6d7.svg"
        }
      ],
      "machines": [
        {
          "name": "Bambu Lab X1-Carbon",
          "kind": "FDM Fechada de Alta Temperatura",
          "specs": [
            "Vol: 256×256×256 mm",
            "Bico: Aço Temperado 0.4mm",
            "Câmara Fechada Ativa"
          ]
        },
        {
          "name": "Creality K1 Max",
          "kind": "FDM Grande Formato",
          "specs": [
            "Vol: 300×300×300 mm",
            "Bico: Bimetal 0.6mm",
            "Nivelamento Automático LiDAR"
          ]
        },
        {
          "name": "Prusa MK4 Enclosed",
          "kind": "FDM Precisão com Enclosure Oficial",
          "specs": [
            "Vol: 250×210×220 mm",
            "Nextruder 0.4mm",
            "Filtro HEPA Integrado"
          ]
        },
        {
          "name": "Impressora FDM 04 (fictícia)",
          "kind": "FDM",
          "specs": [
            "Vol: 218×122×260 mm",
            "Bico: 0.4mm",
            "Materiais: PLA / PETG"
          ]
        }
      ]
    },
    {
      "id": "4",
      "name": "Laboratório BioMaker",
      "description": "Escola Politécnica da USP • Departamento de Mecatrônica e SistemasBiomédicos",
      "info": [
        {
          "label": "RESPONSÁVEL TÉCNICO / CRT",
          "value": "Prof. Dr. Ricardo Albuquerque (CREA 506198)",
          "note": "Especialista em Engenharia Biomédica e Biomecânica",
          "icon": "assets/aacd-1ff05.svg"
        },
        {
          "label": "CONTATO INSTITUCIONAL",
          "value": "contato.biomaker@usp.br",
          "note": "+55 (11) 3091-5000 | Ramal 420",
          "icon": "assets/aacd-b8992.svg"
        },
        {
          "label": "LOCALIZAÇÃO OPERACIONAL",
          "value": "São Paulo, SP • Butantã",
          "note": "Distância calculada até AACD Central: 7.4 km",
          "icon": "assets/aacd-ebe27.svg"
        },
        {
          "label": "CAPACIDADE OPERACIONAL DECLARADA",
          "value": "15 a 20 órteses / mês",
          "note": "Disponibilidade prioritária para ensaios clínicos",
          "icon": "assets/aacd-da6d7.svg"
        }
      ],
      "machines": [
        {
          "name": "Bambu Lab X1-Carbon",
          "kind": "FDM Fechada de Alta Temperatura",
          "specs": [
            "Vol: 256×256×256 mm",
            "Bico: Aço Temperado 0.4mm",
            "Câmara Fechada Ativa"
          ]
        },
        {
          "name": "Creality K1 Max",
          "kind": "FDM Grande Formato",
          "specs": [
            "Vol: 300×300×300 mm",
            "Bico: Bimetal 0.6mm",
            "Nivelamento Automático LiDAR"
          ]
        },
        {
          "name": "Prusa MK4 Enclosed",
          "kind": "FDM Precisão com Enclosure Oficial",
          "specs": [
            "Vol: 250×210×220 mm",
            "Nextruder 0.4mm",
            "Filtro HEPA Integrado"
          ]
        },
        {
          "name": "Impressora FDM 04 (fictícia)",
          "kind": "FDM",
          "specs": [
            "Vol: 218×122×260 mm",
            "Bico: 0.4mm",
            "Materiais: PLA / PETG"
          ]
        }
      ]
    }
  ],
  "matches": [
    {
      "id": "0",
      "name": "Laboratório Mauá de Prototipagem Médica",
      "location": "São Caetano do Sul, SP",
      "description": "Instituto Mauá de Tecnologia • Centro de Fabricação Aditiva Avançada",
      "icon": "assets/aacd-4631c.svg",
      "score": "98%",
      "scoreIcon": "assets/aacd-8da20.svg",
      "scoreLabel": "MATCH TÉCNICO EXATO",
      "scoreNote": "Tolerância dimensional < 0.1mm",
      "recommended": true,
      "specs": [
        "Bambu Lab X1-Carbon",
        "PETG Médico em Estoque",
        "Fila de 0 pedidos na frente"
      ],
      "note": "Homologação Clínica AACD nível Grau II (Órteses Dinâmicas)"
    },
    {
      "id": "1",
      "name": "FabLab Poli-USP BioEngenharia",
      "location": "São Paulo, SP",
      "description": "Universidade de São Paulo • Núcleo de Engenharia Biomédica",
      "icon": "assets/aacd-ecf8a.svg",
      "score": "92%",
      "scoreIcon": "assets/aacd-9e689.svg",
      "scoreLabel": "ALTA COMPATIBILIDADE",
      "scoreNote": "Grande volume de impressão",
      "recommended": false,
      "specs": [
        "Creality CR-M4 (Grande Porte)",
        "PETG Médico Homologado",
        "Fila de 2 pedidos na frente"
      ],
      "note": "Validação de biocompatibilidade e esterilização concluída"
    },
    {
      "id": "2",
      "name": "Maker Hub Saúde 3D & Soluções",
      "location": "Campinas, SP",
      "description": "Laboratório Técnico Certificado • 15 Órteses Homologadas entregues à AACD",
      "icon": "assets/aacd-92f18.svg",
      "score": "87%",
      "scoreIcon": "assets/aacd-13ea3.svg",
      "scoreLabel": "COMPATIBILIDADE APTA",
      "scoreNote": "Histórico clínico validado",
      "recommended": false,
      "specs": [
        "Voron 2.4 Custom 350mm",
        "PETG Médico Premium",
        "Fila de 3 pedidos na frente"
      ],
      "note": "100% de aprovação técnica nos últimos 6 meses"
    }
  ],
  "profiles": {
    "partner": {
      "profile-institution": "Laboratorio Maua",
      "profile-email": "",
      "profile-phone": "",
      "profile-state": "",
      "profile-city": "",
      "profile-district": "",
      "profile-street": "",
      "profile-number": "",
      "profile-responsible": ""
    },
    "aacd": {
      "unit": "",
      "aacd-profile-name": "",
      "aacd-profile-email": "",
      "aacd-profile-phone": ""
    }
  },
  "currentUser": {
    "id": "demo-aacd",
    "role": "aacd",
    "name": "Pedro - AACD"
  }
};

export function createMockData() {
  return structuredClone(examples);
}
