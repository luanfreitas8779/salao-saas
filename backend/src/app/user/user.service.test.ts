import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { compare, hash } from "bcrypt";
import { verify } from "jsonwebtoken";
import crypto from "crypto";

import { UserService } from "./user.service";
import type { UserRepository } from "./user.repository";
import { sendMail } from "../../config/mailer";
import {
  BadRequestError,
  ConflictError,
  InternalServerError,
  NotFoundError,
  UnauthorizedError,
} from "../../errors/app-error";

// Testes unitários do UserService: repository e envio de e-mail são mockados,
// então não dependem de banco nem de rede. bcrypt e JWT são os reais.

vi.mock("../../config/mailer", () => ({
  sendMail: vi.fn(),
}));

const repository = {
  findUserByEmail: vi.fn(),
  findUserByPhone: vi.fn(),
  createUser: vi.fn(),
  createPasswordResetToken: vi.fn(),
  updatePasswordResetToken: vi.fn(),
  findPasswordResetToken: vi.fn(),
  updateUserPassword: vi.fn(),
  findUserById: vi.fn(),
  updateProfile: vi.fn(),
};

const service = new UserService(repository as unknown as UserRepository);

const JWT_SECRET_TESTE = "segredo-so-para-testes";
const SENHA_CORRETA = "senha123";

let passwordHash: string;

function criarUsuario(sobrescrever: Record<string, unknown> = {}) {
  return {
    id: "user-id-1",
    name: "Maria",
    email: "maria@email.com",
    phone: "11999999999",
    password_hash: passwordHash,
    role: "CLIENT",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...sobrescrever,
  };
}

