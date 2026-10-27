# Salão — API de agendamento

API REST para agendamento de um salão de beleza com profissional único: clientes consultam horários livres e marcam procedimentos; a administradora gerencia procedimentos, expediente, bloqueios de agenda e a grade de atendimentos.

> **Status:** em desenvolvimento. O backend está funcional; o frontend ainda não existe. Veja [Limitações conhecidas](#limitações-conhecidas) e o [roadmap](backend/docs/ROADMAP.md).

## Stack

- **Node.js + TypeScript** (Express 5)
- **PostgreSQL** com **Prisma 7** (`@prisma/adapter-pg`)
- **Zod 4** para validar body, query, params e variáveis de ambiente
- **JWT + bcrypt** para autenticação, com dois perfis (`CLIENT` e `ADMIN`)
- **Helmet**, **CORS** e **express-rate-limit**
- **Vitest** para testes

## Arquitetura

Cada módulo segue o mesmo fluxo:

```
rota → validateSchema (Zod) → isAuthenticated / isAdmin → controller → service → repository → Prisma
```

- **Controller** só lê a requisição e responde; não tem regra de negócio.
- **Service** concentra as regras de negócio e lança erros tipados.
- **Repository** é o único lugar que acessa o banco.
- **Factory** monta as dependências por injeção via construtor, o que permite testar o service com repositories simulados.
- **Erros** centralizados em `src/errors/app-error.ts` (400, 401, 403, 404, 409, 429, 500); um handler global converte em resposta HTTP sem vazar detalhes internos.

Detalhes em [`backend/docs/ARQUITETURA.md`](backend/docs/ARQUITETURA.md).

## Regras de negócio

- **Horários disponíveis** calculados a partir da duração do procedimento, do expediente, da pausa, dos agendamentos existentes e dos bloqueios, em uma grade de 30 minutos. Horários passados não aparecem.
- **Validação ao agendar:** horário futuro, dia aberto, dentro do expediente e fora da pausa.
- **Cancelar ou editar:** o cliente só altera os próprios agendamentos, com no mínimo 24 horas de antecedência. A administradora não tem esse limite.
- **Agendamento duplicado:** o banco recusa dois agendamentos ativos com horários sobrepostos (constraint de exclusão no PostgreSQL), e a API responde `409 Conflict`.
- **Fuso horário** do salão centralizado em `src/utils/businessTime.ts`.

## Endpoints

Prefixo `/api`. Rotas autenticadas usam `Authorization: Bearer <token>`.

| Método e rota | Acesso | Função |
|---|---|---|
| `POST /auth/register` | Público | Cadastra cliente |
| `POST /auth/login` | Público (rate limit) | Retorna o token |
| `POST /auth/recover` | Público (rate limit) | Envia e-mail de recuperação de senha |
| `POST /auth/reset-password/:token` | Público | Redefine a senha |
| `GET /users/profile` | Autenticado | Dados do usuário |
| `PATCH /users/profile` | Autenticado | Atualiza o perfil |
| `GET /procedures` | Público | Procedimentos ativos |
| `GET /procedures/all` | Admin | Todos os procedimentos |
| `POST /procedures` | Admin | Cria procedimento |
| `PUT /procedures/:id` | Admin | Edita procedimento |
| `DELETE /procedures/:id` | Admin | Desativa procedimento |
| `PUT /working-hours` | Admin | Atualiza o expediente da semana |
| `POST /schedule-blocks` | Admin | Bloqueia um intervalo da agenda |
| `GET /appointments/slots` | Autenticado | Horários livres de um dia para um procedimento |
| `POST /appointments` | Autenticado | Cria agendamento |
| `GET /appointments/me` | Autenticado | Agendamentos do cliente |
| `GET /appointments/board` | Admin | Grade de agendamentos por período |
| `PATCH /appointments/:id/cancel` | Autenticado | Cancela agendamento |
| `PATCH /appointments/:id` | Autenticado | Edita agendamento |

## Como rodar

Pré-requisitos: Node.js e PostgreSQL.

```bash
cd backend
npm install
cp .env.example .env        # preencha as variáveis
npx prisma migrate dev      # cria as tabelas
npx prisma generate         # gera o client do Prisma
npx prisma db seed          # cria a conta de administradora
npm run dev                 # sobe em http://localhost:3333
```

### Variáveis de ambiente

| Variável | Descrição |
|---|---|
| `DATABASE_URL` | Conexão com o PostgreSQL |
| `PORT` | Porta da API (padrão `3333`) |
| `JWT_SECRET` | Segredo para assinar os tokens |
| `EMAIL_USER` / `EMAIL_PASS` | Conta usada para enviar o e-mail de recuperação de senha |

## Testes

```bash
cd backend
npm test
```

Hoje existem testes unitários do serviço de usuários, com os repositories simulados. Os próximos estão listados no roadmap.

## Como este projeto foi construído

Defini a arquitetura, as regras de negócio e o comportamento esperado de cada módulo, e usei IA para acelerar a implementação, revisando e testando o resultado. Os testes eu escrevo à mão, porque é a forma de confirmar que o código faz o que deveria.

## Limitações conhecidas

- Ainda não há frontend.
- Cobertura de testes pequena: faltam testes do motor de disponibilidade e um teste de integração com PostgreSQL real para agendamentos simultâneos.
- Sem CI e sem Docker.
- O link do e-mail de recuperação de senha está fixo em `localhost`.
- CORS aberto e token com validade de 30 dias.

## Licença

[MIT](LICENSE)
