# Arquitetura atual — Backend

SaaS de agendamento para salão (profissional único). Este documento descreve **o que existe hoje**.
Especificação original: `Documento de Arquitetura e Engenharia_ Software de Agendamento SaaS.pdf`.

## Stack

| Item | Tecnologia |
|---|---|
| Runtime / linguagem | Node.js, TypeScript (tsx) |
| HTTP | Express 5, Helmet, CORS, express-rate-limit |
| Banco | PostgreSQL via Prisma 7 (`@prisma/adapter-pg`) |
| Validação | Zod 4 (body/query/params e variáveis de ambiente) |
| Auth | JWT (30 dias, `sub` + `role`), bcrypt |
| Datas | date-fns |
| E-mail | Nodemailer (`src/config/mailer.ts`) |

## Estrutura de pastas (`backend/src`)

```
server.ts                 Bootstrap Express, montagem das rotas, handler global de erros
routes/                   Definição de rotas (uma por módulo) + middlewares + schemas
app/<modulo>/             controller → service → repository (+ factory que injeta as dependências)
  appointments/ procedures/ scheduleBlocks/ user/ workingHours/
middlewares/              isAuthenticated, isAdmin, validateSchema, rate limiters
schemas/<modulo>/         Schemas Zod de entrada
errors/app-error.ts       AppError e subclasses (BadRequest, NotFound, Conflict, Forbidden, Unauthorized)
config/mailer.ts          Transporte de e-mail
utils/businessTime.ts     Conversão entre horário do salão (UTC-3) e instantes UTC
prisma/index.ts           Instância do PrismaClient
generated/prisma/         Client gerado (não editar)
@types/express/           Extensão de Request (user_id, user_role)
```

Padrão por módulo: `route → validateSchema → isAuthenticated/isAdmin → controller → service → repository → Prisma`.
Regras de negócio ficam no **service**; acesso a dados no **repository**; **factory** monta as dependências.

## Modelo de dados (`prisma/schema.prisma`)

| Tabela | Campos principais |
|---|---|
| `users` | id (uuid), name, email (único), phone (único), password_hash, role (`CLIENT`\|`ADMIN`) |
| `procedures` | id, name, description, price (Int), duration_minutes, is_active (soft-delete) |
| `appointments` | id, client_id, procedure_id, start_time, end_time, observation?, status (`SCHEDULED`\|`CANCELLED`\|`COMPLETED`), createdAt |
| `schedule_blocks` | id, start_time, end_time, reason?, createdAt |
| `workingHours` | dayOfWeek (único), start_time, end_time, break_start?, break_end?, isOpen |
| `passwordResetToken` | userId, token_hash (único), expiresAt, used |

Integridade: constraint de exclusão no Postgres (`appointments_no_overlap`, `btree_gist`) impede agendamentos
sobrepostos não cancelados — é a trava atômica contra corrida entre dois clientes.

## Endpoints

Prefixo `/api`. Auth = `Authorization: Bearer <JWT>`.

| Método e rota | Permissão | Função |
|---|---|---|
| `POST /auth/register` | Público | Cadastra cliente |
| `POST /auth/login` | Público (rate limit) | Retorna JWT |
| `POST /auth/recover` | Público (rate limit) | Envia token de reset por e-mail |
| `POST /auth/reset-password/:token` | Público | Redefine senha (`newPassword` no body) |
| `GET /users/profile` | Autenticado | Dados do usuário |
| `PATCH /users/profile` | Autenticado | Atualiza perfil |
| `GET /procedures` | Público | Procedimentos ativos |
| `GET /procedures/all` | Admin | Todos os procedimentos |
| `POST /procedures` | Admin | Cria |
| `PUT /procedures/:id` | Admin | Edita |
| `DELETE /procedures/:id` | Admin | Soft-delete |
| `PUT /working-hours` | Admin | Atualiza horário de funcionamento (`newData`: lista de `{ day, start_time, end_time, break_start?, break_end?, isOpen }`) |
| `POST /schedule-blocks` | Admin | Cria bloqueio (`start_time`/`end_time` ISO, `reason`); recusa se houver bloqueio ou agendamento no intervalo |
| `GET /appointments/slots` | Autenticado | Slots livres (`procedure_id`, `date`) |
| `POST /appointments` | Autenticado | Cria agendamento (admin pode informar `client_id`) |
| `GET /appointments/me` | Autenticado | Agendamentos do cliente |
| `GET /appointments/board` | Admin | Grade por período |
| `PATCH /appointments/:id/cancel` | Autenticado | Cancela (cliente: mín. 24h de antecedência) |
| `PATCH /appointments/:id` | Autenticado | Edita (cliente: mín. 24h de antecedência) |

## Regras de negócio implementadas

- **Disponibilidade**: duração do procedimento + expediente do dia + pausa + agendamentos + bloqueios; passo de 30 min; horários já passados não aparecem.
- **Validação ao agendar/editar**: horário futuro, dia aberto, dentro do expediente, fora da pausa e alinhado à grade de 30 min a partir da abertura (`assertWithinBusinessRules`).
- **Fuso**: horários do salão são `America/Sao_Paulo` (UTC-3 fixo, sem horário de verão), centralizados em `src/utils/businessTime.ts`.
- **Cancelar/editar**: cliente só nos próprios agendamentos e com ≥ 24h (constante `CANCEL_MIN_HOURS`); admin sem restrição de prazo.
- **Procedimento**: nome único; exclusão é lógica (`is_active=false`).
- **Erros**: handler global devolve `{ message }`; erros não-`AppError` viram 500 genérico.

