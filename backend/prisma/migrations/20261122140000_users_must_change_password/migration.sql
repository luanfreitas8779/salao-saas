-- Troca de senha obrigatória: enquanto estiver ligado, o usuário só consegue
-- trocar a senha (PATCH /users/profile). O seed cria o profissional com ele ligado.
ALTER TABLE "users" ADD COLUMN "must_change_password" BOOLEAN NOT NULL DEFAULT false;
