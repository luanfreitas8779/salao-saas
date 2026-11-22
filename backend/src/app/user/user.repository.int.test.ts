import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { UserRepository } from "./user.repository";
import {
  criarUsuario,
  limparBanco,
  prismaClient,
} from "../../../test-integration/database";

// Teste de INTEGRAÇÃO: roda contra o Postgres de teste (npm run test:int).
// Foco: o token de recuperação de senha. O filtro de "não usado e não expirado"
// está na consulta ao banco, por isso só um teste com banco de verdade prova que ele funciona.

const repository = new UserRepository();

const QUINZE_MINUTOS = 15 * 60 * 1000;

let usuarioId: string;

async function criarToken(sobrescrever: { used?: boolean; expiresAt?: Date } = {}) {
  return prismaClient.passwordResetToken.create({
    data: {
      userId: usuarioId,
      token_hash: `hash-${Math.random()}`,
      expiresAt: new Date(Date.now() + QUINZE_MINUTOS),
      ...sobrescrever,
    },
  });
}

beforeEach(async () => {
  await limparBanco();
  usuarioId = (await criarUsuario()).id;
});

afterAll(async () => {
  await prismaClient.$disconnect();
});

describe("UserRepository.markPasswordResetTokenAsUsed", () => {
  it("aceita um token válido e marca como usado no banco", async () => {
    const token = await criarToken();

    const valido = await repository.markPasswordResetTokenAsUsed({
      hashedToken: token.token_hash,
    });

    expect(valido).toBe(true);
    const noBanco = await prismaClient.passwordResetToken.findUnique({ where: { id: token.id } });
    expect(noBanco?.used).toBe(true);
  });

  it("recusa o mesmo token na segunda vez (só vale uma vez)", async () => {
    const token = await criarToken();

    await repository.markPasswordResetTokenAsUsed({ hashedToken: token.token_hash });
    const segundaVez = await repository.markPasswordResetTokenAsUsed({
      hashedToken: token.token_hash,
    });

    expect(segundaVez).toBe(false);
  });

  it("recusa um token expirado e não marca como usado", async () => {
    const expirado = await criarToken({ expiresAt: new Date(Date.now() - 1000) });

    const valido = await repository.markPasswordResetTokenAsUsed({
      hashedToken: expirado.token_hash,
    });

    expect(valido).toBe(false);
    const noBanco = await prismaClient.passwordResetToken.findUnique({
      where: { id: expirado.id },
    });
    expect(noBanco?.used).toBe(false);
  });

  it("recusa um token que não existe, sem lançar erro", async () => {
    await expect(
      repository.markPasswordResetTokenAsUsed({ hashedToken: "nao-existe" }),
    ).resolves.toBe(false);
  });

  it("de dois pedidos simultâneos com o mesmo token, só um consegue usar", async () => {
    const token = await criarToken();

    const resultados = await Promise.all([
      repository.markPasswordResetTokenAsUsed({ hashedToken: token.token_hash }),
      repository.markPasswordResetTokenAsUsed({ hashedToken: token.token_hash }),
    ]);

    expect(resultados.filter((valido) => valido)).toHaveLength(1);
  });
});

describe("UserRepository.updateProfile", () => {
  it("muda só o telefone, mantém a senha e não devolve o password_hash", async () => {
    const atualizado = await repository.updateProfile({
      id: usuarioId,
      phone: "11888888888",
    });

    expect(atualizado.phone).toBe("11888888888");
    expect(atualizado).not.toHaveProperty("password_hash");

    const noBanco = await prismaClient.users.findUnique({ where: { id: usuarioId } });
    expect(noBanco?.password_hash).toBe("hash-qualquer");
  });
});