beforeAll(async () => {
  // custo 4 (mínimo do bcrypt) só para manter os testes rápidos
  passwordHash = await hash(SENHA_CORRETA, 4);
});

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("JWT_SECRET", JWT_SECRET_TESTE);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("UserService.authLogin", () => {
  it("retorna os dados do usuário e um token JWT válido quando email e senha estão corretos", async () => {
    const usuario = criarUsuario();
    repository.findUserByEmail.mockResolvedValue(usuario);

    const resultado = await service.authLogin({
      email: usuario.email,
      password: SENHA_CORRETA,
    });

    expect(resultado).toEqual({
      id: usuario.id,
      name: usuario.name,
      role: usuario.role,
      token: expect.any(String),
    });

    const payload = verify(resultado.token, JWT_SECRET_TESTE);
    expect(payload).toMatchObject({ sub: usuario.id, role: "CLIENT" });

    // expira em 30 dias
    const { exp, iat } = payload as { exp: number; iat: number };
    expect(exp - iat).toBe(30 * 24 * 60 * 60);

    expect(repository.findUserByEmail).toHaveBeenCalledWith({
      email: usuario.email,
    });
  });

  it("lança UnauthorizedError quando a senha está incorreta", async () => {
    repository.findUserByEmail.mockResolvedValue(criarUsuario());

    const promise = service.authLogin({
      email: "maria@email.com",
      password: "senha-errada",
    });

    await expect(promise).rejects.toBeInstanceOf(UnauthorizedError);
    await expect(promise).rejects.toThrow("Email ou senha incorretos");
  });

  it("devolve a mesma mensagem para email inexistente (não revela se o email existe)", async () => {
    repository.findUserByEmail.mockResolvedValue(null);

    await expect(
      service.authLogin({ email: "naoexiste@email.com", password: "qualquer" }),
    ).rejects.toMatchObject({
      message: "Email ou senha incorretos",
      statusCode: 401,
    });
  });

  it("lança InternalServerError quando JWT_SECRET não está configurado", async () => {
    repository.findUserByEmail.mockResolvedValue(criarUsuario());
    vi.stubEnv("JWT_SECRET", "");

    await expect(
      service.authLogin({ email: "maria@email.com", password: SENHA_CORRETA }),
    ).rejects.toBeInstanceOf(InternalServerError);
  });

  it.each([
    ["senha vazia", ""],
    ["senha com espaço no fim", `${SENHA_CORRETA} `],
    ["senha com letras maiúsculas", SENHA_CORRETA.toUpperCase()],
  ])("rejeita o login com %s", async (_descricao, senha) => {
    repository.findUserByEmail.mockResolvedValue(criarUsuario());

    await expect(
      service.authLogin({ email: "maria@email.com", password: senha }),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });
});

describe("UserService.CreateNewUser", () => {
  const dados = {
    name: "Maria",
    email: "maria@email.com",
    phone: "11999999999",
    password: SENHA_CORRETA,
  };

  it("cria o usuário, salva a senha com hash e devolve o nome", async () => {
    repository.findUserByEmail.mockResolvedValue(null);
    repository.findUserByPhone.mockResolvedValue(null);
    repository.createUser.mockResolvedValue(criarUsuario());

    const nome = await service.CreateNewUser(dados);

    expect(nome).toBe("Maria");

    const gravado = repository.createUser.mock.calls[0]![0];

    // a senha em texto puro nunca pode ser gravada
    expect(gravado.password_hash).not.toBe(dados.password);
    expect(gravado).not.toHaveProperty("password");
    expect(gravado).toEqual(
      expect.objectContaining({
        name: dados.name,
        email: dados.email,
        phone: dados.phone,
        password_hash: expect.any(String),
      }),
    );
  });

  it("lança ConflictError e não cria usuário quando o email já existe", async () => {
    repository.findUserByEmail.mockResolvedValue(criarUsuario());
    repository.findUserByPhone.mockResolvedValue(null);

    await expect(service.CreateNewUser(dados)).rejects.toBeInstanceOf(
      ConflictError,
    );
    expect(repository.createUser).not.toHaveBeenCalled();
  });

  it("lança ConflictError quando o telefone já existe", async () => {
    repository.findUserByEmail.mockResolvedValue(null);
    repository.findUserByPhone.mockResolvedValue(criarUsuario());

    await expect(service.CreateNewUser(dados)).rejects.toThrow(
      "Já existe um usuário com este número de telefone!",
    );
    expect(repository.createUser).not.toHaveBeenCalled();
  });
});

describe("UserService.recoveryPassword", () => {
  const MENSAGEM_GENERICA =
    "Se esse email existir, enviaremos o link de recuperação.";

  it("responde igual e não envia e-mail quando o email não existe", async () => {
    repository.findUserByEmail.mockResolvedValue(null);

    const resposta = await service.recoveryPassword({
      email: "naoexiste@email.com",
    });

    expect(resposta).toBe(MENSAGEM_GENERICA);
    expect(sendMail).not.toHaveBeenCalled();
    expect(repository.createPasswordResetToken).not.toHaveBeenCalled();
  });

  it("salva só o hash do token e envia o token original por e-mail", async () => {
    const usuario = criarUsuario();
    repository.findUserByEmail.mockResolvedValue(usuario);
    repository.createPasswordResetToken.mockResolvedValue({ id: "token-1" });

    const resposta = await service.recoveryPassword({ email: usuario.email });

    expect(resposta).toBe(MENSAGEM_GENERICA);

    const salvo = repository.createPasswordResetToken.mock.calls[0]![0];
    expect(salvo.userId).toBe(usuario.id);
    expect(salvo.token_hash).toHaveLength(64); // sha256 em hex

    const [para, assunto, html] = vi.mocked(sendMail).mock.calls[0]!;
    expect(para).toBe(usuario.email);
    expect(assunto).toBe("Recuperação de senha");

    // o banco guarda o hash; o e-mail leva o token cru
    expect(html).not.toContain(salvo.token_hash);
    const tokenCru = /recoverypassword\/([a-f0-9]{64})/.exec(html)?.[1];
    expect(tokenCru).toBeDefined();
    expect(tokenCru).not.toBe(salvo.token_hash);

    // expira em ~15 minutos
    const quinzeMin = 15 * 60 * 1000;
    const diferenca = salvo.expiresAt.getTime() - Date.now();
    expect(diferenca).toBeGreaterThan(quinzeMin - 5000);
    expect(diferenca).toBeLessThanOrEqual(quinzeMin);
  });

  it("lança InternalServerError quando o envio do e-mail falha", async () => {
    repository.findUserByEmail.mockResolvedValue(criarUsuario());
    repository.createPasswordResetToken.mockResolvedValue({ id: "token-1" });
    vi.mocked(sendMail).mockRejectedValue(new Error("SMTP caiu"));

    await expect(
      service.recoveryPassword({ email: "maria@email.com" }),
    ).rejects.toThrow("Erro ao enviar email de recuperação de senha.");
  });
});

describe("UserService.resetPassword", () => {
  const TOKEN_CRU = "token-recebido-no-email";
  const TOKEN_HASH = crypto.createHash("sha256").update(TOKEN_CRU).digest("hex");
  const NOVA_SENHA = "novaSenha123";

  it("lança BadRequestError e não mexe no banco quando o token está vazio", async () => {
    await expect(
      service.resetPassword({ token: "", newPassword: NOVA_SENHA }),
    ).rejects.toBeInstanceOf(BadRequestError);
    expect(repository.updatePasswordResetToken).not.toHaveBeenCalled();
    expect(repository.updateUserPassword).not.toHaveBeenCalled();
  });

  it("marca o token como usado buscando pelo hash, nunca pelo token cru", async () => {
    repository.updatePasswordResetToken.mockResolvedValue({ id: "token-1" });
    repository.findPasswordResetToken.mockResolvedValue({ userId: "user-id-1" });
    repository.updateUserPassword.mockResolvedValue(criarUsuario());

    await service.resetPassword({ token: TOKEN_CRU, newPassword: NOVA_SENHA });

    expect(repository.updatePasswordResetToken).toHaveBeenCalledWith({
      hashedToken: TOKEN_HASH,
    });
    expect(repository.updatePasswordResetToken).toHaveBeenCalledTimes(1);
    expect(repository.findPasswordResetToken).toHaveBeenCalledWith({
      hashedToken: TOKEN_HASH,
    });
  });

  it("grava o hash da nova senha para o dono do token e confirma a troca", async () => {
    repository.updatePasswordResetToken.mockResolvedValue({ id: "token-1" });
    repository.findPasswordResetToken.mockResolvedValue({ userId: "user-id-1" });
    repository.updateUserPassword.mockResolvedValue(criarUsuario());

    const resposta = await service.resetPassword({
      token: TOKEN_CRU,
      newPassword: NOVA_SENHA,
    });

    expect(resposta).toBe("Senha alterada com sucesso!");

    const gravado = repository.updateUserPassword.mock.calls[0]![0];
    expect(gravado.userId).toBe("user-id-1");
    expect(gravado.newPasswordHash).not.toBe(NOVA_SENHA);
    await expect(compare(NOVA_SENHA, gravado.newPasswordHash)).resolves.toBe(true);
    expect(repository.updateUserPassword).toHaveBeenCalledTimes(1);
  });

  it("lança BadRequestError e não troca a senha quando o token não existe ou já foi usado", async () => {
    repository.updatePasswordResetToken.mockResolvedValue(null);

    await expect(
      service.resetPassword({ token: TOKEN_CRU, newPassword: NOVA_SENHA }),
    ).rejects.toThrow("Token inválido ou expirado!");
    expect(repository.findPasswordResetToken).not.toHaveBeenCalled();
    expect(repository.updateUserPassword).not.toHaveBeenCalled();
  });

  it("lança BadRequestError quando não acha os dados do token depois de marcá-lo", async () => {
    repository.updatePasswordResetToken.mockResolvedValue({ id: "token-1" });
    repository.findPasswordResetToken.mockResolvedValue(null);

    await expect(
      service.resetPassword({ token: TOKEN_CRU, newPassword: NOVA_SENHA }),
    ).rejects.toThrow("Usuário não encontrado para este token.");
    expect(repository.updateUserPassword).not.toHaveBeenCalled();
  });

  it("lança InternalServerError quando o banco não confirma a troca da senha", async () => {
    repository.updatePasswordResetToken.mockResolvedValue({ id: "token-1" });
    repository.findPasswordResetToken.mockResolvedValue({ userId: "user-id-1" });
    repository.updateUserPassword.mockResolvedValue(null);

    await expect(
      service.resetPassword({ token: TOKEN_CRU, newPassword: NOVA_SENHA }),
    ).rejects.toBeInstanceOf(InternalServerError);
  });
});

describe("UserService.getUserById", () => {
  it("devolve o usuário sem o password_hash", async () => {
    const usuario = criarUsuario();
    repository.findUserById.mockResolvedValue(usuario);

    const resultado = await service.getUserById({ id: usuario.id });

    expect(resultado).not.toHaveProperty("password_hash");
    expect(resultado).toEqual({
      id: usuario.id,
      name: usuario.name,
      email: usuario.email,
      phone: usuario.phone,
      role: usuario.role,
      createdAt: usuario.createdAt,
      updatedAt: usuario.updatedAt,
    });
    expect(repository.findUserById).toHaveBeenCalledWith({ id: usuario.id });
    expect(repository.findUserById).toHaveBeenCalledTimes(1);
  });

  it("lança NotFoundError quando o usuário não existe", async () => {
    repository.findUserById.mockResolvedValue(null);

    await expect(service.getUserById({ id: "nao-existe" })).rejects.toThrow(
      new NotFoundError("Usuário não encontrado"),
    );
  });
});

describe("UserService.updateProfile", () => {
  it("atualiza o telefone quando ele é livre", async () => {
    repository.findUserByPhone.mockResolvedValue(null);
    repository.updateProfile.mockResolvedValue({ id: "user-id-1" });

    const resultado = await service.updateProfile({
      id: "user-id-1",
      phone: "11888888888",
    });

    expect(resultado).toEqual({ id: "user-id-1" });
    expect(repository.updateProfile).toHaveBeenCalledWith({
      id: "user-id-1",
      phone: "11888888888",
      password_hash: undefined,
    });
    expect(repository.updateProfile).toHaveBeenCalledTimes(1);
  });

  it("permite manter o próprio telefone (o dono do número é o próprio usuário)", async () => {
    repository.findUserByPhone.mockResolvedValue(criarUsuario({ id: "user-id-1" }));
    repository.updateProfile.mockResolvedValue({ id: "user-id-1" });

    await service.updateProfile({ id: "user-id-1", phone: "11999999999" });

    expect(repository.updateProfile).toHaveBeenCalledTimes(1);
  });

  it("lança ConflictError e não atualiza quando o telefone é de outro usuário", async () => {
    repository.findUserByPhone.mockResolvedValue(criarUsuario({ id: "outro-id" }));

    await expect(
      service.updateProfile({ id: "user-id-1", phone: "11999999999" }),
    ).rejects.toBeInstanceOf(ConflictError);
    expect(repository.updateProfile).not.toHaveBeenCalled();
  });

  it("troca só a senha, gravando o hash e sem consultar o telefone", async () => {
    repository.updateProfile.mockResolvedValue({ id: "user-id-1" });

    await service.updateProfile({ id: "user-id-1", password: "novaSenha123" });

    expect(repository.findUserByPhone).not.toHaveBeenCalled();

    const gravado = repository.updateProfile.mock.calls[0]![0];
    expect(gravado.phone).toBeUndefined();
    expect(gravado.password_hash).not.toBe("novaSenha123");
    await expect(compare("novaSenha123", gravado.password_hash)).resolves.toBe(true);
  });
});
