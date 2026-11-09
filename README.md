# CoNexo — SPA por seções

Implementação em HTML, CSS, Bootstrap 5.3.3 e JavaScript do protótipo CoNexo. A estrutura da antiga versão 2 foi consolidada na raiz. A primeira implementação, que recriava as telas via JavaScript, foi removida.

## Executar

Baixe o repositório completo e execute nesta pasta:

```sh
python3 -m http.server 8000
```

Acesse **http://localhost:8000/**. Os módulos ES exigem um servidor HTTP: abrir `index.html` por `file://` não funciona. Bootstrap, fonte Plus Jakarta Sans e recursos visuais estão incluídos localmente.

## Navegação e telas

Todas as telas estão declaradas como `<section data-page>` dentro de um único `<main>`. O JavaScript alterna `hidden` e `inert`, atualiza o título e gerencia o foco. Os formulários permanecem no DOM ao navegar. Os links para as seções e a History API permitem usar Voltar/Avançar sem recarregar a página.

| Seção | Conteúdo |
| --- | --- |
| `#sobre-nos` | Sobre Nós |
| `#login` | Login AACD e Parceiro |
| `#termos-uso` | Termos completos do cadastro do parceiro |
| `#parceiro-dados` | Dados do Parceiro — etapa 1 |
| `#parceiro-equipamentos` | Capacidade Técnica e Equipamentos — etapa 2 |
| `#parceiro-logistica` | Disponibilidade e Logística — etapa 3 |
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

Para acessar uma área, selecione **Equipe AACD** ou **Parceiro** no Login. Use, por exemplo, `teste@exemplo.com` e `Teste1234`. Nesta demonstração frontend, campos válidos abrem o painel correspondente sem autenticação real. Também é possível acessar as seções diretamente pelo endereço, como `index.html#aacd-inicio`.

O menu da conta permite editar o perfil e sair. O lápis de edição aparece em todos os cards de impressoras ao passar o cursor e ao focar o card pelo teclado; em dispositivos sem hover permanece acessível. A regra também se aplica às impressoras adicionadas durante a sessão. As impressoras podem ser adicionadas, alteradas e removidas durante a sessão. No celular, a lista de impressoras é um carrossel horizontal. Os pedidos permitem expandir/recolher grupos, visualizar detalhes, aceitar, recusar e concluir; as ações atualizam os cartões, contadores e o histórico em memória.

## Área AACD

O painel liga as seções de parceiros, pedidos e criação de demanda. O histórico permite pesquisar os quatro registros do protótipo, filtrar por situação, material e prioridade, expandir detalhes e exportar os resultados filtrados em CSV. A paginação usa os registros realmente disponíveis na demonstração; páginas adicionais são habilitadas quando novos pedidos são criados.

A rede permite pesquisar laboratórios por nome e localização. Na homologação, cada candidato pode ser expandido para conferir informações gerais e as quatro máquinas desenhadas no Figma. O estado expandido mostra somente o candidato selecionado; recolher restaura a fila. Homologar adiciona o laboratório à rede local e rejeitar o remove da fila, atualizando os indicadores da demonstração.

O novo pedido usa as três etapas conectadas no protótipo (`376:788`, `376:894`, `96:1783`). Os valores permanecem preenchidos ao voltar. A conexão valida todas as etapas, aceita apenas links HTTP/HTTPS e adiciona o pedido ao histórico com o laboratório escolhido. O mesmo código não pode ser enviado duas vezes nesta sessão. Os percentuais de compatibilidade e as recomendações reproduzem os exemplos do Figma; não há cálculo real de compatibilidade nem envio para laboratórios externos.

## Regras dos cadastros

O botão Confirmar só é habilitado após atingir o fim do scroll interno dos termos. O cadastro do parceiro exige essa confirmação na aba atual. O texto completo enviado pelo usuário, com seções 1 a 14, usa `<br>` nas quebras de linha. O campo de email de contato foi mantido em branco conforme o documento recebido.

