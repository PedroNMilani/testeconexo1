# CoNexo — SPA por seções

Implementação em HTML, CSS, Bootstrap 5.3.3 e JavaScript do protótipo CoNexo. A estrutura da antiga versão 2 foi consolidada na raiz. A primeira implementação, que recriava as telas via JavaScript, foi removida.

## Executar

Baixe o repositório completo e abra `index.html`, ou execute nesta pasta:

```sh
python3 -m http.server 8000
```

Acesse `http://localhost:8000`. Bootstrap, fonte Plus Jakarta Sans e recursos visuais estão incluídos localmente.

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

Para acessar a área do parceiro, selecione **Parceiro** no Login e preencha email e senha. Nesta demonstração frontend, campos válidos abrem a área do parceiro sem autenticação real. Também é possível acessar as seções diretamente pelo endereço.

O menu da conta permite editar o perfil e sair. As impressoras podem ser adicionadas, alteradas e removidas durante a sessão. No celular, a lista de impressoras é um carrossel horizontal. Os pedidos permitem expandir/recolher grupos, visualizar detalhes, aceitar, recusar e concluir; as ações atualizam os cartões, contadores e o histórico em memória.

## Regras dos cadastros

O botão Confirmar só é habilitado após atingir o fim do scroll interno dos termos. O cadastro do parceiro exige essa confirmação na aba atual. O texto completo enviado pelo usuário, com seções 1 a 14, usa `<br>` nas quebras de linha. O campo de email de contato foi mantido em branco conforme o documento recebido.

A barra do cadastro mantém a linha verde sobre a cinza nos comprimentos do Figma: aproximadamente 34,5%, 68% e 98%. Permanecem as validações de campos obrigatórios, emails, senhas iguais com pelo menos oito caracteres, dimensões positivas e seleção de materiais e bicos. Os pop-ups de redefinição de senha e homologação foram preservados.

## Arquivos

- `index.html`: todas as seções, cabeçalhos, rodapé e modais estáticos.
- `app.js`: navegação por seções, Login e cadastros.
- `partner.js`: interações da área do parceiro e dados demonstrativos em memória.
- `styles.css`: tokens visuais, estilos das telas e adaptação para celular.
- `assets/`: logos, imagens, fonte e ícones originais exportados do Figma.
- `vendor/`: Bootstrap local.

## Limites da demonstração

Não há backend. Login, redefinição de senha, cadastros, perfil, impressoras e pedidos não fazem chamadas a um servidor. As alterações duram enquanto a página estiver aberta e são reiniciadas ao recarregar. Senhas e dados de formulário não são gravados em cookies, localStorage ou sessionStorage.

Os dados de pedidos, suas datas e os indicadores iniciais reproduzem o protótipo; os indicadores de resumo e a quantidade de cartões não representam uma base real conciliada. O email `xxxxxx@aacd.org.br` é um placeholder do Figma. As opções de unidade e disponibilidade são demonstrativas, porque o protótipo não apresenta os menus abertos.

O Figma conecta “Adicionar impressora” à tela de edição existente. A criação reutiliza essa mesma seção e exibe um campo de modelo. As ações de pedidos que não têm outra tela desenhada atualizam os dados em memória; os detalhes são expandidos no próprio cartão. Nenhuma tela administrativa da AACD foi adicionada.

## Verificação

Verificado no Chromium via HTTP em larguras de 1440 e 390 pixels: onze seções com IDs únicos e labels associados, apenas uma seção visível por vez, Login do parceiro, navegação, adição/edição/remoção de impressoras, atualização e cancelamento de perfil, menu da conta, saída, detalhes/aceite/recusa/conclusão de pedidos e atualização do histórico. Também foram conferidos os termos completos com `<br>`, o bloqueio antes do fim do scroll, as imagens carregadas e a ausência de rolagem horizontal na página.
