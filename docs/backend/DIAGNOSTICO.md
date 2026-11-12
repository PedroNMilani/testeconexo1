> Registro histórico da análise inicial. A implementação atual e suas decisões estão em [backend/README.md](../../backend/README.md) e [DECISIONS.md](../../DECISIONS.md). A proposta de tabela única de usuários não foi aplicada; a base enviada posteriormente foi preservada.

# CoNexo — diagnóstico para integração com backend

Data: 10/11/2026. Etapa somente de leitura do código da aplicação. As fases abaixo são as do novo pedido de backend, distintas das etapas anteriores da refatoração do protótipo.

## Categorias e precedência

- **Firme:** escopo confirmado por Pedro, incluindo decisões combinadas com o professor.
- **Equipe — não validada pela AACD:** escolhas descritas como propostas/suposições da equipe.
- **Sugestão:** recomendação técnica deste diagnóstico, ainda sujeita à aprovação.

O documento novo substitui as decisões provisórias antigas onde houver conflito. Isso não significa que o código já foi atualizado. Em particular, o protótipo refatorado ainda tem três status e recusa sem histórico; o backend proposto passará a ter cinco status e preservará cada tentativa em um Pedido, se a equipe mantiver sua proposta.

## 1. Qual versão está no GitHub

Consultei a API do GitHub, não apenas o checkout local:

| Referência | Commit observado | Conteúdo |
| --- | --- | --- |
| `main` | `e3f01b5ce62ed2b50bd799ffcfb77fffddb4cd94` | Merge do PR #1, contendo apenas o teste de regressão da etapa 1 |
| `fase-1-dados` | `21b4469474f70ace19e92a64731abe979984a9a0` | Troca para FDM, API em memória, templates, módulos ES e status anteriores |

A comparação entre `c5616e6` e `main` mostrou **zero arquivos diferentes**. Por isso, executei o smoke da `main` em uma exportação temporária de `c5616e6`, sem trocar a branch de trabalho. A comparação `main...fase-1-dados` mostrou cinco commits à frente e um atrás: as branches divergiram pelo merge da etapa 1. Não é correto dizer que a refatoração inteira já está na principal.

**Sugestão:** revisar e consolidar `fase-1-dados` antes da integração, preservando a organização dos módulos e atualizando as regras que o pedido novo substituiu. Nenhum merge foi feito nesta etapa.

## 2. O que existe e pode ser reaproveitado

Há vinte seções de uma SPA em HTML, CSS e Bootstrap local. A navegação mantém os formulários no DOM, alterna `hidden`/`inert`, atualiza o título, foca o cabeçalho e preserva Voltar/Avançar. O cadastro tem progresso verde sobre cinza. Termos completos usam `<br>` e bloqueiam Confirmar até o fim da rolagem. Existem modais de redefinição de senha e avaliação de cadastro.

Na `main`, os scripts são globais e listas no HTML funcionam como banco. `partner.js` mantém registros incompletos, modifica objetos diretamente e clona o primeiro card. `aacd.js` usa total inicial 42 e contadores incrementados pelo texto da tela. Há impressora de resina, entrega e pontuações fictícias de match. Isso exige a limpeza que já existe parcialmente na outra branch.

Na `fase-1-dados`:

| Arquivo | Reaproveitamento | Limitação atual |
| --- | --- | --- |
| `index.html` / `styles.css` | Seções, templates, componentes visuais e responsividade | Campos, rótulos e exemplos precisam acompanhar o contrato novo |
| `router.js` | Navegação, foco, skip-link e histórico | Guarda apenas aceite dos termos; não autentica nem autoriza |
| `data.js` | Fronteira assíncrona; cópias de entradas e saídas; fonte substituível | Assinaturas atuais ainda misturam Solicitação e Pedido |
| `memory-source.js` / `mock-data.js` | Fonte de demonstração e fixtures de teste | Não devem ser importados por uma sessão real de produção |
| `partner.js` | Edição a partir do registro e `render*()` | IDs de demonstração, exclusão física e três status antigos |
| `aacd.js` | Renderização, filtros, CSV e fluxo em três passos | Match pronto/fictício; leitura ampla de todas as listas |
| `shared-ui.js` | Cabeçalhos, formulários de perfil e logout compartilhados | Chaves como `profile-institution` e `displayNames` são apresentação, não schema do banco |
| Testes Playwright e contrato | Regressão da impressora, navegação e interações | Login fictício e expectativa antiga de recusa sem histórico |

**Sugestão:** manter o front-end atual. React, TypeScript e um novo sistema de telas não são necessários para esta entrega. Uma API HTTP pode ocupar a fronteira de `data.js`, com um mapeamento explícito entre JSON da API e apresentação.

## 3. Acoplamentos concretos e limpeza necessária

