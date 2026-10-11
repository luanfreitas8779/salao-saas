/**
 * ============================================================================
 *  ARQUIVO DE ESTUDO — testes do módulo de autenticação (UserService)
 * ============================================================================
 *
 * O QUE ESTE ARQUIVO TESTA
 * ------------------------
 * As regras por trás das rotas  POST /auth/login,  POST /auth/register  e
 * POST /auth/recover. Essas regras moram no UserService (camada service).
 *
 * Isto é um TESTE UNITÁRIO: testamos UMA classe isolada, sem subir o Express,
 * sem banco de dados e sem enviar e-mail de verdade. Por isso ele roda em
 * milissegundos e dá o mesmo resultado em qualquer máquina.
 *
 * Como isolar? Trocamos as dependências por "dublês" (mocks):
 *
 *     UserService  ──usa──▶  UserRepository  ──▶ Prisma ──▶ Postgres
 *                  ──usa──▶  sendMail        ──▶ Gmail
 *
 *   • UserRepository  → trocamos por um objeto falso com vi.fn() (veja abaixo)
 *   • sendMail        → trocamos com vi.mock()
 *   • bcrypt e JWT    → usamos os REAIS (são rápidos e determinísticos)
 *
 * Só dá para fazer isso tão fácil porque o service recebe o repository pelo
 * construtor (injeção de dependência manual). Foi por isso que a arquitetura
 * em camadas do projeto "paga" aqui: no teste, entregamos um repository falso.
 *
 * COMO RODAR (na pasta backend/)
 * ------------------------------
 *   npm test                              roda tudo uma vez
 *   npm run test:watch                    reroda sozinho ao salvar
 *   npx vitest run -t "senha incorreta"   roda só os testes cujo nome contém o texto
 *
 * PADRÃO DE CADA TESTE: AAA
 * -------------------------
 *   Arrange (preparar)  → monta os dados e diz o que os mocks devolvem
 *   Act     (agir)      → chama o método que está sendo testado
 *   Assert  (verificar) → confere o resultado e os efeitos colaterais
 *
 * Um teste bom responde a UMA pergunta e o nome diz qual é.
 * ============================================================================
 */

// -----------------------------------------------------------------------------
// IMPORTS
// -----------------------------------------------------------------------------
// `describe`, `it`, `expect`, `vi`, `beforeEach`... vêm do Vitest.
// (Poderiam ser globais, mas importar deixa explícito de onde vem cada coisa.)
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

// -----------------------------------------------------------------------------
// MOCK DE MÓDULO: vi.mock(...)
// -----------------------------------------------------------------------------
// O user.service.ts faz `import { sendMail } from "../../config/mailer"`.
// O mailer de verdade cria um transporte do nodemailer e usaria o Gmail.
// Com vi.mock dizemos: "toda vez que alguém importar esse caminho, entregue
// ISTO aqui no lugar".
//
// Detalhes importantes:
//  • O Vitest "levanta" (hoist) o vi.mock para o topo do arquivo, antes dos
//    imports. Por isso ele vale mesmo estando depois deles.
//  • A fábrica (a função) devolve um objeto com as mesmas exportações do
//    módulo original: aqui, só `sendMail`, agora sendo uma função espiã vi.fn().
//  • Como o `import { sendMail }` lá em cima já recebe o mock, podemos fazer
//    `expect(sendMail).toHaveBeenCalled...` nos testes.
vi.mock("../../config/mailer", () => ({
  sendMail: vi.fn(),
}));

// -----------------------------------------------------------------------------
// MOCK DE OBJETO: o repository falso
// -----------------------------------------------------------------------------
// vi.fn() cria uma "função espiã". Ela:
//   1. por padrão não faz nada e devolve undefined;
//   2. lembra com quais argumentos foi chamada e quantas vezes;
//   3. pode ser configurada para devolver o que quisermos.
//
// Configuração mais usada:
//   fn.mockResolvedValue(x)      → toda chamada devolve Promise que resolve x
//   fn.mockResolvedValueOnce(x)  → só a PRÓXIMA chamada devolve x
//   fn.mockRejectedValue(erro)   → devolve Promise que rejeita (simula falha)
//
// Só declaramos os métodos que o UserService usa nos testes deste arquivo.
const repository = {
  findUserByEmail: vi.fn(),
  findUserByPhone: vi.fn(),
  createUser: vi.fn(),
  createPasswordResetToken: vi.fn(),
};

