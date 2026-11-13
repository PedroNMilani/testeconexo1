# CoNexo — backend conectado: contas, impressoras e pedidos

Implementado: cadastro e login dos dois perfis, bcrypt, sessão persistente em MySQL, homologação de contas AACD e parceiros, perfil próprio, cadastro/edição/soft delete de impressoras no MongoDB, confirmação de localização e geração de código com material e ID numérico.

Solicitações e pedidos agora persistem no MySQL; as impressoras continuam no MongoDB. O modo conectado consulta a API para recomendações, pedidos e histórico. A prévia estática continua usando exemplos em memória.

A geração de código reserva um identificador; a solicitação é criada ao encaminhar o pedido. Se o encaminhamento falhar após a criação, a solicitação permanece disponível para nova tentativa. Um código é único dentro da unidade AACD, e uma solicitação pode ter várias tentativas, com apenas um pedido ativo por vez.

## Rodar no Windows / CMD

Requer Node.js 24+, MySQL Server 8.0.16+ ou 8.4 e MongoDB 7+. MySQL Workbench e Compass são clientes; os servidores precisam estar iniciados. Não exige Bash ou Docker.

Mantenha também o `package.json` da raiz do repositório: ele declara os arquivos JavaScript compartilhados, como `material-catalog.js`, como ES Modules. As dependências continuam sendo instaladas apenas na pasta `backend`.

No Workbench, prepare um schema e usuário de desenvolvimento (substitua a senha):

```sql
CREATE DATABASE IF NOT EXISTS conexo CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE USER IF NOT EXISTS 'conexo_app'@'localhost' IDENTIFIED BY 'defina-uma-senha-do-banco';
GRANT SELECT,INSERT,UPDATE,DELETE,CREATE,ALTER,INDEX,REFERENCES ON conexo.* TO 'conexo_app'@'localhost';
```

Essa é a credencial do servidor MySQL, diferente da conta AACD da aplicação. Para produção, separar permissões de migração das permissões de execução.

No CMD:

```bat
cd C:\caminho\testeconexo1\backend
copy .env.example .env
notepad .env
npm ci
npm run db:init
```

Preencha `MYSQL_*`, `MONGO_*`, `AACD_UNITS`, `SESSION_SECRET` e os campos `SEED_AACD_*`. Gere a chave de sessão com:

