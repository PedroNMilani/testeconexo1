# Como acompanhar o código do CoNexo

A aplicação roda no servidor local Node/Express. As telas usam a API para carregar e alterar os registros. Não existe mais fonte de demonstração, login fictício ou cadastro mantido apenas em memória.

## Por onde começar

| Parte | Arquivos | Responsabilidade |
| --- | --- | --- |
| Telas e apresentação | `index.html`, `styles.css` | Estrutura visual e estilos. |
| Interações | `app.js`, `aacd.js`, `partner.js` | Ler os campos, reagir aos cliques e atualizar a tela. |
| Navegação | `router.js`, `auth-client.js` | Selecionar a tela e conferir a sessão/homologação. |
| Interface de dados | `data.js` | Reexportar funções de comunicação com a API, mantendo os imports das telas. |
| Chamadas HTTP | `client-api/orders.js`, `printers.js`, `partners.js`, `profiles.js` | Chamar os endpoints de cada área. |
| Formato dos dados | `client-api/views.js` | Converter os nomes e tipos retornados pela API para os campos usados na interface. Não consulta banco nem altera registros. |
| Transporte e sessão | `auth-client.js` | Executar `fetch`, enviar cookie/CSRF e informar erros do servidor. |
| Inicialização do backend | `backend/src/server.js`, `app.js` | Conectar aos bancos, configurar Express e instalar as rotas. |

## Exemplo: conectar uma solicitação a um parceiro

1. `aacd.js` lê os requisitos preenchidos e a opção selecionada pelo usuário.
2. A tela chama `data.createOrder(...)`. O arquivo `data.js` encaminha essa função para `client-api/orders.js`.
3. O cliente HTTP envia `POST /api/pedidos`, com os requisitos e a seleção da impressora/material/bico. A sessão identifica a conta; o frontend não concede permissões.
4. `backend/src/routes/orders.js` recebe a requisição e chama `orders.createAndConnect(...)`.
5. `requests.js` valida e cria a solicitação, ou reutiliza a mesma solicitação quando há uma nova tentativa com requisitos iguais.
6. `orders.js` bloqueia a solicitação e o parceiro na transação, confere se já existe um pedido ativo e revalida a impressora. A validação de compatibilidade fica em `recommendations.js`.
7. O pedido e o evento de criação são gravados. O servidor responde com o identificador do pedido.
8. `client-api/orders.js` consulta o pedido salvo. `views.js` converte a resposta e a tela atualiza a lista e os contadores.

## Divisão das regras de solicitações e pedidos

| Módulo do backend | O que deve ficar nele |
| --- | --- |
| `request-validation.js` | Validar código, prioridade, dimensões, materiais, bicos e link. Também concentra as verificações de identificador e conta homologada usadas por esses serviços. |
| `requests.js` | Criar e consultar a demanda da AACD, seus materiais/bicos e os requisitos usados para reutilizar uma solicitação após uma falha ou recusa. |
| `recommendations.js` | Comparar a capacidade X/Y/Z sem rotação, montar as opções de material/bico e ordenar pela distância calculada com Haversine. |
| `orders.js` | Encaminhar uma tentativa, consultar pedidos, aplicar aceite/recusa/cancelamento/finalização e registrar o histórico. |
| `routes/orders.js` | Definir os endereços HTTP e encaminhar cada chamada ao serviço correto. |
| `db.js` | Abrir a conexão MySQL e executar uma transação com confirmação, desfazimento e liberação da conexão. |

`withTransaction(pool, action)` confirma todas as operações SQL da função recebida. Se alguma falhar, executa rollback. Isso não cria uma transação distribuída com o MongoDB: a edição da impressora e a criação do pedido continuam usando o bloqueio da mesma linha de parceiro no MySQL para coordenar as operações da aplicação.

As transições usam propriedades com nomes: `role` indica quem pode agir, `from` os estados permitidos, `to` o estado resultante e `event` o registro de histórico. Assim não é necessário interpretar posições como `rule[0]` ou `rule[2]`.

## Exemplos removidos e dados reais

Foram removidos `mock-data.js`, `memory-source.js`, o seletor `runtime-config.js` e as alternativas de navegação sem autenticação. O frontend também não preenche mais o perfil com uma conta de exemplo quando não há sessão correspondente.

Quando o banco não possui registros, as listas ficam vazias. Se a API falhar, o erro é mostrado; não aparecem registros de substituição. O resumo da solicitação mostra o código, material, volume, prioridade e unidade vindos do fluxo real. O prazo fixo de cinco dias foi retirado, pois não correspondia a um campo cadastrado.

Os testes possuem suas próprias fixtures, criadas exclusivamente nos bancos descartáveis terminados em `_test`. Elas não são importadas pela aplicação nem criadas no banco utilizado pela equipe.

## O que foi preservado

- Endpoints, campos das requisições e respostas, sessão, CSRF e homologação.
- MySQL para contas/solicitações/pedidos e MongoDB para impressoras.
- Isolamento dos pedidos por unidade AACD e por parceiro proprietário.
- Um único pedido ativo por solicitação, histórico das recusas e encerramento após cancelamento/finalização.
- Banco e cadastros existentes: esta refatoração não exige uma nova migração SQL.

Os módulos de tela continuam responsáveis por seus eventos e renderização. A divisão desta etapa torna explícito o caminho entre tela, API, regras e banco; outras simplificações podem ser feitas em blocos posteriores.
