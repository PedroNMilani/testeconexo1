# CoNexo — SPA

Implementação do protótipo CoNexo em HTML, CSS, Bootstrap 5.3.3 e JavaScript, sem framework ou etapa de compilação. Bootstrap, fonte e recursos visuais estão incluídos localmente.

## Executar

Abra `index.html` no navegador ou, nesta pasta, execute:

```sh
python3 -m http.server 8000
```

Acesse `http://localhost:8000`. Os links usam rotas por hash e não precisam de configuração de redirecionamento no servidor.

## Telas

- `#/sobre`: Sobre Nós.
- `#/login/aacd` e `#/login/parceiro`: abas de login e redefinição de senha.
- `#/parceiro/termos`: termos com scroll vertical e botão Confirmar bloqueado até chegar ao fim.
- `#/parceiro/1`: identificação, endereço, contato e senha.
- `#/parceiro/2`: equipamentos, volumes, materiais e bicos.
- `#/parceiro/3`: disponibilidade, logística, observações e condições de segurança.
- `#/aacd/cadastro`: cadastro da unidade AACD.

Os dois cadastros abrem o pop-up de homologação do Figma. As etapas do parceiro exibem a linha verde sobre a linha cinza, com os comprimentos aproximados do design: 34,5%, 68% e 98%. A navegação conserva os dados enquanto a aba estiver aberta. O acesso às etapas exige a confirmação dos termos nesta sessão.

## Arquivos

`index.html` contém a estrutura inicial e o modal Bootstrap. `app.js` contém as telas, rotas e eventos. `styles.css` contém os tokens visuais, layouts e adaptação para celular. `assets/` contém os recursos originais exportados do Figma e a fonte Plus Jakarta Sans. `vendor/` contém o Bootstrap.

## Limites da demonstração

O projeto é uma interface frontend. Login, envio de email, cadastro e homologação não fazem chamadas a um servidor. As mensagens de redefinição e login explicam essa simulação. Os formulários validam email, campos obrigatórios, igualdade e tamanho mínimo de senhas, dimensões positivas e seleção de materiais e bicos. As senhas e demais dados ficam somente na memória da aba; não são persistidos em localStorage.

O Figma fornece somente as seções 1 a 3 dos Termos de Uso e contém uma anotação indicando que o restante está em um documento externo. Foi incluído somente o texto disponível, sem inventar cláusulas. Para completar, substitua `TERMS_HTML` em `app.js` pelo texto oficial integral. O bloqueio por scroll acompanha automaticamente a altura do novo conteúdo.

O email `xxxxxx@aacd.org.br` no pop-up é um placeholder presente no protótipo. As opções das listas de unidade e disponibilidade são demonstrativas, pois o Figma não especifica os itens dos menus abertos. Substitua pelas opções oficiais na integração.

## Verificação

Fluxos verificados em Chromium: confirmação após scroll completo, bloqueio antes do fim, avanço e retorno entre etapas, preservação de campos, seleção obrigatória de materiais/bicos, senhas divergentes, pop-ups, abas de login e redefinição. Verificação de imagens carregadas e ausência de rolagem horizontal em larguras de 1440 e 390 pixels. A navegação é utilizável por teclado e os modais usam o gerenciamento de foco do Bootstrap.
