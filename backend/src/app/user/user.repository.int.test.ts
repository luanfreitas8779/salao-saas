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

describe("UserRepository.searchClients", () => {
  beforeEach(async () => {
    await prismaClient.users.createMany({
      data: [
        { name: "Maria da Silva", email: "maria@email.com", phone: "11911112222", password_hash: "h" },
        { name: "Mariana Souza", email: "mari@outro.com", phone: "11933334444", password_hash: "h" },
        { name: "João Pereira", email: "joao@email.com", phone: "21955556666", password_hash: "h" },
        { name: "Maria Admin", email: "admin@salao.com", phone: "11977778888", password_hash: "h", role: "PROF" },
      ],
    });
  });

  it("acha pelo nome, sem diferenciar maiúsculas, e em ordem alfabética", async () => {
    const achados = await repository.searchClients({ search: "MARI" });

    expect(achados.map((u) => u.name)).toEqual(["Maria da Silva", "Mariana Souza"]);
  });

  it("acha pelo e-mail e pelo telefone", async () => {
    const porEmail = await repository.searchClients({ search: "joao@" });
    const porTelefone = await repository.searchClients({ search: "3333" });

    expect(porEmail.map((u) => u.name)).toEqual(["João Pereira"]);
    expect(porTelefone.map((u) => u.name)).toEqual(["Mariana Souza"]);
  });

  it("nunca traz admins, mesmo quando o nome bate", async () => {
    const achados = await repository.searchClients({ search: "admin" });

    expect(achados).toEqual([]);
  });

  it("devolve só id, nome, e-mail e telefone (sem o password_hash)", async () => {
    const [achado] = await repository.searchClients({ search: "joão" });

    expect(Object.keys(achado!).sort()).toEqual(["email", "id", "name", "phone"]);
  });

  it("devolve no máximo 20 clientes", async () => {
    await prismaClient.users.createMany({
      data: Array.from({ length: 25 }, (_, i) => ({
        name: `Cliente Lote ${String(i).padStart(2, "0")}`,
        email: `lote${i}@email.com`,
        phone: `119800000${String(i).padStart(2, "0")}`,
        password_hash: "h",
      })),
    });

    const achados = await repository.searchClients({ search: "lote" });

    expect(achados).toHaveLength(20);
  });
});

describe("UserRepository.incrementTokenVersion", () => {
  it("aumenta a versão em 1 e devolve a versão nova", async () => {
    const primeira = await repository.incrementTokenVersion({ userId: usuarioId });
    const segunda = await repository.incrementTokenVersion({ userId: usuarioId });

    expect([primeira, segunda]).toEqual([1, 2]);
    const noBanco = await prismaClient.users.findUnique({ where: { id: usuarioId } });
    expect(noBanco?.token_version).toBe(2);
  });
});

describe("UserRepository: trocar a senha desliga a troca obrigatória", () => {
  beforeEach(async () => {
    await prismaClient.users.update({
      where: { id: usuarioId },
      data: { must_change_password: true },
    });
  });

  it("pelo perfil (updateProfile com senha)", async () => {
    await repository.updateProfile({ id: usuarioId, password_hash: "hash-novo" });

    const noBanco = await prismaClient.users.findUnique({ where: { id: usuarioId } });
    expect(noBanco?.must_change_password).toBe(false);
  });

  it("pelo link do e-mail (updateUserPassword)", async () => {
    await repository.updateUserPassword({ userId: usuarioId, newPasswordHash: "hash-novo" });

    const noBanco = await prismaClient.users.findUnique({ where: { id: usuarioId } });
    expect(noBanco?.must_change_password).toBe(false);
  });

  it("trocar só o telefone não desliga a obrigação", async () => {
    await repository.updateProfile({ id: usuarioId, phone: "11888888888" });

    const noBanco = await prismaClient.users.findUnique({ where: { id: usuarioId } });
    expect(noBanco?.must_change_password).toBe(true);
  });
});
