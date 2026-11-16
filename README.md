# CoNexo — aplicação local

Aplicação em HTML, CSS, Bootstrap e JavaScript, com backend Node/Express, MySQL e MongoDB. As telas carregam exclusivamente a API. Os dados de demonstração e o login fictício foram removidos.

## Executar

Configure `backend/.env` a partir de `backend/.env.example` conforme o [guia do backend](backend/README.md). Com Node.js 24+, MySQL e MongoDB iniciados, execute na raiz do projeto:

```sh
npm --prefix backend ci
npm --prefix backend run db:init
npm --prefix backend run seed:aacd
npm start
```

O seed é necessário somente para criar a primeira conta AACD. Acesse **http://localhost:3000/**. O comando `npm start` inicia o Node/Express, que atende às telas e à API na mesma origem. Para reiniciar automaticamente após alterações no backend, use `npm run dev`.

## Navegação e telas

Todas as telas estão declaradas como `<section data-page>` dentro de um único `<main>`. O JavaScript alterna `hidden` e `inert`, atualiza o título e gerencia o foco. Os formulários permanecem no DOM ao navegar. Os links para as seções e a History API permitem usar Voltar/Avançar sem recarregar a página.

| Seção | Conteúdo |
| --- | --- |
| `#sobre-nos` | Sobre Nós |
| `#login` | Login AACD e Parceiro |
| `#termos-uso` | Termos completos do cadastro do parceiro |
| `#parceiro-dados` | Dados do Parceiro — etapa 1 |
| `#parceiro-equipamentos` | Capacidade Técnica e Equipamentos — etapa 2 |
| `#parceiro-logistica` | Confirmação da localização — etapa 3 |
| `#cadastro-aacd` | Cadastro AACD |
| `#parceiro-inicio` | Início do parceiro, impressoras e histórico de produção |
| `#parceiro-pedidos` | Pedidos ativos e pendentes |
| `#parceiro-impressora` | Adição/edição e remoção de impressoras |
| `#parceiro-perfil` | Edição dos dados da instituição |
| `#aacd-inicio` | Painel Minhas Conexões |
| `#aacd-pedidos` | Histórico e atividades da rede |
| `#aacd-parceiros` | Rede de parceiros ativos |
| `#aacd-homologacao` | Fila de análise e homologação de parceiros |
| `#aacd-pedido-1` | Novo pedido — informações gerais e prioridade |
| `#aacd-pedido-2` | Novo pedido — volumes, materiais e bicos |
| `#aacd-pedido-3` | Novo pedido — URL do arquivo e observações |
| `#aacd-conectar` | Recomendações e conexão do pedido a um laboratório |
| `#aacd-perfil` | Edição do perfil AACD |

O acesso requer conta cadastrada e homologada. A seleção AACD/Parceiro organiza a interface de login; o servidor identifica o perfil pelas credenciais.

As impressoras usam cadastro, edição e soft delete no MongoDB. Os cards são atualizados com os registros reais. No celular, a lista funciona como carrossel horizontal.

## Solicitações e pedidos

A AACD preenche código, prioridade, materiais, bicos, dimensões e link. O servidor calcula as opções de fabricação e a distância a partir da unidade solicitante. O parceiro pode aceitar, recusar e finalizar; a AACD pode cancelar um pedido da própria unidade. Recusa mantém a tentativa no histórico e permite reencaminhar a solicitação. Cancelamento e finalização encerram a solicitação.

O histórico permite busca, filtros por estado/material/prioridade, detalhes e exportação CSV. Contadores e listas usam os dados retornados pelo banco. Quando não houver registros, a interface mostra o estado vazio.

## Estrutura

```text
frontend/
  index.html          Telas e templates HTML
  css/
    styles.css        Estilos da aplicação
  js/
    app.js            Inicialização, login e cadastros
    aacd.js           Inicialização da área AACD
    partner.js        Inicialização da área do parceiro
    ui/               Formulários, cards e ações de cada tela
    client-api/       Chamadas HTTP e conversão das respostas
    auth-client.js    Sessão, transporte HTTP e CSRF
    router.js         Navegação entre as telas
    location-ui.js    Mapa, busca e confirmação do pino
    shared-ui.js      Funções pequenas usadas pelas telas
    data.js           Interface de dados usada pelas telas
    order-status.js   Estados, prioridades e rótulos dos pedidos
  assets/             Imagens, ícones e fonte
  vendor/             Bootstrap e Leaflet
backend/
  src/                Rotas, validações, serviços e catálogo de materiais
  db/                 Esquema e migrações
  tests/              Testes do backend
  scripts/            Preparação dos bancos e primeira conta AACD
tests/                Testes de interface e contrato de dados
```

O Express atende somente a pasta `frontend/` como conteúdo estático. O endereço de entrada continua sendo `http://localhost:3000/`, e a API continua em `/api`. O comando `npm start` permanece o mesmo.

## Verificação

Sem banco, com Node.js e Playwright/Chromium instalados:

```sh
node tests/data_contract.mjs
python tests/browser_smoke.py
python tests/location_browser.py
python tests/map_visibility.py
```

Os testes simulam respostas HTTP para conferir a interface sem criar um modo de demonstração. A integração com MySQL/MongoDB e o fluxo conectado de pedidos estão descritos no [guia do backend](backend/README.md).

A recuperação de senha por e-mail continua indisponível até a escolha e configuração de um provedor. O projeto permanece destinado ao servidor local.
