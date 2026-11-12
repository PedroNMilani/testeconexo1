# Entrega atual — primeira fatia conectada

Registro de 10/11/2026. Documentação de execução e limites: [backend/README.md](backend/README.md). As seções históricas abaixo registram o que existia antes desta implementação.

## Decisões firmes preservadas

- Dois perfis, bcrypt, somente FDM, soft delete de impressora e divisão MySQL/Mongo conforme combinado com o professor.
- Sem upload, estrelas, impressoras internas da AACD ou logística de entrega.

## Decisões da equipe — não validadas pela AACD

- Todos os integrantes AACD já homologados podem homologar novas contas AACD. A equipe cria e entrega a primeira conta pelo seed.
- Origem da distância: solicitante. Interpretação para a próxima fatia: unidade solicitante; ainda é necessário cadastrar suas coordenadas reais.
- Código digitável ou gerado, usando um material escolhido e um ID numérico. Implementado: botão, seleção do material e reserva persistente de ID; salvar a Solicitação/Pedido real é a próxima fatia.
- Necessidade de fornecimento calculada pelo material escolhido, segundo sua presença em disponíveis. Implementado: função compartilhada e DTO por material. O booleano legado é apenas resumo, não autoridade nem filtro.
- Finalizar encerra a Solicitação, sem tratar entrega. Cancelar retira das listas ativas e mantém o Pedido cancelado no banco, conforme esclarecimento de Pedro.
- Contas AACD devem ver pedidos da própria unidade. Essa regra, encerramento, cancelamento e histórico de recusas serão aplicados à API de pedidos na próxima fatia. O protótipo em memória ainda conserva regras antigas e é identificado como demonstração na interface.

## Sugestões técnicas aplicadas nesta fatia

- Node/Express e sessão persistente no MySQL, com cookie HttpOnly, CSRF e revalidação do perfil/homologação no servidor. O botão de login não define o perfil autenticado.
- Preservadas as duas tabelas de contas do banco enviado. Cadastros/edições usam uma transação curta serializada para garantir email único entre os perfis, incluindo equivalências da collation; duplicidades manuais existentes não são escolhidas arbitrariamente no login.
- A migração adiciona nome do titular AACD e tabela de reserva de códigos; não substitui os anexos pela proposta histórica de tabela única de usuários.
- Unidade bloqueada na edição da própria conta para evitar que alguém amplie o acesso mudando de unidade. Correções administrativas ainda precisam de fluxo definido.
- Cadastro em três etapas mantido; etapa final passa a confirmar localização. A primeira impressora é persistida no Mongo após criar/autenticar a conta. Falha nessa gravação é informada e pode ser repetida sem duplicar a conta.
- Mapas e perfis reinicializam dados ao trocar de conta. Polígonos brasileiros validam o país; a consulta estruturada não envia número do endereço ao Nominatim.

## Escopo entregue e pendências

Entregues cadastro/login, seed bcrypt, homologação AACD/parceiro, perfil próprio, impressoras Mongo e soft delete, mapa/confirmacão e botão de código. Não foram implementados pedidos/match persistentes, máquina nova de estados nas telas, isolamento de pedidos por unidade, recuperação por email ou implantação pública. A lista de materiais e os pesos de fila continuam sem validação da AACD.

Os testes usaram bancos descartáveis. Nenhum banco de Pedro foi acessado. Resultados e limitações constam no README do backend.

---

## Histórico da proposta e da refatoração anterior

### Proposta inicial de backend

Atualizado em 10/11/2026. Este registro separa o que foi decidido de fato, o que foi escolhido pela equipe sem validação da AACD e o que foi sugerido pelo colaborador técnico. Documentação: [diagnóstico](docs/backend/DIAGNOSTICO.md), [proposta](docs/backend/PROPOSTA.md), [DDL](docs/backend/mysql-proposta.sql), [validator Mongo](docs/backend/mongo-validator-proposta.json).

## Vigência

O pedido novo de backend substitui as decisões provisórias anteriores quando houver conflito. O código da aplicação não foi atualizado nesta etapa: permanece um protótipo na branch `fase-1-dados`, com três status e recusa sem histórico. A `main` ainda contém apenas o merge do teste da etapa 1. Nenhum merge foi feito agora.

## Decisões firmes

