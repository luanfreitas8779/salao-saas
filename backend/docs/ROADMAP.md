# Roadmap — o que foi feito e o que falta

Referência: `Documento de Arquitetura e Engenharia_ Software de Agendamento SaaS.pdf`.
Detalhes técnicos do que existe: [ARQUITETURA.md](ARQUITETURA.md).

## Feito

- [x] Cadastro, login (JWT 30d), recuperação e reset de senha, rate limit
- [x] Perfil do usuário (GET/PATCH)
- [x] CRUD de procedimentos com soft-delete
- [x] Horário de funcionamento por dia da semana (com pausa)
- [x] Motor de disponibilidade de slots
- [x] Criação de agendamento com trava atômica no banco (exclusion constraint)
- [x] Agendamento presencial pelo admin (`client_id`)
- [x] Meus agendamentos, grade do admin, cancelar e editar (regra de 24h)
- [x] Criação de bloqueios de agenda
- [x] Estrutura em camadas, erros centralizados, validação Zod, seed
- [x] Validação de expediente, pausa, grade e passado ao agendar/editar
- [x] Fuso do salão centralizado (UTC-3) na disponibilidade e na grade
- [x] Rotas alinhadas ao documento (`/auth/*`, `/procedures/:id`, `/appointments/slots`)
- [x] Correção do horário de funcionamento (atualização em lote por dia), dos bloqueios (datas completas, conflito, `this`) e do seed (senha com hash)
- [x] Padronização: erros (401/403/409/429), ordem dos middlewares, estilo do módulo `user`

## Falta — Backend

### Alta prioridade
- [ ] **E-mail de recuperação**: o link aponta para `localhost:3333/auth/recoverypassword/<token>`, rota que não existe; deve usar a URL do front-end vinda de variável de ambiente
- [ ] **CORS**: configurar origens permitidas antes de publicar (hoje `cors()` aberto, para testes locais)
- [ ] **Bloqueios**: listar, editar e remover; confirmar bloqueio de dia inteiro/feriado; exibir bloqueios na grade do admin
- [ ] **Testes automatizados** do motor de disponibilidade, trava de conflito, regra de cancelamento e autorização

### Média prioridade
- [ ] Fluxo para marcar agendamento como `COMPLETED`
- [ ] Política de cancelamento configurável (hoje fixa em 24h)
- [ ] Decidir tipos: `price` inteiro (centavos) vs decimal; `description` opcional; nomes dos papéis (`CLIENT/ADMIN` vs `client/prof`)
- [ ] Paginação em `/appointments/me` e `/appointments/board`
- [ ] Confirmar envio de e-mail de recuperação de ponta a ponta

### Infra / documentação
- [ ] Restaurar `.env.example` (removido na reestruturação)
- [ ] Scripts `build`, `start`, `migrate`, `seed` no `package.json`
- [ ] README com setup local e documentação da API (OpenAPI)
- [ ] Docker/compose para Postgres e pipeline de deploy

### Futuro
- [ ] Multi-tenant: `tenant_id` em todas as tabelas e filtro obrigatório nas queries
- [ ] Notificações (e-mail/WhatsApp) de confirmação e lembrete

## Falta — Frontend (não iniciado)

- [ ] Página pública de agendamento e listagem de procedimentos
- [ ] Cadastro, login e recuperação de senha
- [ ] Fluxo: procedimento → data → slot → confirmação
- [ ] Aba "Meus Agendamentos" (detalhes, cancelar, editar)
- [ ] Painel admin: grade da agenda, bloqueios, agendamento de balcão, catálogo, horário de funcionamento
