# Salão — API de agendamento

[![CI](https://github.com/luanfreitas8779/salao-saas/actions/workflows/ci.yml/badge.svg)](https://github.com/luanfreitas8779/salao-saas/actions/workflows/ci.yml)

API REST para agendamento de um salão de beleza com profissional único: clientes consultam horários livres e marcam procedimentos; o profissional (a dona do salão) gerencia procedimentos, expediente, bloqueios de agenda e a grade de atendimentos.

> **Status:** em desenvolvimento. O backend está funcional; o frontend ainda não existe. Veja [Limitações conhecidas](#limitações-conhecidas) e o [roadmap](backend/docs/ROADMAP.md).

## Stack

- **Node.js + TypeScript** (Express 5)
- **PostgreSQL** com **Prisma 7** (`@prisma/adapter-pg`)
- **Zod 4** para validar body, query, params e variáveis de ambiente
- **JWT + bcrypt** para autenticação, com dois perfis (`CLIENT` e `PROF`) e um único token ativo por usuário
- **Helmet**, **CORS** e **express-rate-limit**
- **Vitest** para testes

## Arquitetura

Cada módulo segue o mesmo fluxo:

```
rota → validateSchema (Zod) → isAuthenticated / isProf → controller → service → repository → Prisma
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
- **Cancelar ou editar:** o cliente só altera os próprios agendamentos, com no mínimo 24 horas de antecedência. O profissional (papel `PROF`) não tem esse limite. Agendamento concluído não pode ser cancelado nem editado.
- **Um token ativo por usuário:** um login novo revoga o token anterior (um aparelho por vez), e trocar a senha também revoga. O token guarda uma versão, conferida no banco a cada requisição.
- **Primeiro acesso do profissional:** o seed cria a conta com uma senha simples e com a troca obrigatória. Até a senha ser trocada, toda rota autenticada responde `403`, exceto a de troca de senha.
- **Agendamento duplicado:** o banco recusa dois agendamentos ativos com horários sobrepostos (constraint de exclusão no PostgreSQL), e a API responde `409 Conflict`.
- **Fuso horário** do salão centralizado em `src/utils/businessTime.ts`.

## Endpoints

Prefixo `/api`. Rotas autenticadas usam `Authorization: Bearer <token>`.

Com o servidor rodando, a documentação interativa (Swagger) fica em `http://localhost:3333/api/docs`, com os campos, as regras e os exemplos de cada rota. O documento OpenAPI fica em `/api/docs.json`.

| Método e rota | Acesso | Função |
|---|---|---|
| `POST /auth/register` | Público | Cadastra cliente |
| `POST /auth/login` | Público (rate limit) | Retorna o token |
| `POST /auth/recover` | Público (rate limit) | Envia e-mail de recuperação de senha |
| `POST /auth/reset-password/:token` | Público | Redefine a senha |
| `GET /users?search=` | Prof | Busca clientes (para agendar no balcão) |
| `GET /users/profile` | Autenticado | Dados do usuário |
| `PATCH /users/profile` | Autenticado | Atualiza o perfil |
| `GET /procedures` | Público | Procedimentos ativos |
| `GET /procedures/all` | Prof | Todos os procedimentos |
| `POST /procedures` | Prof | Cria procedimento |
| `PUT /procedures/:id` | Prof | Edita procedimento |
| `DELETE /procedures/:id` | Prof | Desativa procedimento |
| `GET /working-hours` | Público | Expediente da semana |
| `PUT /working-hours` | Prof | Atualiza o expediente da semana |
| `GET /schedule-blocks` | Prof | Lista os bloqueios de um período |
| `POST /schedule-blocks` | Prof | Bloqueia um intervalo da agenda |
| `PUT /schedule-blocks/:id` | Prof | Edita um bloqueio |
| `DELETE /schedule-blocks/:id` | Prof | Remove um bloqueio |
| `GET /appointments/slots` | Autenticado | Horários livres de um dia para um procedimento |
| `POST /appointments` | Autenticado | Cria agendamento |
| `GET /appointments/me` | Autenticado | Agendamentos do cliente |
| `GET /appointments/board` | Prof | Grade de agendamentos por período |
| `PATCH /appointments/:id/complete` | Prof | Marca o agendamento como atendido |
| `PATCH /appointments/:id/cancel` | Autenticado | Cancela agendamento |
| `PATCH /appointments/:id` | Autenticado | Edita agendamento |

## Como rodar

Pré-requisitos: Node.js 20 ou mais novo e PostgreSQL.

```bash
cd backend
npm install
cp .env.example .env        # preencha as variáveis
npm run migrate             # cria as tabelas (prisma migrate deploy)
npm run seed                # cria a conta do profissional e o expediente padrão
npm run dev                 # sobe em http://localhost:3333 (recarrega ao salvar)
```

Para rodar como em produção: `npm run build` (compila para `dist/`) e `npm start`.

Documentação interativa (Swagger): `http://localhost:3333/api/docs`.

**Primeiro acesso:** entre com `adminsalao@gmail.com` / `admin1q2w3e` (`POST /api/auth/login`). A resposta vem com `must_change_password: true`: troque a senha em `PATCH /api/users/profile` com `{ "password": "..." }` e faça login de novo com a senha nova. Antes disso, as outras rotas respondem `403`.

> Use sempre `npm run migrate` (ou `npx prisma migrate dev`), nunca `prisma db push`: a regra que impede dois agendamentos no mesmo horário fica numa migration SQL e não aparece no `schema.prisma`. Um banco criado com `db push` fica sem essa proteção.

### Variáveis de ambiente

| Variável | Descrição |
|---|---|
| `DATABASE_URL` | Conexão com o PostgreSQL |
| `PORT` | Porta da API (padrão `3333`) |
| `JWT_SECRET` | Segredo para assinar os tokens |
| `EMAIL_USER` / `EMAIL_PASS` | Conta usada para enviar o e-mail de recuperação de senha |
| `FRONTEND_URL` | Endereço do front-end, sem `/` no final (o link do e-mail abre `FRONTEND_URL/reset-password/<token>`) |

## Testes

```bash
cd backend
npm test          # unitários: rápidos, sem banco (services, controllers, middlewares, schemas)
npm run test:int  # integração e API: repositories e rotas HTTP contra um Postgres de teste de verdade
```

Os testes de API usam o `supertest` para fazer requisições HTTP de verdade no app (rota, middlewares, permissões, validação, handler de erro e banco), sem abrir uma porta.

Os testes de integração e de API precisam de um banco separado, que é **apagado a cada teste**:

1. Crie o banco no Postgres (ex.: `salaoregina_test`). O nome precisa terminar em `_test`: os testes conferem isso antes de apagar qualquer coisa.
2. Copie `backend/.env.test.example` para `backend/.env.test` e ajuste o `DATABASE_URL`.
3. Rode `npm run test:int`. As migrations são aplicadas no banco de teste automaticamente.

No GitHub, o **CI** (GitHub Actions, em `.github/workflows/ci.yml`) roda o build e todos os testes, unitários e de integração, a cada push na `main` e a cada pull request, com um Postgres criado só para isso.

## Como este projeto foi construído

O código foi escrito com IA. As decisões são minhas: defini a arquitetura, as regras de negócio e o comportamento esperado de cada módulo, escolhi entre as alternativas propostas (por exemplo, como tratar a concorrência entre agendamentos) e revisei o que foi gerado antes de aceitar.

Os testes seguem a mesma lógica: a maior parte foi escrita com IA e revisada por mim, e alguns eu escrevi à mão, como os das classes de erro e parte dos testes de validação dos schemas. Rodar os testes contra um banco de verdade foi o que revelou problemas que os testes unitários não pegavam, como o deadlock entre agendamentos simultâneos e as rotas que respondiam 500 no Express 5.

## Limitações conhecidas

- Ainda não há frontend.
- Na máquina local, os testes de integração e de API precisam de um Postgres de teste configurado à mão (ver a seção Testes); no CI, o banco é criado sozinho.
- **CORS aberto de propósito:** este repositório é uma demonstração para portfólio, sem front publicado. Numa publicação real, o CORS deve aceitar só o endereço do front (o `FRONTEND_URL`).
- **Um aparelho logado por vez:** é a consequência do token único por usuário (escolha consciente, para que um token vazado possa ser revogado).
- **3 alertas do `npm audit` na CLI do Prisma:** ficam na biblioteca `effect`, usada só pela ferramenta de linha de comando do Prisma (migrate, generate, seed), não pela API em funcionamento. A única correção disponível hoje é voltar o Prisma para a versão 6; basta rodar `npm audit fix` quando sair uma versão 7.x corrigida.
- Política de cancelamento fixa em 24 horas e deploy ficam para a versão comercial do sistema.

## Licença

[MIT](LICENSE)