| ID | Decisão | Motivo / origem |
| --- | --- | --- |
| F01 | Apenas perfis AACD e Parceiro; cadastro, autenticação, impressoras, solicitação, match, pedidos/status e homologação dentro do escopo | Escopo confirmado por Pedro |
| F02 | Fora: impressoras internas da AACD, entrega, upload, estrelas e resina; somente FDM | Escopo confirmado; evita transformar a plataforma em marketplace genérico |
| F03 | Senhas com bcrypt; homologação controla uso; parceiro não homologado fora do match; AACD não homologada sem funções de negócio | Regras confirmadas por Pedro |
| F04 | Homologação de parceiro acontece fora; a plataforma registra resultado por usuário AACD | Processo confirmado; não inventar verificação/certificação automática |
| F05 | Primeira conta AACD criada por seed já homologada, senha gerada em bcrypt antes do INSERT | Bootstrap operacional; texto puro no Workbench não atende ao login bcrypt |
| F06 | Verificação do domínio do email AACD fica fora por ora | Decisão explícita; não confundir com domínio do link de arquivo |
| F07 | Mongo armazena impressoras e listas de materiais/bicos; MySQL armazena usuários, parceiros/coordenadas, solicitações e pedidos | Divisão combinada com o professor; integridade relacional e documentos de capacidade |
| F08 | Impressora usa soft delete | Preserva referências de pedidos |
| F09 | Match no backend: Mongo filtra; MySQL fornece parceiros homologados/coordenadas; Haversine ordena por distância | Fluxo confirmado; Mongo não ordena geograficamente |
| F10 | Comparação direta X/Y/Z, sem rotação; compatível filtra, disponível só informa; distância gravada no Pedido | Critérios confirmados; prioridade não altera match |
| F11 | Arquivo contém só molde, sem dados pessoais de paciente; LGPD permanece relevante ao cadastro | Contexto informado por Pedro |

## Decisões da equipe — não validadas pela AACD

| ID | Decisão / proposta | Limite / pendência |
| --- | --- | --- |
| E01 | Solicitação e Pedido separados, com tabelas filhas para materiais/bicos; Solicitação sem status próprio | Estado derivado e encerramento após cancelamento/finalização precisam de regra |
| E02 | Materiais aceitáveis funcionam como OU; Pedido armazena apenas o escolhido | Pressupõe equivalência declarada pela AACD para cada peça |
| E03 | Uma Solicitação pode ter várias tentativas de Pedido, com no máximo uma pendente/em produção | Preservar tentativas recusadas; não atualizar a mesma linha apagando o parceiro anterior |
| E04 | Estados: pendente, em produção, recusado, cancelado, finalizado; sem expiração automática | Matriz de autoria/transições na proposta; substitui os três status do protótipo |
| E05 | Urgente primeiro; médio=7, padrão=0, mais idade desde criação da Solicitação | Pesos configuráveis; só fila pendente do parceiro, nunca score de match; interpretação dos dias ainda proposta |
| E06 | Endereço estruturado, Nominatim, confirmação/arraste Leaflet, aproximação da cidade com ajuste obrigatório do pino; coordenada confirmada dentro do Brasil | Não representa validação da localização por terceiro nem validação da AACD |
| E07 | Link provavelmente limitado a Google Drive/OneDrive; tipo STL/G-code irrelevante | Lista exata de hosts ainda não validada |

## Sugestões técnicas — aguardam aprovação

| ID | Sugestão | Motivo / trade-off |
| --- | --- | --- |
| S01 | Basear integração na `fase-1-dados` após revisar/consolidar a branch | Reaproveita fronteira de dados e templates; main ainda tem bug conhecido |
| S02 | Monólito Node.js LTS/Express em JavaScript ES modules, drivers SQL/Mongo diretos | Menor mudança de linguagem; exige aprender HTTP, sessões e transações, sem ORM/microserviços |
| S03 | Sessão de servidor em MySQL, cookie HttpOnly, CSRF e mesma origem SPA/API | Logout e homologação mais simples que gerenciar JWT/revogação; store persistente necessário |
| S04 | Coluna gerada UNIQUE por solicitação ativa, além de transação e lock na Solicitação | MySQL consegue impor parte da regra; protege contra duas chamadas simultâneas |
| S05 | Registrar bico escolhido e usar FKs compostas de material/bico aceitos | Mantém decisão de fabricação e reduz inconsistência |
| S06 | Tabela de unidades com coordenadas de origem | Necessária se distância partir da unidade; confirmar central x unidade antes de popular |
| S07 | Preservar referência/observações da Solicitação e nome do titular AACD existentes na UI | Campos não constavam da proposta de schema enviada; confirmar antes de implementar |
| S08 | Geocodificação no backend com fila global 1 req/s, cache, identificação e erro explícito quando a consulta falha | Navegadores separados não garantem limite global; não incluir número na consulta |
| S09 | Validar ponto em polígono do Brasil versionado | Bounding box inclui países vizinhos; dado geográfico precisa ser escolhido/versionado |
| S10 | Disponibilidade/necessidade de material por opção escolhida | Booleano global pode contradizer listas por material; não removido do schema sem aprovação |
| S11 | Revalidar impressora/dono/atividade/homologação/capacidade na criação; coordenar escrita por lock consultivo MySQL se exigida proteção contra corrida | Sem FK ou transação distribuída MySQL–Mongo; todos os writers precisam seguir o protocolo |
| S12 | Primeira fatia começar com AACD seed/login/sessão/logout, depois parceiro com mapa | Cadastro parceiro completo inclui geocodificação, não é somente bcrypt; ambos na mesma fatia têm escopo maior |

