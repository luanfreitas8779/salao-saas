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

## Falta — Backend

### Alta prioridade
- [ ] **Bloqueios**: listar, editar e remover; confirmar bloqueio de dia inteiro/feriado; exibir bloqueios na grade do admin
- [ ] **Validar criação/edição de agendamento**: horário dentro do expediente, fora da pausa, alinhado ao passo da grade, no futuro (hoje só checa bloqueios)
- [ ] **Alinhar rotas ao documento** (ou atualizar o documento): `PUT/DELETE /procedures/:id`, `/auth/recover`, `/auth/*`
- [ ] **Testes automatizados** do motor de disponibilidade, trava de conflito, regra de cancelamento e autorização

### Média prioridade
- [ ] Fluxo para marcar agendamento como `COMPLETED`
- [ ] Política de cancelamento configurável (hoje fixa em 24h)
- [ ] Decidir tipos: `price` inteiro (centavos) vs decimal; `description` opcional; nomes dos papéis (`CLIENT/ADMIN` vs `client/prof`)
- [ ] Paginação em `/appointments/me` e `/appointments/board`
- [ ] Revisar status HTTP do `isAuthenticated` (hoje retorna 400 em vez de 401)
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
