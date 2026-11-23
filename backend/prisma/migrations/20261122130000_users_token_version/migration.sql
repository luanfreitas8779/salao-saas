-- Um único token ativo por usuário: o token guarda a versão (ver) e só vale
-- se ela for igual à versão atual do usuário. Login e troca de senha aumentam a versão.
ALTER TABLE "users" ADD COLUMN "token_version" INTEGER NOT NULL DEFAULT 0;
