import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";

import { UserController } from "./user.controller";
import type { UserService } from "./user.service";
import { ConflictError } from "../../errors/app-error";

// O controller só faz três coisas: tira os dados do req, chama o service e
// monta a resposta. Os testes conferem exatamente isso. A regra de negócio
// já é testada no user.service.test.ts.

const service = {
  authLogin: vi.fn(),
  CreateNewUser: vi.fn(),
  recoveryPassword: vi.fn(),
  resetPassword: vi.fn(),
  getUserById: vi.fn(),
  updateProfile: vi.fn(),
  searchClients: vi.fn(),
};

const controller = new UserController(service as unknown as UserService);

// res.status() devolve o próprio res, para o encadeamento res.status(200).json(...)
function criarRes() {
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  return res;
}

function criarReq(dados: Partial<Request>) {
  return { body: {}, params: {}, query: {}, ...dados } as Request;
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("UserController.authLogin", () => {
  it("passa email e senha ao service e responde 200 com os dados do login", async () => {
    const login = { id: "user-id-1", name: "Maria", role: "CLIENT", token: "jwt" };
    service.authLogin.mockResolvedValue(login);
    const res = criarRes();

    await controller.authLogin(
      criarReq({ body: { email: "maria@email.com", password: "senha123" } }),
      res as unknown as Response,
    );

    expect(service.authLogin).toHaveBeenCalledWith({
      email: "maria@email.com",
      password: "senha123",
    });
    expect(service.authLogin).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(login);
  });

  it("repassa o erro do service e não responde nada (quem responde é o handler global)", async () => {
    const erro = new ConflictError("qualquer erro");
    service.authLogin.mockRejectedValue(erro);
    const res = criarRes();

    await expect(
      controller.authLogin(criarReq({ body: {} }), res as unknown as Response),
    ).rejects.toBe(erro);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });
});

describe("UserController.CreateNewUser", () => {
  it("passa só os 4 campos do cadastro ao service e responde 201 com o usuário criado", async () => {
    const criado = { id: "user-id-1", name: "Maria da Silva" };
    service.CreateNewUser.mockResolvedValue(criado);
    const res = criarRes();

    await controller.CreateNewUser(
      criarReq({
        body: {
          name: "Maria da Silva",
          email: "maria@email.com",
          phone: "11999999999",
          password: "senha123",
          role: "PROF", // campo extra: não pode chegar ao service
        },
      }),
      res as unknown as Response,
    );

    expect(service.CreateNewUser).toHaveBeenCalledWith({
      name: "Maria da Silva",
      email: "maria@email.com",
      phone: "11999999999",
      password: "senha123",
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(criado);
  });
});

describe("UserController.recoveryPassword", () => {
  it("passa o email ao service e responde 200 com { message }, no mesmo formato das mensagens de erro", async () => {
    const mensagem = "Se esse email existir, enviaremos o link de recuperação.";
    service.recoveryPassword.mockResolvedValue(mensagem);
    const res = criarRes();

    await controller.recoveryPassword(
      criarReq({ body: { email: "maria@email.com" } }),
      res as unknown as Response,
    );

    expect(service.recoveryPassword).toHaveBeenCalledWith({ email: "maria@email.com" });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ message: mensagem });
  });
});

describe("UserController.resetPassword", () => {
  it("pega o token da URL e a nova senha do body, e responde 200 com { message }", async () => {
    service.resetPassword.mockResolvedValue("Senha alterada com sucesso!");
    const res = criarRes();

    await controller.resetPassword(
      criarReq({ params: { token: "token-da-url" }, body: { newPassword: "novaSenha" } }),
      res as unknown as Response,
    );

    expect(service.resetPassword).toHaveBeenCalledWith({
      token: "token-da-url",
      newPassword: "novaSenha",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ message: "Senha alterada com sucesso!" });
  });
});

describe("UserController.getUserById", () => {
  it("busca o usuário do token (req.user_id) e responde 200 com o usuário", async () => {
    const user = { id: "user-id-1", name: "Maria" };
    service.getUserById.mockResolvedValue(user);
    const res = criarRes();

    await controller.getUserById(
      criarReq({ user_id: "user-id-1" }),
      res as unknown as Response,
    );

    expect(service.getUserById).toHaveBeenCalledWith({ id: "user-id-1" });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(user);
  });
});

describe("UserController.updateProfile", () => {
  it("atualiza o usuário do token, ignorando um id enviado no body", async () => {
    const user = { id: "user-id-1", phone: "11888888888" };
    service.updateProfile.mockResolvedValue(user);
    const res = criarRes();

    await controller.updateProfile(
      criarReq({
        user_id: "user-id-1",
        body: { id: "outro-usuario", phone: "11888888888", password: "novaSenha" },
      }),
      res as unknown as Response,
    );

    // o id vem do token, nunca do body: ninguém edita o perfil de outra pessoa
    expect(service.updateProfile).toHaveBeenCalledWith({
      id: "user-id-1",
      phone: "11888888888",
      password: "novaSenha",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(user);
  });
});

describe("UserController.searchClients", () => {
  it("pega a busca da query e responde 200 com a lista", async () => {
    const clientes = [{ id: "user-id-1", name: "Maria" }];
    service.searchClients.mockResolvedValue(clientes);
    const res = criarRes();

    await controller.searchClients(
      criarReq({ query: { search: "mar" } }),
      res as unknown as Response,
    );

    expect(service.searchClients).toHaveBeenCalledWith({ search: "mar" });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(clientes);
  });
});
