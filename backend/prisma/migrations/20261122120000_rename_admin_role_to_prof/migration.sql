-- O papel ADMIN passa a se chamar PROF (profissional do salão).
-- RENAME VALUE troca o nome no próprio enum: as linhas que já eram ADMIN viram PROF,
-- sem recriar o tipo nem perder dados.
ALTER TYPE "Role" RENAME VALUE 'ADMIN' TO 'PROF';
