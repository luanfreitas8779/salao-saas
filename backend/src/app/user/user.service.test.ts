import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { hash } from "bcrypt";
import { verify } from "jsonwebtoken";

import { UserService } from "./user.service";
import type { UserRepository } from "./user.repository";
import { sendMail } from "../../config/mailer";
import {
  ConflictError,
  InternalServerError,
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