## Perguntas e pendências antes de codar

1. Aprovar stack, sessão e branch-base.
2. Definir quem homologa novas contas AACD; não há terceiro perfil inventado.
3. Definir origem da distância e fornecer coordenadas de unidade/central confirmadas.
4. Definir escolha explícita de material/bico e retenção dos campos extras já existentes na UI.
5. Resolver booleano manual versus disponibilidade por material.
6. Definir encerramento/reencaminhamento após finalização/cancelamento e escopo de cancelamento entre contas AACD.
7. Validar lista de materiais, pesos 7/0 e domínios do link com a equipe/professor; não apresentá-los como validação da AACD.
8. Definir composição da etapa de cadastro que ainda mostra horas/logística e necessidade de material; não removida ou reorganizada silenciosamente.
9. Definir serviço de recuperação de senha e eventual exportação CSV paginada; não prometer envio de email inexistente.
10. Definir retenção e aviso de privacidade para dados cadastrais/geocodificação. Não há dados de paciente no contrato informado.

Esta etapa produziu somente diagnóstico e proposta. SQL, validator e seed não foram aplicados. Não há backend implementado nem publicação no GitHub. O registro abaixo é preservado como histórico do protótipo, não como requisito vigente do backend.

---

## Registro histórico da refatoração do front-end — anterior ao pedido de backend

### Decisões da camada de dados

- A aplicação continua estática, sem backend nem persistência. `data.js` é a única interface assíncrona consumida pelas telas. A fonte em memória é substituível por outro adaptador com o mesmo contrato. Leituras e escritas atravessam cópias; as telas não recebem referências internas.
- Impressoras são somente FDM. Os três registros iniciais têm materiais aptos, bicos, volume X/Y/Z e necessidade de material. Todos são exemplos; dimensões e necessidade de material são placeholders fictícios. Os rótulos de material e o bico dos cards existentes foram preservados. Nenhum campo visual foi acrescentado.
- O único enum de pedidos é `ORDER_STATUS`: `não aceito`, `em produção`, `finalizado`. Classes, rótulos e filtros de pedidos são derivados dele. Disponibilidade do parceiro e prioridade não são status de pedido.
- **Provisório:** `não aceito` significa aguardando aceite do parceiro, até validação com o professor.
- Aceitar inicia a produção. Concluir finaliza o pedido. Recusar mantém `não aceito`, remove a associação ao parceiro e não gera evento nem registro de histórico.
- Histórico de Produção é uma leitura dos pedidos finalizados daquele parceiro. Não existe status de cancelamento nem registro de recusa.
- Entrega não faz parte do modelo. O exemplo antes mostrado em trânsito é tratado como produção finalizada; os exemplos antes entregues também são finalizados. Os exemplos antigos de histórico “Em andamento” e “Cancelado” não foram convertidos em finalizados.

### Pendências do protótipo

- **Recusa sem histórico:** decisão provisória a validar com o professor.
- **Cancelamento sem representação no modelo:** não há status, evento, filtro ou aba de cancelamento.
- **Materiais:** a lista e as substituições fictícias para materiais FDM ainda não foram validadas com a AACD.
- “Precisa de material?” poderia ser derivado do estoque e dos materiais aptos; permanece declarado por impressora por simplicidade. “Sim” significa que a AACD precisa fornecer o material.
- Endereço permanece texto livre, sem latitude/longitude.
- Autenticação e papel real de usuário ainda não existem; `getCurrentUser()` é apenas um contrato com exemplo fictício. A seleção atual da demonstração não constitui autenticação.
- A futura lista de domínios permitidos para links depende da AACD. Nesta etapa foi preservada a validação existente de protocolo HTTP/HTTPS; o alinhamento da interface permanece fora desta refatoração.
- O modelo difere do combinado com o professor quanto à necessidade de material e à prioridade informativa.
- Fonte vazia e seus estados vazios ficam para a etapa 4. Nenhum deles foi implementado nesta etapa.
