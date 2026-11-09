# Decisões da camada de dados

- A aplicação continua estática, sem backend nem persistência. `data.js` é a única interface assíncrona consumida pelas telas. A fonte em memória é substituível por outro adaptador com o mesmo contrato. Leituras e escritas atravessam cópias; as telas não recebem referências internas.
- Impressoras são somente FDM. Os três registros iniciais têm materiais aptos, bicos, volume X/Y/Z e necessidade de material. Todos são exemplos; dimensões e necessidade de material são placeholders fictícios. Os rótulos de material e o bico dos cards existentes foram preservados. Nenhum campo visual foi acrescentado.
- O único enum de pedidos é `ORDER_STATUS`: `não aceito`, `em produção`, `finalizado`. Classes, rótulos e filtros de pedidos são derivados dele. Disponibilidade do parceiro e prioridade não são status de pedido.
- **Provisório:** `não aceito` significa aguardando aceite do parceiro, até validação com o professor.
- Aceitar inicia a produção. Concluir finaliza o pedido. Recusar mantém `não aceito`, remove a associação ao parceiro e não gera evento nem registro de histórico.
- Histórico de Produção é uma leitura dos pedidos finalizados daquele parceiro. Não existe status de cancelamento nem registro de recusa.
- Entrega não faz parte do modelo. O exemplo antes mostrado em trânsito é tratado como produção finalizada; os exemplos antes entregues também são finalizados. Os exemplos antigos de histórico “Em andamento” e “Cancelado” não foram convertidos em finalizados.

## Pendências

- **Recusa sem histórico:** decisão provisória a validar com o professor.
- **Cancelamento sem representação no modelo:** não há status, evento, filtro ou aba de cancelamento.
- **Materiais:** a lista e as substituições fictícias para materiais FDM ainda não foram validadas com a AACD.
- “Precisa de material?” poderia ser derivado do estoque e dos materiais aptos; permanece declarado por impressora por simplicidade. “Sim” significa que a AACD precisa fornecer o material.
- Endereço permanece texto livre, sem latitude/longitude.
- Autenticação e papel real de usuário ainda não existem; `getCurrentUser()` é apenas um contrato com exemplo fictício. A seleção atual da demonstração não constitui autenticação.
- A futura lista de domínios permitidos para links depende da AACD. Nesta etapa foi preservada a validação existente de protocolo HTTP/HTTPS; o alinhamento da interface permanece fora desta refatoração.
- O modelo difere do combinado com o professor quanto à necessidade de material e à prioridade informativa.
- Fonte vazia e seus estados vazios ficam para a etapa 4. Nenhum deles foi implementado nesta etapa.