Referências abaixo são da branch `fase-1-dados`, commit `21b4469`.

| Evidência | Problema para o backend | Encaminhamento sugerido |
| --- | --- | --- |
| `app.js:96` e seguintes | Qualquer email/senha que passe a validação HTML navega; o botão seleciona a área | `POST /api/auth/login`; papel e homologação vêm do servidor; depois `GET /api/auth/me` |
| `router.js:35` e `app.js:27` | Abrir um hash interno funciona sem autenticação | Guardas visuais e tratamento de 401/403; autorização efetiva em cada endpoint |
| `app.js:110`–`126` | Cadastro só navega e abre um modal; não cria usuário | Juntar os passos e enviar um payload final; confirmação de senha não é persistida |
| `index.html:314`–`420` | Cadastro não tem telefone; UF é texto, número é obrigatório; não há mapa | Acrescentar telefone, UF em select, número opcional e confirmação do pino; revisar bairro |
| `index.html:605` e `index.html:1306` | Cadastro/perfil AACD exigem nome do titular, ausente da lista de campos firme enviada | Proponho preservá-lo como `nome_titular`; confirmar a ampliação do schema |
| `index.html:509`–`545` | Ainda há horas semanais e necessidade de material no parceiro | Retirar campos fora do contrato. A etapa 3 ficaria quase só com observações; decidir a composição antes de remover/reorganizar a etapa |
| `memory-source.js:33` | `removePrinter` remove de verdade | DELETE HTTP deve fazer soft delete no Mongo; o documento permanece para os pedidos históricos |
| `partner.js:63`, `aacd.js:311` | `current-partner` e associação pelo índice `match.id === '0'` | Identidade da sessão; candidato contém IDs reais de parceiro e impressora |
| `aacd.js:189`–`203` | Percentuais, recomendações e certificações dos exemplos são desenhados como fatos | Match real sem pontuação; remover afirmações fictícias sem base nos registros |
| `aacd.js:224` | `listMatches()` independe de uma solicitação | `GET /api/solicitacoes/:id/matches` exige dimensões, materiais e bicos persistidos |
| `aacd.js:309` | Um único `createOrder` recebe demanda inteira e `materials.join(', ')` | Primeiro criar Solicitação; depois criar Pedido escolhendo um material e um bico entre os aceitos |
| `aacd.js:237` e `index.html:1180` | Bicos vêm marcados; rótulos tratam especificação da peça como impressora | “Materiais aceitos pela peça”, “Bicos aceitos pela peça”; nenhuma opção implicitamente aceita |
| `aacd.js:247` | Aceita qualquer domínio HTTP/HTTPS | Regra de hostname configurável no servidor; repetir no cliente apenas para feedback |
| `order-status.js` e `memory-source.js:54` | Três status; recusa perde vínculo | Migrar para a máquina de cinco estados proposta pela equipe; manter o Pedido recusado e criar outra tentativa quando houver novo encaminhamento |
| `shared-ui.js:22` | Logout só limpa o campo da senha | Destruir sessão no servidor e remover o cookie |
| `shared-ui.js:31` | Perfil contém nomes de inputs e apresentação | DTO com `nome`, `email`, `telefone`, endereço etc.; nunca enviar `homologado` ou `perfil` em uma edição genérica |
| `aacd.js:223`, inicialização em `app.js` | Pré-carrega áreas de ambos os perfis | Buscar somente após conhecer usuário/perfil; uma área não deve quebrar por receber 403 da API da outra |

As mensagens de erro existentes e o uso de `textContent` devem ser preservados. Uma fonte HTTP também exige controles de carregamento, erro e listas realmente vazias; isso é trabalho futuro, não foi acrescentado nesta leitura.

O rascunho de cadastro pode permanecer nos controles do navegador até concluir, como hoje. Caso se queira cadastrar a primeira impressora no mesmo fluxo, o registro relacional e o documento Mongo não terão uma transação conjunta. Recomendo inicialmente concluir a conta e cadastrar a impressora depois, sem fingir atomicidade. Essa mudança de fluxo depende da aprovação de Pedro.

## 4. Telas, endpoints e dados

Todos os endpoints abaixo são **sugestões de contrato**, não funcionalidades já implementadas. Permissões estão detalhadas na proposta. O prefixo comum é `/api`.