// `as unknown as UserRepository` é um "cast": o TypeScript reclamaria que o
// nosso objeto não tem todos os métodos do repository real. Como é um teste,
// dizemos "confia em mim, é um UserRepository".
const service = new UserService(repository as unknown as UserRepository);

// -----------------------------------------------------------------------------
// DADOS DE APOIO
// -----------------------------------------------------------------------------
const JWT_SECRET_TESTE = "segredo-so-para-testes";
const SENHA_CORRETA = "senha123";

// Fábrica de usuário: devolve um usuário válido e deixa sobrescrever campos.
// Evita repetir o objeto inteiro em cada teste e destaca só o que importa:
//    criarUsuario({ role: "ADMIN" })   ← lê-se "um usuário, mas admin"
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

// -----------------------------------------------------------------------------
// HOOKS: código que roda antes/depois dos testes
// -----------------------------------------------------------------------------
// beforeAll  → UMA vez, antes de todos os testes do arquivo
// beforeEach → antes de CADA teste
// afterEach  → depois de CADA teste
// afterAll   → UMA vez, no final

beforeAll(async () => {
  // Geramos o hash da senha UMA vez. O custo 4 é o mínimo do bcrypt (rápido);
  // em produção o projeto usa 10. Em teste não precisamos de força, só de
  // um hash válido.
  passwordHash = await hash(SENHA_CORRETA, 4);
});

beforeEach(() => {
  // Zera chamadas E configurações dos mocks. Sem isso, o que um teste
  // configurou "vaza" para o seguinte e surgem testes que passam sozinhos mas
  // falham em conjunto (ou vice-versa). Regra de ouro: TESTES INDEPENDENTES.
  vi.resetAllMocks();

  // vi.stubEnv troca uma variável de ambiente só durante o teste. Assim o teste
  // não depende do seu .env real.
  vi.stubEnv("JWT_SECRET", JWT_SECRET_TESTE);
});

afterEach(() => {
  // Desfaz os stubEnv, devolvendo process.env ao que era.
  vi.unstubAllEnvs();
});

