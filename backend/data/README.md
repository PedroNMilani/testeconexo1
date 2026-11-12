# Limites geográficos para o MVP

`brasil-estados.geojson` foi obtido em 10/11/2026 de https://raw.githubusercontent.com/codeforgermany/click_that_hood/main/public/data/brazil-states.geojson . Preserva as coordenadas dos 27 polígonos e as propriedades de nome, sigla e código IBGE; remove metadados do catálogo e espaços para reduzir o arquivo. O backend usa os polígonos para rejeitar coordenadas fora do Brasil e os centros das caixas dos estados apenas como sugestão inicial de pino em caso de falha. Um centro sugerido nunca é confirmado automaticamente.

Fonte do arquivo: projeto Click That 'Hood, Code for Germany; propriedades incluem códigos IBGE. Não foi alegado download direto do IBGE nem precisão cadastral. Validar/atualizar a fonte geográfica antes de produção. O formulário exige confirmação do usuário.
