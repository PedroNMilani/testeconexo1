# CoNexo — primeira fatia conectada

Implementado: cadastro e login dos dois perfis, bcrypt, sessão persistente em MySQL, homologação de contas AACD e parceiros, perfil próprio, cadastro/edição/soft delete de impressoras no MongoDB, confirmação de localização e geração de código com material e ID numérico.

**Pedidos e match ainda usam o protótipo em memória.** O modo conectado mostra esse aviso na interface. As regras novas de encerramento, cancelamento, histórico e isolamento de pedidos por unidade estão registradas em `../DECISIONS.md`; suas rotas serão a próxima fatia. A geração de código reserva um identificador em `codigo_solicitacao`; ainda não cria uma Solicitação/Pedido. O ID da reserva não é apresentado como ID de Pedido.

## Rodar no Windows / CMD

Requer Node.js 24+, MySQL Server 8.0.16+ ou 8.4 e MongoDB 7+. MySQL Workbench e Compass são clientes; os servidores precisam estar iniciados. Não exige Bash ou Docker.

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

Copie a saída para `SESSION_SECRET`. O programa recusa o placeholder. Não envie `.env` ao GitHub. As unidades padrão são as opções do protótipo, configuráveis em `AACD_UNITS`; precisam ser conferidas pela equipe. Configure `NOMINATIM_USER_AGENT` com identificação e contato reais para permitir a busca de endereço. Sem configuração, o mapa oferece o estado como referência, exigindo ajuste/confirmação.

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
- `db/002-auth.sql`: adiciona `aacd.nome_titular` e a tabela de reserva de códigos. Não exclui cadastros nem redefine senhas.
- `db/impressoras-validator.json`: validator da implementação, com tipos numéricos BSON explícitos e campos compatíveis com a coleção enviada.
- `db:init` cria as tabelas da base apenas em schema vazio. Se houver base parcial, para sem executar DROP. Em base completa, aplica somente a migração controlada; não sobrescreve o validator de uma coleção já existente. Pode ser repetido após conclusão, preservando registros.

O script espera o schema **dos anexos**, não a proposta histórica que possuía uma tabela única `usuario`. Não aplique aquela proposta sobre esta implementação. Faça cópia de segurança antes de aplicar migrações no seu ambiente. Nesta entrega só foram usados bancos descartáveis de teste, sem acesso ao banco de Pedro.

## Fluxos e decisões aplicadas

A etapa final do cadastro parceiro agora é a confirmação de localização. Foram retirados horas semanais e necessidade geral de material do parceiro; o fluxo continua com três etapas. A primeira impressora usa modelo, capacidade, bicos, materiais compatíveis e disponíveis.

SQL e Mongo não compartilham transação. Por isso, a interface trata a conta criada como sucesso parcial: se a impressora falhar, informa o ocorrido e permite repetir só a gravação da impressora. Não apaga automaticamente a conta e não tenta cadastrá-la novamente. A senha é limpa do formulário após autenticação.

Compatíveis filtram futuramente o match; disponíveis informam fornecimento. `needsMaterialSupply()` calcula a necessidade pelo **material escolhido**, com resposta também em `necessidade_por_material` no DTO da impressora. O campo legado Mongo `precisa_material` é mantido como resumo de haver algum compatível indisponível; não prevalece sobre a resposta por material e não deve ser usado como filtro de match.

Um mesmo email não pode criar novas contas nos dois perfis. Uma curta transação serializada por lock MySQL consulta as duas tabelas; bcrypt é calculado antes do lock. O lock global também cobre equivalências da collation, inclusive acentos. Se já existirem duplicidades criadas manualmente, o login informa ambiguidade, sem escolher perfil pelo botão.

A conta não pode trocar a própria unidade via perfil; isso impediria o futuro isolamento de pedidos por unidade. Uma correção administrativa de unidade ainda precisa de fluxo definido. A homologação de contas AACD é institucional: contas homologadas podem aprovar colegas de outra unidade. A restrição por unidade refere-se aos pedidos, cuja API não faz parte desta fatia.