A barra do cadastro mantém a linha verde sobre a cinza nos comprimentos do Figma: aproximadamente 34,5%, 68% e 98%. Permanecem as validações de campos obrigatórios, emails, senhas iguais com pelo menos oito caracteres, dimensões positivas e seleção de materiais e bicos. Os pop-ups de redefinição de senha e homologação foram preservados.

## Arquivos

- `index.html`: todas as seções, cabeçalhos, rodapé e modais estáticos.
- `app.js`: entrada ES module, inicialização das áreas, Login e cadastros.
- `router.js`: navegação por seções e History API.
- `shared-ui.js`: cabeçalhos, perfis, logout e utilitários de templates compartilhados.
- `data.js`: única interface assíncrona de leitura/escrita; recebe e devolve cópias.
- `memory-source.js`: adaptador privado em memória, substituível por outra fonte com o mesmo contrato.
- `mock-data.js`: exemplos fictícios, incluindo registros completos das três impressoras.
- `partner.js`: renderização e interações da área do parceiro, consumindo `data.js`.
- `aacd.js`: histórico, filtros, CSV, rede, homologação, criação de pedidos e perfil AACD.
- `tests/browser_smoke.py`: teste de navegador reproduzível dos fluxos AACD e do lápis das impressoras.
- `styles.css`: tokens visuais, estilos das telas e adaptação para celular.
- `assets/`: logos, imagens, fonte e ícones originais exportados do Figma.
- `vendor/`: Bootstrap local.

## Limites da demonstração

Não há backend. Login, redefinição de senha, cadastros, perfil, impressoras e pedidos não fazem chamadas a um servidor. As alterações duram enquanto a página estiver aberta e são reiniciadas ao recarregar. Senhas e dados de formulário não são gravados em cookies, localStorage ou sessionStorage.

Os dados de pedidos, suas datas e os indicadores iniciais reproduzem o protótipo; os indicadores de resumo e a quantidade de cartões não representam uma base real conciliada. O email `xxxxxx@aacd.org.br` é um placeholder do Figma. As opções de unidade e disponibilidade são demonstrativas, porque o protótipo não apresenta os menus abertos.

O Figma conecta “Adicionar impressora” à tela de edição existente. A criação reutiliza essa mesma seção e exibe um campo de modelo. As ações de pedidos que não têm outra tela desenhada atualizam os dados em memória; os detalhes são expandidos no próprio cartão. As telas internas da AACD foram adicionadas nesta atualização, mantendo a navegação por seções.

## Verificação

Verificado no Chromium via HTTP em larguras de 1440 e 390 pixels: vinte seções com IDs únicos e labels associados, apenas uma seção visível por vez, Login do parceiro, navegação, adição/edição/remoção de impressoras, atualização e cancelamento de perfil, menu da conta, saída, detalhes/aceite/recusa/conclusão de pedidos e atualização do histórico. Também foram conferidos os termos completos com `<br>`, o bloqueio antes do fim do scroll, as imagens carregadas e a ausência de rolagem horizontal na página.


Também foram verificados o Login AACD, as nove seções internas, busca e filtros do histórico, exportação CSV, pesquisa de parceiros, aprovação e rejeição de candidatos, o pedido em três etapas, validação de URL, preservação dos campos, conexão sem duplicação, paginação com novo pedido e edição/cancelamento de perfil. O lápis foi conferido com mouse, foco de teclado, tela de toque e impressoras recém-adicionadas.

Para repetir o teste, instale o pacote Python `playwright`, disponibilize o Chromium e mantenha o servidor local aberto. Em outro terminal, execute:

```sh
python3 tests/browser_smoke.py
```

Use `CONEXO_TEST_URL` para mudar a URL de teste e `CHROMIUM_PATH` para indicar o executável do navegador. Use HTTP para executar a SPA: os módulos ES não funcionam por `file://`.

Para validar o contrato assíncrono e o isolamento das cópias, execute `node tests/data_contract.mjs`. As telas importam apenas `data.js`; para mudar a origem dos dados, forneça outro adaptador com os métodos do contrato e altere a composição em `data.js`, sem modificar as telas. Nenhuma fonte vazia foi criada.
