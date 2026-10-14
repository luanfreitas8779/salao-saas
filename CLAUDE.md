# Salão Regina — SaaS de agendamento

Backend em `backend/` (Node, TypeScript, Express 5, Prisma 7, PostgreSQL, Zod). Frontend ainda não existe.

## Docs
- `backend/docs/ARQUITETURA.md` — estrutura, modelo, endpoints, regras
- `backend/docs/ROADMAP.md` — o que foi feito e o que falta
- `backend/docs/*.pdf` — especificação original

## Comandos (em `backend/`)
- `npm run dev` — servidor com watch
- `npx prisma migrate dev` / `npx prisma generate` — banco e client (`src/generated/prisma`, não editar)

## Convenções
- Fluxo por módulo: `routes → validateSchema → isAuthenticated/isAdmin → controller → service → repository`; dependências montadas na `*.factory.ts`.
- Regra de negócio no service; Prisma só no repository.
- Erros via classes de `src/errors/app-error.ts`; entrada validada com Zod em `src/schemas/`.
- Variáveis de ambiente só via `src/schemas/validateEnvSchema.ts`.
- Conflito de horário é garantido pela constraint `appointments_no_overlap` no Postgres; não remover.
- Textos e mensagens ao usuário em português.
- Atualize o `ROADMAP.md` ao concluir itens.