// =============================================================================
// describe(): agrupa testes relacionados. Pode ser aninhado.
// it() / test(): um caso de teste (são sinônimos). O nome é uma frase que
// descreve o COMPORTAMENTO esperado, não o código.
// =============================================================================
describe("UserService.authLogin  (POST /auth/login)", () => {
  // ---------------------------------------------------------------------------
  // CAMINHO FELIZ
  // ---------------------------------------------------------------------------
  it("retorna os dados do usuário e um token JWT válido quando email e senha estão corretos", async () => {
    // Arrange: o "banco" falso devolve o usuário quando buscarem por email.
    const usuario = criarUsuario();
    repository.findUserByEmail.mockResolvedValue(usuario);

    // Act
    const resultado = await service.authLogin({
      email: usuario.email,
      password: SENHA_CORRETA,
    });

    // Assert 1 — `toEqual` compara objetos pelo CONTEÚDO (recursivamente).
    // `expect.any(String)` aceita qualquer string: o token muda a cada
    // execução, então não dá para comparar com um valor fixo.
    expect(resultado).toEqual({
      id: usuario.id,
      name: usuario.name,
      role: usuario.role,
      token: expect.any(String),
    });

    // Assert 2 — não basta o token "existir": abrimos ele com o mesmo segredo e
    // conferimos o que o service colocou lá dentro.
    const payload = verify(resultado.token, JWT_SECRET_TESTE);
    expect(payload).toMatchObject({ sub: usuario.id, role: "CLIENT" });
    // `toMatchObject` exige só os campos citados; o payload também tem iat/exp
    // e não precisamos listá-los.

    // Assert 3 — o token expira em 30 dias (exp - iat, em segundos).
    const { exp, iat } = payload as { exp: number; iat: number };
    expect(exp - iat).toBe(30 * 24 * 60 * 60);

    // Assert 4 — o service buscou pelo email certo.
    // `toHaveBeenCalledWith` confere os argumentos da chamada ao mock.
    expect(repository.findUserByEmail).toHaveBeenCalledWith({
      email: usuario.email,
    });
  });

  // ---------------------------------------------------------------------------
  // CAMINHOS DE ERRO
  // ---------------------------------------------------------------------------
  it("lança UnauthorizedError quando a senha está incorreta", async () => {
    repository.findUserByEmail.mockResolvedValue(criarUsuario());

    // IMPORTANTE: NÃO use `await` aqui. Guardamos a Promise e deixamos o
    // `expect(...).rejects` aguardá-la. Se você desse `await` direto, o erro
    // estouraria antes do expect e o teste falharia por "exceção", não por
    // "assertion".
    const promise = service.authLogin({
      email: "maria@email.com",
      password: "senha-errada",
    });

    // `.rejects` → "espere a Promise ser rejeitada e confira o motivo".
    // Uma mesma Promise pode ser aguardada mais de uma vez, então dá para
    // fazer duas verificações sobre o mesmo erro:
    await expect(promise).rejects.toBeInstanceOf(UnauthorizedError);
    await expect(promise).rejects.toThrow("Email ou senha incorretos");
  });

  it("devolve a MESMA mensagem para email inexistente (não revela se o email existe)", async () => {
    // Sem mockResolvedValue, findUserByEmail devolve undefined → "não achou".
    // Aqui deixamos isso explícito com mockResolvedValue(null), que é o que o
    // repository real devolve.
    repository.findUserByEmail.mockResolvedValue(null);

    // `toMatchObject` em erro: confere vários campos do erro de uma vez.
    // Aqui checamos mensagem E status HTTP (statusCode vem do AppError).
    await expect(
      service.authLogin({ email: "naoexiste@email.com", password: "qualquer" }),
    ).rejects.toMatchObject({
      message: "Email ou senha incorretos",
      statusCode: 401,
    });
  });

  it("lança InternalServerError quando JWT_SECRET não está configurado", async () => {
    repository.findUserByEmail.mockResolvedValue(criarUsuario());
    // Sobrescrevemos o stub do beforeEach só neste teste.
    vi.stubEnv("JWT_SECRET", "");

    await expect(
      service.authLogin({ email: "maria@email.com", password: SENHA_CORRETA }),
    ).rejects.toBeInstanceOf(InternalServerError);
  });

  // ---------------------------------------------------------------------------
  // it.each: o MESMO teste com várias entradas (tabela de casos)
  // ---------------------------------------------------------------------------
  // Em vez de copiar e colar o teste de "senha errada" N vezes, descrevemos os
  // casos numa tabela. `%s` é substituído pelo valor no nome do teste.
  // Cada linha vira um teste separado no relatório.
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

describe("UserService.CreateNewUser  (POST /auth/register)", () => {
  const dados = {
    name: "Maria",
    email: "maria@email.com",
    phone: "11999999999",
    password: SENHA_CORRETA,
  };

  it("cria o usuário, salva a senha com hash e devolve o nome", async () => {
    // Arrange: nenhum email/telefone existente; createUser devolve o criado.
    repository.findUserByEmail.mockResolvedValue(null);
    repository.findUserByPhone.mockResolvedValue(null);
    repository.createUser.mockResolvedValue(criarUsuario());

    // Act
    const nome = await service.CreateNewUser(dados);

    // Assert
    expect(nome).toBe("Maria"); // `toBe` compara valores primitivos (===)

    // Esse é um teste de EFEITO COLATERAL: o que o service mandou o
    // repository gravar? `mock.calls[0][0]` é o 1º argumento da 1ª chamada.
    const gravado = repository.createUser.mock.calls[0]![0];

    // A senha em texto puro NUNCA pode ir para o banco.
    expect(gravado.password_hash).not.toBe(dados.password);
    expect(gravado).not.toHaveProperty("password");

    // `expect.objectContaining` = "tem pelo menos estes campos".
    expect(gravado).toEqual(
      expect.objectContaining({
        name: dados.name,
        email: dados.email,
        phone: dados.phone,
        password_hash: expect.any(String),
      }),
    );
  });

  it("lança ConflictError e NÃO cria usuário quando o email já existe", async () => {
    repository.findUserByEmail.mockResolvedValue(criarUsuario());
    repository.findUserByPhone.mockResolvedValue(null);

    await expect(service.CreateNewUser(dados)).rejects.toBeInstanceOf(
      ConflictError,
    );

    // `not.toHaveBeenCalled` garante que o caminho de erro parou ANTES de
    // gravar. Testar "o que NÃO aconteceu" é tão importante quanto o que
    // aconteceu.
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

describe("UserService.recoveryPassword  (POST /auth/recover)", () => {
  const MENSAGEM_GENERICA =
    "Se esse email existir, enviaremos o link de recuperação.";

  it("responde igual e NÃO envia e-mail quando o email não existe (anti-enumeração)", async () => {
    repository.findUserByEmail.mockResolvedValue(null);

    const resposta = await service.recoveryPassword({
      email: "naoexiste@email.com",
    });

    expect(resposta).toBe(MENSAGEM_GENERICA);
    expect(sendMail).not.toHaveBeenCalled();
    expect(repository.createPasswordResetToken).not.toHaveBeenCalled();
  });

  it("salva só o HASH do token e envia o token original por e-mail", async () => {
    const usuario = criarUsuario();
    repository.findUserByEmail.mockResolvedValue(usuario);
    repository.createPasswordResetToken.mockResolvedValue({ id: "token-1" });
    // `sendMail` já é vi.fn() (veja vi.mock lá em cima). Como o
    // vi.resetAllMocks() zerou tudo, ele devolve undefined, que é o suficiente.

    const resposta = await service.recoveryPassword({ email: usuario.email });

    expect(resposta).toBe(MENSAGEM_GENERICA);

    // O que foi gravado no banco:
    const salvo = repository.createPasswordResetToken.mock.calls[0]![0];
    expect(salvo.userId).toBe(usuario.id);
    expect(salvo.token_hash).toHaveLength(64); // sha256 em hex = 64 caracteres

    // O que foi enviado por e-mail: sendMail(para, assunto, html)
    const [para, assunto, html] = vi.mocked(sendMail).mock.calls[0]!;
    expect(para).toBe(usuario.email);
    expect(assunto).toBe("Recuperação de senha");

    // O token cru está no link do e-mail, mas o banco NÃO guarda ele:
    // se o banco vazar, ninguém consegue usar os tokens.
    expect(html).not.toContain(salvo.token_hash);
    const tokenCru = /recoverypassword\/([a-f0-9]{64})/.exec(html)?.[1];
    expect(tokenCru).toBeDefined();
    expect(tokenCru).not.toBe(salvo.token_hash);

    // E a expiração fica ~15 minutos à frente.
    const quinzeMin = 15 * 60 * 1000;
    const diferenca = salvo.expiresAt.getTime() - Date.now();
    expect(diferenca).toBeGreaterThan(quinzeMin - 5000);
    expect(diferenca).toBeLessThanOrEqual(quinzeMin);
  });

  it("lança InternalServerError quando o envio do e-mail falha", async () => {
    repository.findUserByEmail.mockResolvedValue(criarUsuario());
    repository.createPasswordResetToken.mockResolvedValue({ id: "token-1" });

    // mockRejectedValue simula a falha do serviço externo (Gmail fora do ar).
    vi.mocked(sendMail).mockRejectedValue(new Error("SMTP caiu"));

    await expect(
      service.recoveryPassword({ email: "maria@email.com" }),
    ).rejects.toThrow("Erro ao enviar email de recuperação de senha.");
  });
});

// =============================================================================
// EXERCÍCIOS PARA VOCÊ
// =============================================================================
// `it.todo` aparece no relatório como "pendente", sem rodar nada. Use-os como
// lista do que implementar sozinho, copiando o padrão acima:
//
//  • resetPassword: token inexistente/expirado → BadRequestError
//      (dica: repository.updatePasswordResetToken.mockResolvedValue(null))
//  • resetPassword: sucesso → updateUserPassword recebe um hash, não a senha
//  • getUserById: o retorno NÃO deve conter password_hash
//      (dica: expect(resultado).not.toHaveProperty("password_hash"))
//  • updateProfile: telefone de outro usuário → ConflictError, e o mesmo
//      telefone do próprio usuário → permitido
//  • authLogin: email inexistente ainda chama bcrypt.compare (anti-timing).
//      Desafio: precisa de vi.mock("bcrypt") — pesquise como fazer
describe("exercícios", () => {
  it.todo("resetPassword lança BadRequestError quando o token é inválido");
  it.todo("getUserById não devolve password_hash");
  it.todo("updateProfile permite manter o próprio telefone");
});