```bat
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Copie a saída para `SESSION_SECRET`. O programa recusa o placeholder. Não envie `.env` ao GitHub. As unidades padrão são as opções do protótipo, configuráveis em `AACD_UNITS`; precisam ser conferidas pela equipe. Configure `NOMINATIM_USER_AGENT` com identificação e contato reais para permitir a busca de endereço. Sem configuração, a busca informa indisponibilidade e não libera a confirmação do pino.

Crie a primeira conta com o seed e inicie:

```bat
npm run seed:aacd
npm start
```

Abra **http://localhost:3000/**. Também há `iniciar.bat`, `preparar-bancos.bat` e `seed-aacd.bat`. O seed usa bcrypt custo 12, cria a primeira conta homologada e não altera/promove contas que já existam. Não insira a senha da aplicação em texto puro no Workbench. Depois de criar a conta, os valores `SEED_AACD_*` podem ser removidos do `.env` de execução.

O primeiro usuário é entregue pela equipe à AACD. Todos os usuários AACD já homologados podem homologar novas contas. Login de uma conta AACD pendente apenas informa a pendência; não libera as funções protegidas. O botão AACD/Parceiro não concede perfil: o servidor obtém o perfil pelas credenciais.

## Compatibilidade com os arquivos enviados

- `db/001-base.sql`: cópia da base MySQL enviada, preservando `aacd` e `parceiro` separados.
- `db/mongo-base.js`: referência original enviada, não executada automaticamente.
- `db/003-pedidos.sql`: adiciona código, unidade, observações, origem e encerramento da solicitação, snapshot do pedido e histórico de eventos. A migração confere as colunas existentes e preserva registros.
- `db/002-auth.sql`: adiciona `aacd.nome_titular` e a tabela de reserva de códigos. Não exclui cadastros nem redefine senhas.
- `db/impressoras-validator.json`: validator da implementação, com tipos numéricos BSON explícitos e campos compatíveis com a coleção enviada.
- `db:init` cria as tabelas da base apenas em schema vazio. Se houver base parcial, para sem executar DROP. Em base completa, aplica somente a migração controlada; não sobrescreve o validator de uma coleção já existente. Pode ser repetido após conclusão, preservando registros.

O script espera o schema **dos anexos**, não a proposta histórica que possuía uma tabela única `usuario`. Não aplique aquela proposta sobre esta implementação. Faça cópia de segurança antes de aplicar migrações no seu ambiente. Nesta entrega só foram usados bancos descartáveis de teste, sem acesso ao banco de Pedro.

## Fluxos e decisões aplicadas

A etapa final do cadastro parceiro agora é a confirmação de localização. Foram retirados horas semanais e necessidade geral de material do parceiro; o fluxo continua com três etapas. A primeira impressora usa modelo, capacidade, bicos, materiais compatíveis e disponíveis.

SQL e Mongo não compartilham transação. Por isso, a interface trata a conta criada como sucesso parcial: se a impressora falhar, informa o ocorrido e permite repetir só a gravação da impressora. Não apaga automaticamente a conta e não tenta cadastrá-la novamente. A senha é limpa do formulário após autenticação.

Compatíveis filtram o match; disponíveis informam fornecimento. `needsMaterialSupply()` calcula a necessidade pelo **material escolhido**, com resposta também em `necessidade_por_material` no DTO da impressora. O campo legado Mongo `precisa_material` é mantido como resumo de haver algum compatível indisponível; não prevalece sobre a resposta por material e não deve ser usado como filtro de match.

Um mesmo email não pode criar novas contas nos dois perfis. Uma curta transação serializada por lock MySQL consulta as duas tabelas; bcrypt é calculado antes do lock. O lock global também cobre equivalências da collation, inclusive acentos. Se já existirem duplicidades criadas manualmente, o login informa ambiguidade, sem escolher perfil pelo botão.

A conta não pode trocar a própria unidade via perfil; isso permitiria contornar o isolamento de pedidos por unidade. Uma correção administrativa de unidade ainda precisa de fluxo definido. A homologação de contas AACD é institucional: contas homologadas podem aprovar colegas de outra unidade. Solicitações e pedidos só podem ser lidos e administrados por contas AACD da mesma unidade. Parceiros veem apenas os próprios pedidos e precisam estar homologados.

O backend verifica permissões e homologação a cada chamada protegida; usa SQL parametrizado, filtros Mongo construídos no servidor, cookie HttpOnly/SameSite, CSRF e limite de tentativas. Não usa JWT/localStorage para autenticação. Senhas acima de 72 bytes UTF-8 são rejeitadas para evitar truncamento bcrypt.

Nominatim é chamado no backend, com fila global de uma requisição/segundo, cache e busca estruturada sem número. Se a rua não for encontrada, consulta a cidade e exige ajuste do pino antes de confirmar. Se não houver resultado ou a consulta falhar, informa o erro e permite nova tentativa, sem sugerir o centro do estado. O mapa exige confirmação do pino; o backend verifica a coordenada confirmada contra polígonos brasileiros, não apenas uma caixa. Fonte e limites de precisão estão em `data/README.md`. O marcador aceita arraste e ajuste pelas setas. Alterar endereço invalida a confirmação; trocar de conta reinicializa o mapa para a pessoa correta.

As imagens do mapa vêm diretamente de `https://tile.openstreetmap.org`, com atribuição visível. A camada do Leaflet usa `referrerPolicy: 'strict-origin-when-cross-origin'` para enviar a origem do site, exigida pela [política de uso de tiles do OpenStreetMap](https://operations.osmfoundation.org/policies/tiles/), sem enviar caminhos ou parâmetros da página. A política geral do backend continua `same-origin`; a exceção é específica das imagens do mapa. O teste `tests/map_visibility.py` verifica esse cabeçalho sem acessar o serviço externo.

Na execução conectada, Express serve apenas os estáticos permitidos, sem publicar `.env`, código do backend ou SQL. `runtime-config.js` liga a autenticação real; falha da API não faz fallback para login fictício. Abrir com `python -m http.server` continua sendo o protótipo explícito, sem persistência.

## Pedidos, recomendações e fila

- As coordenadas das sete unidades fornecidas pela equipe estão em `src/units.js`. Elas definem a origem da distância; o destino é a localização confirmada do parceiro. `AACD_UNIT_LOCATIONS` pode substituir esse mapa por um objeto JSON, sem alterar o código. Coordenadas inválidas impedem a inicialização. Unidades sem coordenadas não podem criar solicitações nem calcular recomendações.
- Mongo filtra impressoras ativas por dimensões X/Y/Z, sem rotação, e ao menos um material e bico aceitáveis. MySQL restringe os parceiros aos homologados. Haversine ordena as opções pela distância, sem percentual de compatibilidade fictício e sem usar prioridade na recomendação.
- Cada opção identifica uma impressora, um material e um bico; o botão de conexão envia explicitamente essa seleção. Estoque não elimina opções: informa quando a AACD precisa fornecer o material.
- Antes de conectar, o servidor revalida propriedade, atividade, homologação e capacidade. Edição/remoção de impressoras e criação de pedidos bloqueiam a mesma linha do parceiro no MySQL para serializar operações da aplicação entre SQL e Mongo. Isso não constitui transação distribuída nem cobre gravações manuais externas.
- Aceitar: `pendente → em_producao`; recusar: `pendente → recusado`; finalizar: `em_producao → finalizado`. Essas ações são do parceiro dono do pedido. Cancelar: `pendente/em_producao → cancelado`, por uma conta AACD da unidade solicitante.
- Recusa preserva o pedido e libera nova tentativa na mesma solicitação. Cancelamento e finalização encerram a solicitação. Repetir uma transição ou conectar uma solicitação encerrada retorna conflito.
- Cada transição grava autor, perfil e horário em `pedido_evento`. O pedido preserva o nome da impressora, laboratório e necessidade de fornecimento no snapshot, além de material/bico/distância nas colunas próprias.
- A fila pendente do parceiro usa urgente primeiro e, depois, peso da prioridade mais dias de espera desde a criação da solicitação. `QUEUE_MEDIUM_WEIGHT` (7) e `QUEUE_STANDARD_WEIGHT` (0) são configuráveis e ainda representam decisões da equipe.
- Códigos, link, materiais, bicos, dimensões inteiras em mm e observações são validados no servidor. Por enquanto links HTTP/HTTPS sem credenciais são aceitos; uma lista restrita de provedores ainda depende de definição da equipe. Nenhum arquivo é baixado pelo backend.

