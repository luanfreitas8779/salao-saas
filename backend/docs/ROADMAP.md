# Roadmap — o que foi feito e o que falta

Referência: `Documento de Arquitetura e Engenharia_ Software de Agendamento SaaS.pdf`.
Detalhes técnicos do que existe: [ARQUITETURA.md](ARQUITETURA.md).

## Escopo deste repositório

Este repositório é uma **versão de demonstração para portfólio**. Ele não terá uso real:
a versão comercial, mais completa, será feita num repositório privado separado. Por isso,
algumas decisões abaixo privilegiam simplicidade e demonstração (CORS, política de
cancelamento fixa, deploy só na versão comercial).

## Decisões registradas (2026-11-22)

- **Preço:** continua inteiro, em centavos, no backend e no banco (sem decimais).
- **Descrição do procedimento:** continua obrigatória (o cliente precisa saber o que está contratando).
- **Papéis:** `ADMIN` passa a se chamar `PROF` (maiúsculo, como `CLIENT`); o middleware `isAdmin` vira `isProf`.
- **Política de cancelamento:** fica fixa em 24h (projeto de demonstração).
- **CORS:** fica aberto; só será documentado. Sem um front publicado não há origem para configurar.
- **E-mail de recuperação:** já testado de ponta a ponta manualmente (o link chega e a troca de senha funciona).
- **Token:** cada usuário tem um único token ativo. Um novo login revoga o token anterior
  (reduzir o prazo não resolve: um token vazado continuaria valendo até expirar).
  A troca de senha (reset ou perfil) também revoga. Consequência aceita: um aparelho logado por vez.
- **Admin do seed:** mantém `adminsalao@gmail.com` / `admin1q2w3e`, só para o primeiro acesso. Enquanto a senha
  não for trocada, toda rota autenticada responde 403, exceto a troca de senha (`PATCH /users/profile`).
- **Infra:** o Docker será montado pelo autor, como estudo. CI com GitHub Actions. Deploy só da versão comercial.
- **Vulnerabilidades do `npm audit`:** serão tratadas.
- **Paginação:** offset (`page`/`limit`) em `/appointments/me`, com o total no header `X-Total-Count`;
  `/appointments/board` não pagina, mas o período fica limitado a 31 dias.
- **Melhorias aprovadas:** `updateAppointment` passa a resolver o papel como o create e o cancel;
  as variáveis de ambiente passam a ser lidas só do `env` validado (regra do CLAUDE.md).

## Feito

- [x] Cadastro, login (JWT 30d), recuperação e reset de senha (testado manualmente de ponta a ponta), rate limit
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
- [x] Scripts `build`, `start`, `migrate` e `seed`
- [x] CI (GitHub Actions): build, testes unitários e testes de integração contra um Postgres a cada push e pull request
- [x] Papel `ADMIN` renomeado para `PROF` (migration que renomeia o valor, sem perder dados) e middleware `isProf`
- [x] Token único por usuário (`token_version`): login e troca de senha revogam o token anterior
- [x] Troca de senha obrigatória no primeiro acesso do profissional (`must_change_password`)
- [x] Paginação offset em `/appointments/me` (total em `X-Total-Count`); período máximo de 31 dias no `/board`
- [x] `npm audit`: de 16 para 3 alertas (os 3 restantes estão na CLI do Prisma, sem correção na versão 7)
- [x] Variáveis de ambiente só pelo `env` validado; `updateAppointment` resolvendo o papel pelo banco
- [x] Documentação da API com Swagger em `/api/docs` (OpenAPI 3.1 em `/api/docs.json`), gerada dos schemas do Zod e testada contra as rotas reais
- [x] Decisão: `price` continua inteiro, em centavos, no backend e no banco
- [x] Respostas padronizadas: corpo de sucesso é o próprio dado; mensagens em `{ message }`
- [x] Bloqueios: listar por período, editar e remover
- [x] `GET /working-hours` (público) e busca de clientes para o admin (`GET /users?search=`)
- [x] Concluir agendamento (`COMPLETED`); concluído não pode ser cancelado nem editado
- [x] Testes de integração dos repositories contra um Postgres de teste (`npm run test:int`), incluindo a corrida de agendamentos simultâneos
- [x] Testes de API (supertest) de todas as rotas: permissões, validação, fluxo de recuperação de senha e rate limiter
- [x] Correção: rotas que validam a query (`/appointments/slots`, `/appointments/board`) davam 500 no Express 5 (`req.query` é só leitura)
- [x] Recuperação de senha: link do e-mail usa `FRONTEND_URL`; token de reset só vale uma vez e dentro dos 15 minutos
- [x] Testes unitários (Vitest) de services, middlewares, schemas Zod e `businessTime`: disponibilidade, regras de agendamento, cancelamento/edição (24h) e autorização

## Falta — Backend

### A fazer (pelo autor, como estudo)
- [ ] Docker: `Dockerfile` da API e `docker-compose.yml` (API + Postgres), com migrate e seed na subida

### Fora do escopo desta versão (vai para a versão comercial)
- Deploy
- CORS restrito à URL do front
- Política de cancelamento configurável

### Futuro
- [ ] Multi-tenant: `tenant_id` em todas as tabelas e filtro obrigatório nas queries
- [ ] Notificações (e-mail/WhatsApp) de confirmação e lembrete

## Falta — Frontend (não iniciado)

- [ ] Página pública de agendamento e listagem de procedimentos
- [ ] Cadastro, login e recuperação de senha
- [ ] Fluxo: procedimento → data → slot → confirmação
- [ ] Aba "Meus Agendamentos" (detalhes, cancelar, editar)
- [ ] Painel admin: grade da agenda, bloqueios, agendamento de balcão, catálogo, horário de funcionamento
