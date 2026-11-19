# Match: regras e verificação

Referência: especificação revisada em 19/11/2026. O modelo de dados continua
sendo o executado pelas migrações: contas AACD e parceiros separados no MySQL,
solicitações e pedidos no MySQL e impressoras no MongoDB. Esta revisão não
altera o schema.

## Recomendação

1. Uma conta AACD homologada informa os requisitos ou consulta uma solicitação
   da própria unidade. A prévia não grava a solicitação.
2. O MongoDB seleciona impressoras ativas com capacidade suficiente em cada
   eixo, sem rotação da peça, material compatível e bico aceito.
3. O backend cruza as impressoras com os parceiros homologados do MySQL.
4. Cada combinação aceita de material e bico gera uma opção. A falta de estoque
   não exclui a opção: `needsMaterial` informa a necessidade de fornecimento do
   material escolhido. O resumo legado `precisa_material` não determina esse valor.
5. Haversine, com raio de 6371 km, calcula a distância em linha reta. A ordenação
   usa a distância **antes de arredondar**. Empates usam parceiro, impressora,
   material e bico. Só a resposta arredonda para duas casas. A prioridade não
   participa dessa ordenação.

As coordenadas da unidade são copiadas para a solicitação na criação. Alterar
a configuração depois não muda a origem de uma solicitação existente nem a
distância calculada ao encaminhá-la. A prévia usa a configuração atual.
Solicitação encerrada, com pedido ativo ou sem origem disponível não pode
receber novas recomendações.

Implementação: [recommendations.js](../backend/src/recommendations.js),
[printers.js](../backend/src/printers.js),
[requests.js](../backend/src/requests.js) e [units.js](../backend/src/units.js).

## Encaminhamento, estados e fila

O encaminhamento bloqueia a solicitação e o parceiro em uma transação MySQL,
confere a unidade e a ausência de pedido ativo e consulta novamente a
impressora. Homologação, propriedade, atividade, dimensões, material e bico
são revalidados. O pedido registra a opção escolhida, a distância recalculada,
o snapshot e o evento de criação. As rotas de alteração de impressoras usam
o mesmo bloqueio de parceiro.

A chamada que cria e encaminha pode reutilizar um código da mesma unidade
somente quando todos os requisitos são iguais. A ordem das listas de
materiais e bicos não altera essa comparação.

| Ação | Autor | Transição | Solicitação |
| --- | --- | --- | --- |
| Encaminhar | AACD da unidade | Novo pedido `pendente` | Aberta |
| Aceitar | Parceiro responsável | `pendente` → `em_producao` | Aberta |
| Recusar | Parceiro responsável | `pendente` → `recusado` | Aberta para nova tentativa |
| Finalizar | Parceiro responsável | `em_producao` → `finalizado` | Encerrada |
| Cancelar | AACD da unidade | `pendente` ou `em_producao` → `cancelado` | Encerrada |

Transições incompatíveis com o estado retornam 409, sem criar evento. Ações
de outro perfil retornam 403. Uma ação inexistente é entrada inválida (422).
Eventos válidos preservam ação, autor, perfil e horário.

A fila coloca urgentes primeiro. Depois usa peso da prioridade mais dias
completos desde a criação da **solicitação**, em ordem decrescente, com
desempate pelo ID do pedido. Os pesos continuam sendo médio = 7 e padrão = 0,
configuráveis pelo ambiente.

Implementação: [orders.js](../backend/src/orders.js) e
[rotas de impressoras](../backend/src/routes/printers.js).

## Cobertura da seção 11 da especificação

Os nomes abaixo identificam os testes ou o início de seus títulos.

| Regra | Teste automatizado |
| --- | --- |
| Capacidade igual, insuficiente por eixo e sem rotação | `orders.test.js`: “capacidade igual inclui” |
| Parceiro não homologado | `orders.test.js`: “match usa capacidade sem rotação, homologação” |
| Impressora inativa, material incompatível e bico ausente | `orders.test.js`: “consulta Mongo exclui” |
| Disponibilidade informa fornecimento por material | `recommendations.test.js`: “gera as combinações permitidas”; `orders.test.js`: “match usa capacidade” |
| Mais próximo primeiro, antes de arredondar | `recommendations.test.js`: “ordena distâncias reais” |
| Desempate determinístico | `recommendations.test.js`: “empates reais usam parceiro” |
| Pedido ativo e solicitação encerrada | `orders.test.js`: “recomendação rejeita pedido pendente” |
| Alteração ou desativação entre consulta e conexão | `orders.test.js`: “revalida capacidade e soft delete”; “encaminhamento revalida material” |
| Encaminhamento concorrente | `orders.test.js`: “duas conexões concorrentes” |
| Transições inválidas, recusa, finalização e cancelamento | `orders.test.js`: “todas as transições proibidas”; “recusa preserva tentativa”; “cancelar em produção” |
| Fila por urgência, peso e idade | `orders.test.js`: “fila do parceiro prioriza urgente” |
| Isolamento por unidade e proprietário | `orders.test.js`: “código único por unidade” |

Também há testes para origem salva, prioridade sem efeito no match, catálogo
com nomes exatos e reutilização de códigos com requisitos iguais. Arquivos:
[orders.test.js](../backend/tests/orders.test.js) e
[recommendations.test.js](../backend/tests/recommendations.test.js).

Para executar, siga a configuração de bancos descartáveis e os comandos de
[verificação do backend](../backend/README.md#verificação-e-limites).
Os testes de integração usam HTTP, MySQL e MongoDB locais; não consultam
o serviço real de geocodificação nem enviam e-mails.

## Decisões em aberto preservadas

Os dez pontos da seção 9 continuam com o comportamento atual:

1. Materiais e bicos são listas separadas; não há cadastro de pares técnicos.
2. Links HTTP/HTTPS válidos, sem credenciais, são aceitos sem lista de provedores.
3. A idade na fila conta desde a solicitação, inclusive após recusa.
4. Os pesos 7 e 0 são decisões da equipe, sem validação da AACD.
5. Há um pedido ativo por solicitação; pedidos pendentes não expiram automaticamente.
6. Bicos de impressoras exigem números positivos; o limite de duas casas é da solicitação.
7. Não há chave estrangeira nem transação distribuída entre MySQL e MongoDB.
   O bloqueio protege operações da aplicação, sem cobrir alterações manuais.
8. A distância é em linha reta, sem cálculo de rota.
9. Recuperação de senha por e-mail aguarda definição de provedor.
10. Troca administrativa de unidade aguarda definição de fluxo.

Nenhum código externo de `buscarCoordenadas`/`buscarMatch` foi incorporado.
Não foram introduzidas tabelas `usuario` ou `unidade_aacd`, upload de moldes,
impressoras de resina, avaliações por estrelas ou horas semanais.
