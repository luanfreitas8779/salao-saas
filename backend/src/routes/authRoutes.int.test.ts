import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "../../test-integration/api";
import { limparBanco, prismaClient } from "../../test-integration/database";
import { sendMail } from "../config/mailer";

// Teste de API: requisições HTTP de verdade em /api/auth, até o banco de teste.
// O envio de e-mail é falso: o teste lê o link que SERIA enviado.

vi.mock("../config/mailer", () => ({ sendMail: vi.fn() }));

// O limite de tentativas tem um arquivo de teste só para ele (authRateLimit.int.test.ts).
// Aqui ele é desligado: senão as várias chamadas de login e recuperação deste
// arquivo esbarrariam no limite (3 recuperações por hora) e receberiam 429.
vi.mock("../middlewares/rateLimiterMiddleware", () => ({
  loginRateLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
  recoveryPasswordLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

const cadastro = {
  name: "Maria da Silva",
  email: "maria@email.com",
  phone: "(11) 99999-9999",
  password: "senha123",
};

beforeEach(async () => {
  vi.resetAllMocks();
  await limparBanco();
});

afterAll(async () => {
  await prismaClient.$disconnect();
});

describe("POST /api/auth/register", () => {
  it("cadastra o usuário (201), salva o telefone limpo e nunca a senha em texto", async () => {
    const res = await api().post("/api/auth/register").send(cadastro);

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ createUser: "Maria da Silva" });

    const noBanco = await prismaClient.users.findUnique({ where: { email: cadastro.email } });
    expect(noBanco?.phone).toBe("11999999999");
    expect(noBanco?.password_hash).not.toBe(cadastro.password);
  });

  it("não deixa o cadastro escolher o próprio papel: todo cadastro vira CLIENT", async () => {
    await api().post("/api/auth/register").send({ ...cadastro, role: "ADMIN" });

    const noBanco = await prismaClient.users.findUnique({ where: { email: cadastro.email } });
    expect(noBanco?.role).toBe("CLIENT");
  });

  it("responde 400 com os details quando a entrada é inválida", async () => {
    const res = await api()
      .post("/api/auth/register")
      .send({ ...cadastro, email: "sem-arroba" });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      message: "Erro de validação",
      details: [{ campo: "email", message: "Precisa ser um email válido" }],
    });
  });

  it("responde 409 quando o email já está cadastrado", async () => {
    await api().post("/api/auth/register").send(cadastro);

    const res = await api()
      .post("/api/auth/register")
      .send({ ...cadastro, phone: "11888888888" });

    expect(res.status).toBe(409);
    expect(res.body.message).toBe("Já existe um usuário com este email!");
  });

  it("responde 400 quando o corpo não é um JSON válido", async () => {
    const res = await api()
      .post("/api/auth/register")
      .set("Content-Type", "application/json")
      .send("{ isto não é json");

    expect(res.status).toBe(400);
  });
});

describe("POST /api/auth/login", () => {
  beforeEach(async () => {
    await api().post("/api/auth/register").send(cadastro);
  });

  it("devolve 200 com os dados e um token que abre as rotas protegidas", async () => {
    const res = await api()
      .post("/api/auth/login")
      .send({ email: cadastro.email, password: cadastro.password });

    expect(res.status).toBe(200);
    expect(res.body.login).toMatchObject({ name: "Maria da Silva", role: "CLIENT" });

    const perfil = await api()
      .get("/api/users/profile")
      .set("Authorization", `Bearer ${res.body.login.token}`);
    expect(perfil.status).toBe(200);
  });

  it("responde 401 com senha errada", async () => {
    const res = await api()
      .post("/api/auth/login")
      .send({ email: cadastro.email, password: "senha-errada" });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ message: "Email ou senha incorretos" });
  });
});

describe("Recuperação de senha: POST /recover e POST /reset-password/:token", () => {
  // o token cru só existe no link do e-mail; o banco guarda o hash
  function tokenDoEmail() {
    const html = vi.mocked(sendMail).mock.calls[0]![2];
    return /\/reset-password\/([a-f0-9]{64})/.exec(html)![1]!;
  }

  beforeEach(async () => {
    await api().post("/api/auth/register").send(cadastro);
  });

  it("fluxo completo: pede, recebe o link, troca a senha e entra com a senha nova", async () => {
    const pedido = await api().post("/api/auth/recover").send({ email: cadastro.email });
    expect(pedido.status).toBe(200);
    expect(vi.mocked(sendMail).mock.calls[0]![2]).toContain(
      "http://front.teste/reset-password/",
    );

    const troca = await api()
      .post(`/api/auth/reset-password/${tokenDoEmail()}`)
      .send({ newPassword: "senhaNova123" });
    expect(troca.status).toBe(200);

    const loginNovo = await api()
      .post("/api/auth/login")
      .send({ email: cadastro.email, password: "senhaNova123" });
    expect(loginNovo.status).toBe(200);
  });

  it("o mesmo link não funciona duas vezes", async () => {
    await api().post("/api/auth/recover").send({ email: cadastro.email });
    const token = tokenDoEmail();
    await api().post(`/api/auth/reset-password/${token}`).send({ newPassword: "senhaNova123" });

    const segundaVez = await api()
      .post(`/api/auth/reset-password/${token}`)
      .send({ newPassword: "outraSenha123" });

    expect(segundaVez.status).toBe(400);
    expect(segundaVez.body.message).toBe("Token inválido ou expirado!");
  });

  it("um link expirado não funciona", async () => {
    await api().post("/api/auth/recover").send({ email: cadastro.email });
    // vence o token direto no banco (em vez de esperar 15 minutos)
    await prismaClient.passwordResetToken.updateMany({
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const res = await api()
      .post(`/api/auth/reset-password/${tokenDoEmail()}`)
      .send({ newPassword: "senhaNova123" });

    expect(res.status).toBe(400);
  });

  it("responde igual para email que não existe, sem enviar e-mail", async () => {
    const res = await api().post("/api/auth/recover").send({ email: "naoexiste@email.com" });

    expect(res.status).toBe(200);
    expect(res.body).toBe("Se esse email existir, enviaremos o link de recuperação.");
    expect(sendMail).not.toHaveBeenCalled();
  });
});