## API

| Recurso | Rotas |
| --- | --- |
| Sessão e contas | `GET /api/auth/csrf`, `POST /api/auth/cadastros/aacd`, `POST /api/auth/cadastros/parceiros`, `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout` |
| Perfil | `PATCH /api/me` — somente cadastro próprio, sem promoção de perfil/homologação/unidade |
| Homologação | `GET /api/aacd/pendentes`, `POST /api/aacd/:id/homologacao`, `GET /api/parceiros?homologado=true|false`, `POST /api/parceiros/:id/homologacao` |
| Impressoras | `GET/POST /api/impressoras`, `GET/PATCH/DELETE /api/impressoras/:id` — proprietário, soft delete |
| Localização | `POST /api/localizacoes/geocodificar`, `GET /api/catalogos` |
| Código | `POST /api/solicitacoes/codigos` com `{material:"PETG"}` — AACD homologada, ID atribuído pelo banco |
| Solicitações | `GET/POST /api/solicitacoes`, `GET /api/solicitacoes/:id` — AACD homologada da unidade |
| Recomendações | `POST /api/recomendacoes` (prévia sem persistência), `GET /api/solicitacoes/:id/recomendacoes` |
| Pedidos | `GET/POST /api/pedidos`, `GET /api/pedidos/:id`, `POST /api/solicitacoes/:id/pedidos` |
| Estados e auditoria | `POST /api/pedidos/:id/acoes/aceitar|recusar|finalizar|cancelar`, `GET /api/pedidos/:id/eventos` |
| Diagnóstico | `GET /api/health` — disponibilidade básica da API/MySQL, sem segredos |

## Verificação e limites

Para testes de integração, configure uma cópia `.env.test` com `NODE_ENV=test` e bancos **descartáveis** cujos nomes terminem em `_test`. Use o mesmo formato de `.env.example`; nunca aponte a suíte para a base real.

```bat
node --env-file=.env.test scripts\init-db.js
npm test
```

O teste de navegador conectado está em `../tests/backend_browser.py`; requer Playwright/Chromium, backend de teste rodando e `SEED_AACD_EMAIL`/`SEED_AACD_PASSWORD` do seed de teste no ambiente. Para iniciá-lo no CMD, carregue essas variáveis no terminal e execute `python ..\tests\backend_browser.py` com `NODE_ENV=test` e `CONEXO_BACKEND_URL=http://localhost:3000/`.

Validação desta etapa: 31 testes automatizados com MySQL 8.4 e MongoDB 7.0 descartáveis, incluindo concorrência, permissões, revalidação de impressoras, transições e auditoria; contrato de dados da prévia; Chromium conectado com criação, reload, recusa, reencaminhamento, aceite, finalização e histórico. A migração foi executada novamente para verificar repetição sem perda de dados. Nenhum banco de Pedro foi acessado.

Para reproduzir o navegador, com o backend de teste ativo e Playwright/Chromium instalados:

```bat
node --env-file=.env.test tests/seed-orders-browser.js
set NODE_ENV=test
set CONEXO_BACKEND_URL=http://localhost:3001/
python ../tests/orders_browser.py
```

A fixture fica na pasta temporária do sistema. `CONEXO_ORDERS_FIXTURE` pode definir outro caminho tanto na geração quanto no teste. O gerador só aceita `NODE_ENV=test` e bancos terminados em `_test`; as contas e credenciais são exclusivamente de teste.

Serviços externos de geocodificação, tiles e e-mail não fazem parte dessa validação. O teste de pedidos bloqueia os provedores visuais externos e usa as coordenadas informadas pela equipe para calcular o match. Os scripts `.bat` não foram executados no Windows.

**Pendente:** recuperação de senha por e-mail depende de escolher/configurar um provedor. A interface informa que o serviço está indisponível e não simula envio. Implantação HTTPS, credenciais de produção e eventual restrição de hosts dos links precisam de configuração própria; o servidor continua escutando em loopback.

Regressão de visibilidade do mapa, sem banco: `python ../tests/map_visibility.py`. Verifica prévia estática e catálogo do backend pendente, com imagens externas bloqueadas explicitamente. O mapa é montado antes das consultas de inicialização.