| Tela / componente | Endpoint(s) necessário(s) | Dados principais |
| --- | --- | --- |
| Sobre Nós | Nenhum obrigatório | Conteúdo institucional estático |
| Login | `GET /auth/csrf`, `POST /auth/login`, `GET /auth/me` | Email/senha enviados; usuário, perfil e homologação recebidos |
| Cadastro Parceiro — dados | `GET /catalogos/ufs`, `POST /localizacoes/geocodificar` | Nome, responsável, telefone, endereço e coordenada a confirmar |
| Cadastro Parceiro — termos/equipamentos/conclusão | `POST /auth/cadastros/parceiros`; depois `POST /impressoras` | Aceite dos termos; conta e primeira impressora são recursos distintos |
| Cadastro AACD | `GET /unidades`, `POST /auth/cadastros/aacd` | Email, telefone, senha e unidade; sem homologação enviada pelo cliente |
| Modal de avaliação | Resposta 201 do cadastro | Mensagem de aguardando homologação; não cria um segundo recurso |
| Modal de redefinição | Contrato futuro, a decidir | Hoje não envia email. Não afirmar envio real. Serviço/token de recuperação não entra silenciosamente na primeira fatia |
| Cabeçalhos / conta / sair | `GET /auth/me`, `POST /auth/logout` | Perfil e nome; cookie de sessão gerido pelo navegador |
| Perfil Parceiro / AACD | `GET /me`, `PATCH /me`; geocodificação ao alterar endereço | Campos editáveis permitidos para o perfil; coordenada confirmada |
| Início do parceiro | `GET /impressoras`, `GET /pedidos?status=pendente`, `GET /pedidos?status=em_producao`, `GET /pedidos?status=finalizado` | Impressoras próprias e pedidos do parceiro; totais retornados pela API |
| Impressora — adicionar / editar / remover | `GET /impressoras/:id`, `POST /impressoras`, `PATCH /impressoras/:id`, `DELETE /impressoras/:id` | Modelo, capacidade, bicos, compatíveis, disponíveis, precisa de material; dono inferido da sessão |
| Pedidos do parceiro | `GET /pedidos`, `GET /pedidos/:id`, `POST /pedidos/:id/aceite`, `/recusa`, `/finalizacao` | Fila ordenada no backend, material/bico escolhidos, solicitante e status |
| Histórico de produção do parceiro | `GET /pedidos?status=finalizado` | Apenas finalizados; tentativas recusadas/canceladas permanecem no histórico da solicitação |
| Início AACD | `GET /resumo`, `GET /parceiros?homologado=false` | Contagens calculadas e solicitações de homologação; sem indicadores fictícios |
| Rede de parceiros | `GET /parceiros?homologado=true`, `GET /parceiros/:id` | Nome, localização, equipamentos e situação de homologação |
| Homologação de parceiros | `GET /parceiros?homologado=false`, `POST /parceiros/:id/homologacao` | Dados reais do cadastro; registra resultado externo, sem fabricar certificação |
| Nova solicitação — três passos | `POST /solicitacoes` ao finalizar os campos | Prioridade, X/Y/Z, materiais e bicos aceitáveis, link; ID AACD vem da sessão |
| Conectar aos parceiros | `GET /solicitacoes/:id/matches`, `POST /solicitacoes/:id/pedidos` | Candidatos por impressora, distância, opções de material/bico, disponibilidade por material |
| Acompanhamento AACD | `GET /solicitacoes`, `GET /solicitacoes/:id`, `GET /pedidos`, `GET /pedidos/:id`, `POST /pedidos/:id/cancelamento` | Estado derivado da solicitação e histórico de suas tentativas |
| Exportar CSV | Dados já autorizados retornados por `GET /pedidos`; endpoint de exportação pode ser adiado | Mesmos filtros. Paginação real exige definir exportação de todas as páginas, sem exportar apenas as visíveis por engano |

`GET /pedidos` limita automaticamente o parceiro autenticado aos seus pedidos. Nenhum `id_parceiro` livre na query pode ampliar seu acesso. Dados de contato completos e endereço pessoal de voluntário não devem ser expostos numa lista pública de parceiros.

## 5. Testes realmente executados

| Execução nesta etapa | Resultado |
| --- | --- |
| Smoke da árvore equivalente à `main`, exportada para `/tmp` | **Falhou**, código 1, em `tests/browser_smoke.py:175`: a edição da impressora inicial não aceita salvar sem preencher dados ausentes |
| Smoke da `fase-1-dados` | **Passou**, código 0, incluindo as três impressoras, responsividade, termos e regras antigas de status |
| `node tests/data_contract.mjs` na `fase-1-dados` | **Passou**, incluindo isolamento das cópias e regras anteriores de recusa |

Os testes atuais não comprovam autenticação, persistência, homologação real, fila ponderada nem o novo histórico de recusas. O teste que exige recusa sem histórico deverá mudar junto da implementação do novo modelo, não ser removido para esconder falhas.

Não executei MySQL, MongoDB, geocodificação real, seed, testes de backend nem revisão visual manual. Nenhum código de aplicação foi alterado, nenhum merge foi feito e nenhuma mudança foi publicada no GitHub nesta etapa.