O backend verifica permissões e homologação a cada chamada protegida; usa SQL parametrizado, filtros Mongo construídos no servidor, cookie HttpOnly/SameSite, CSRF e limite de tentativas. Não usa JWT/localStorage para autenticação. Senhas acima de 72 bytes UTF-8 são rejeitadas para evitar truncamento bcrypt.

Nominatim é chamado no backend, com fila global de uma requisição/segundo, cache e busca estruturada sem número. Há fallback cidade/estado. O mapa exige confirmação do pino; o backend verifica a coordenada confirmada contra polígonos brasileiros, não apenas uma caixa. Fonte e limites de precisão estão em `data/README.md`. O marcador aceita arraste e ajuste pelas setas. Alterar endereço invalida a confirmação; trocar de conta reinicializa o mapa para a pessoa correta.

Na execução conectada, Express serve apenas os estáticos permitidos, sem publicar `.env`, código do backend ou SQL. `runtime-config.js` liga a autenticação real; falha da API não faz fallback para login fictício. Abrir com `python -m http.server` continua sendo o protótipo explícito, sem persistência.

## API desta fatia

| Recurso | Rotas |
| --- | --- |
| Sessão e contas | `GET /api/auth/csrf`, `POST /api/auth/cadastros/aacd`, `POST /api/auth/cadastros/parceiros`, `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout` |
| Perfil | `PATCH /api/me` — somente cadastro próprio, sem promoção de perfil/homologação/unidade |
| Homologação | `GET /api/aacd/pendentes`, `POST /api/aacd/:id/homologacao`, `GET /api/parceiros?homologado=true|false`, `POST /api/parceiros/:id/homologacao` |
| Impressoras | `GET/POST /api/impressoras`, `GET/PATCH/DELETE /api/impressoras/:id` — proprietário, soft delete |
| Localização | `POST /api/localizacoes/geocodificar`, `GET /api/catalogos` |
| Código | `POST /api/solicitacoes/codigos` com `{material:"PETG"}` — AACD homologada, ID atribuído pelo banco |
| Diagnóstico | `GET /api/health` — disponibilidade básica da API/MySQL, sem segredos |

## Verificação e limites

Para testes de integração, configure uma cópia `.env.test` com `NODE_ENV=test` e bancos **descartáveis** cujos nomes terminem em `_test`. Use o mesmo formato de `.env.example`; nunca aponte a suíte para a base real.

```bat
node --env-file=.env.test scripts\init-db.js
npm test
```

O teste de navegador conectado está em `../tests/backend_browser.py`; requer Playwright/Chromium, backend de teste rodando e `SEED_AACD_EMAIL`/`SEED_AACD_PASSWORD` do seed de teste no ambiente. Para iniciá-lo no CMD, carregue essas variáveis no terminal e execute `python ..\tests\backend_browser.py` com `NODE_ENV=test` e `CONEXO_BACKEND_URL=http://localhost:3000/`.

Executado nesta entrega em Linux: 14 testes com MySQL 8.4 e MongoDB 7.0 reais e descartáveis; seed bcrypt real; preparação repetida sem apagar dados; navegador com cadastro/homologação, código gerado/manual, confirmação do mapa, recuperação após falha da impressora, persistência e logout; smoke do protótipo e contrato de dados. Os arquivos `.bat` não foram executados no Windows.

Chamadas reais ao Nominatim, tiles OSM e widget UserWay não foram validadas nesta rede. Nos testes, o widget e tiles foram bloqueados explicitamente e a geocodificação externa foi simulada em testes unitários; o fluxo de navegador usou o fallback local. Não há alegação de teste do conteúdo externo.

Recuperação de senha por email, pedidos/match reais, coordenadas das unidades solicitantes e implantação HTTPS são próximas etapas. Antes de disponibilizar acesso externo, configurar banco com autenticação, HTTPS/reverse proxy e cookies Secure; o servidor atual escuta só em loopback.
