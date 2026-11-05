# CoNexo — Versão 2: SPA por seções

Abra `versao-2/index.html` na cópia completa do repositório. Para usar um servidor local, execute na raiz do repositório:

```sh
python3 -m http.server 8000
```

Acesse `http://localhost:8000/versao-2/`.

## Estrutura

Todas as telas estão declaradas como `<section data-page>` no `index.html`, dentro de um único `<main>`. O JavaScript alterna os atributos `hidden` e `inert`, atualiza o título e move o foco para a seção ativa. Não usa `innerHTML` para gerar ou substituir telas. Os campos permanecem no DOM e conservam seus valores durante a navegação.

O cabeçalho e o rodapé são compartilhados. Os modais Bootstrap também estão declarados no HTML. Os IDs de campos e títulos são únicos, inclusive nas seções ocultas. A navegação usa links para as seções (`#sobre-nos`, `#login` etc.) e a History API, com suporte aos botões Voltar/Avançar do navegador. As abas AACD e Parceiro pertencem à mesma seção Login.

## Seções incluídas

- `#sobre-nos`: Sobre Nós.
- `#login`: Login AACD e Parceiro.
- `#termos-uso`: Termos de Uso do cadastro de parceiro.
- `#parceiro-dados`: Cadastro do Parceiro, etapa 1.
- `#parceiro-equipamentos`: Cadastro do Parceiro, etapa 2.
- `#parceiro-logistica`: Cadastro do Parceiro, etapa 3.
- `#cadastro-aacd`: Cadastro AACD.

Pop-ups incluídos: redefinição de senha e homologação, este último acionado pelos dois cadastros. O login apresenta uma mensagem de demonstração no próprio formulário, sem acrescentar outra página ou outro pop-up.

## Regras mantidas

O botão Confirmar começa desativado e só é habilitado depois de atingir o fim do scroll interno dos termos. O acesso às etapas exige essa confirmação na aba atual. A leitura permanece concluída ao retornar à seção, porque seu conteúdo não é recriado.

As etapas do parceiro exibem a linha verde sobre a cinza com os comprimentos do design: aproximadamente 34,5%, 68% e 98%. Os formulários validam campos obrigatórios, email, senhas iguais com pelo menos oito caracteres, dimensões positivas e seleção de pelo menos um material e um bico.

Bootstrap, fonte, CSS visual e imagens originais são compartilhados com a versão 1 nas pastas da raiz. Preserve essa estrutura ao baixar ou hospedar o projeto. A versão 1 permanece disponível em `/index.html`.

## Pendências do protótipo

Esta é uma implementação frontend. Autenticação, envio de email e gravação de cadastros dependem de backend; nenhuma senha é persistida em armazenamento do navegador. Os Termos de Uso contêm o texto completo fornecido pelo usuário (seções 1 a 14), com quebras de linha em `<br>`, dentro de `#termos-uso-terms-scroll`. O bloqueio pelo scroll acompanha a altura do conteúdo. O email de contato permanece em branco, conforme o documento enviado.

O email `xxxxxx@aacd.org.br` é o placeholder do Figma. As opções dos selects de unidade e disponibilidade são demonstrativas, pois o protótipo não fornece os menus abertos.

## Verificação

Verificado no Chromium via servidor HTTP, em larguras de 1440 e 390 pixels: sete seções estáticas, apenas uma visível por vez, seções ocultas com `inert`, IDs únicos e labels associados, preservação do mesmo elemento de formulário ao navegar, bloqueio dos termos antes do fim do scroll, validações de campos e senhas, seleção de materiais/bicos, avanço e retorno, histórico das abas de login e pop-ups. Todas as imagens carregaram e não houve rolagem horizontal nessas larguras. A abertura direta por `file://` não foi testada, pois a política do navegador deste ambiente bloqueia esse protocolo.