## Variáveis de ambiente (`validateEnvSchema.ts`)

`DATABASE_URL`, `PORT` (padrão 3333), `EMAIL_USER`, `EMAIL_PASS`, `JWT_SECRET`.

## Padrões de código

Padrões extraídos dos módulos já escritos (referência: `src/app/procedures` e `src/app/user`).
Novos módulos devem seguir o mesmo formato.

### Camadas e responsabilidades

| Camada | Arquivo | Responsabilidade |
|---|---|---|
| Rota | `routes/<modulo>Routes.ts` | Liga caminho → middlewares → método do controller. Cria o controller via factory. |
| Schema | `schemas/<modulo>/*.ts` | Zod com `body`, `query` e/ou `params`; validado por `validateSchema`. |
| Controller | `app/<modulo>/<x>.controller.ts` | Lê `req`, chama o service e responde `res.status(...).json(...)`. Sem regra de negócio. |
| Service | `app/<modulo>/<x>.service.ts` | Regras de negócio; lança erros personalizados. |
| Repository | `app/<modulo>/<x>.repository.ts` | Único lugar que usa o Prisma (`prismaClient`). |
| Factory | `app/<modulo>/<x>.factory.ts` | Instancia repository → service → controller. |

### Injeção de dependências

- Feita **manualmente por construtor**, sem container: `constructor(private readonly repository: XRepository) {}`.
- A factory é uma função `makeXController()` que cria os repositories, passa ao service e devolve o controller.
- Um service pode receber vários repositories (ex.: `AppointmentService` recebe appointment, procedure, scheduleBlocks, workingHours e user).
- A rota chama `makeXController()` uma vez, no topo do arquivo, e usa os métodos como handlers.

### Controller

- Classe com métodos como **arrow functions** (`createNewProcedure = async (req, res) => {...}`), para preservar o `this`.
- Desestrutura `req.body` / `req.params` / `req.query` tipando com uma interface local e repassa ao service com objeto nomeado.
- Usa `req.user_id` e `req.user_role` (preenchidos por `isAuthenticated`).
- Resposta: `201` para criação, `200` para o resto; o dado vai dentro de um objeto (`res.json({ createUser })`).
- **Sem try/catch**: erros sobem para o handler global do Express 5.

### Service

- Classe com métodos `async`; parâmetros recebidos **como um único objeto** (`createProcedure({ name, price })`).
- Interfaces `...Props` declaradas no topo do arquivo, para entrada e retorno.
- Valida regra, busca no repository e lança erro; nunca devolve resposta HTTP.
- Comentários curtos em português explicando passos não óbvios.

### Repository

- Classe sem estado, com métodos `async` que recebem objeto tipado por interface `...Props`.
- Retorna tipos gerados do Prisma (`Promise<Procedures | null>`).
- Operações críticas usam `$transaction` (ex.: criação de agendamento com isolamento `Serializable`) e convertem erro do banco em `ConflictError`.

### Tratamento de erros

- `src/errors/app-error.ts`: `AppError extends Error` guarda `message` e `statusCode`; as subclasses fixam o status:

| Classe | Status |
|---|---|
| `BadRequestError` | 400 |
| `UnauthorizedError` | 401 |
| `ForbiddenError` | 403 |
| `NotFoundError` | 404 |
| `ConflictError` | 409 |
| `TooManyRequestsError` | 429 |
| `ValidationError` | 400 (com `details` por campo, usado por `validateSchema`) |
| `InternalServerError` | 500 |

- Em services, repositories e middlewares: `throw new XError("mensagem em português")`. Nunca `throw new Error(...)`.
- O handler global em `server.ts` responde `{ message }` com o `statusCode` (`ValidationError` acrescenta `details`); rate limiters e `validateSchema` também passam por ele; erro que não é `AppError` vira 500 com "Internal Server Error".
- Relançar o erro original (`throw error`) só é aceitável quando ele já é um `AppError` ou será tratado acima.

### Nomenclatura

- Arquivos: `<singular>.<camada>.ts` (`procedure.service.ts`); factory também no singular (`procedure.factory.ts`).
- Classes: `ProcedureService`, `ProcedureRepository`, `ProcedureController`; factory `makeProcedureController`.
- Rotas em `routes/<modulo>Routes.ts`; schemas em `schemas/<modulo>/<acao>Schema.ts`.
- Campos do banco em `snake_case` (`duration_minutes`, `start_time`); variáveis TypeScript em `camelCase`.
- Mensagens ao usuário em português.

### Middlewares (ordem usada nas rotas)

`rateLimiter` (quando houver) → `isAuthenticated` → `isAdmin` → `validateSchema(schema)` → controller.
Rotas públicas (sem auth) usam `rateLimiter` → `validateSchema`.

### Inconsistências conhecidas (ainda não padronizadas)

- Formato de resposta dos controllers varia (`{ createUser }` vs objeto direto em `recoveryPassword`).
- Pasta `schemas/users` (plural) vs `app/user` (singular).
- Método `CreateNewUser` com inicial maiúscula (demais métodos em camelCase).
