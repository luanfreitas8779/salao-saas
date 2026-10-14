/**
 * ============================================================================
 *  TUTORIAL DE TESTES — do zero, usando o UserService como exemplo
 * ============================================================================
 *
 * Como ler este arquivo: de cima para baixo. As PARTES 1 a 4 explicam a ideia.
 * Depois vêm os testes de verdade, com cada trecho explicado.
 *
 *   PARTE 1 — O que é um teste e por que escrevemos
 *   PARTE 2 — O vocabulário (describe, it, expect...)
 *   PARTE 3 — O problema das dependências e a solução: dados falsos (mocks)
 *   PARTE 4 — A receita para construir qualquer teste (passo a passo)
 *   PARTE 5 — Cola rápida: "quando eu quiser X, faço Y"
 *   (depois do código de preparação) — os testes, comentados
 *
 * Para rodar:   npm test                      (roda tudo)
 *               npm run test:watch            (reroda sozinho quando você salva)
 *               npx vitest run -t "senha"     (roda só testes com "senha" no nome)
 * ============================================================================
 */

/**
 * ----------------------------------------------------------------------------
 * PARTE 1 — O QUE É UM TESTE?
 * ----------------------------------------------------------------------------
 * Um teste é um pequeno programa que:
 *   1. chama o SEU código com uma entrada que você escolheu;
 *   2. compara o que aconteceu com o que você ESPERAVA;
 *   3. se for igual → passa (verde). Se for diferente → falha (vermelho).
 *
 * Frase para guardar:   "DADO tal situação, QUANDO eu faço isto, ENTÃO espero aquilo."
 *
 *   Exemplo em português claro:
 *     DADO um usuário cadastrado com a senha "senha123",
 *     QUANDO ele tenta logar com "senha-errada",
 *     ENTÃO espero um erro 401 "Email ou senha incorretos".
 *
 * Por que isso vale a pena?
 *   • Hoje você muda o código e testa na mão no Postman. Com 50 regras isso
 *     vira impossível. O teste roda tudo em 2 segundos.
 *   • Se você quebrar uma regra sem querer (ex.: esquecer de validar a senha),
 *     o teste fica vermelho NA HORA, antes de ir para produção.
 *   • É a prova de que o código funciona — recrutador gosta de ver isso.
 *
 * TIPO DE TESTE DESTE ARQUIVO: "teste unitário".
 *   Testa UMA peça isolada (aqui, a classe UserService), sem banco de dados,
 *   sem internet, sem e-mail de verdade. Por isso é rápido e confiável.
 */

/**
 * ----------------------------------------------------------------------------
 * PARTE 2 — O VOCABULÁRIO
 * ----------------------------------------------------------------------------
 * Tudo isto vem da biblioteca Vitest (o "framework de testes"):
 *
 *   describe("nome do grupo", () => { ... })
 *       Uma "pasta" para agrupar testes parecidos. Só organiza e dá nome no
 *       relatório. Aqui: um describe por método do service.
 *
 *   it("descreve o comportamento esperado", async () => { ... })
 *       UM teste. (`test` é sinônimo de `it`.) O texto deve ser uma frase
 *       dizendo o que deve acontecer. Se falhar, é esse texto que aparece
 *       no terminal, então escreva pensando em quem vai ler o erro.
 *
 *   expect(valor).matcher(esperado)
 *       A verificação. `expect(valor)` embrulha o que você quer checar e o
 *       "matcher" (.toBe, .toEqual, .toThrow...) diz como comparar.
 *       Se a comparação for falsa, o teste falha.
 *         expect(2 + 2).toBe(4)           → passa
 *         expect(2 + 2).toBe(5)           → FALHA
 *
 *   beforeEach(() => { ... })
 *       Código que roda ANTES de cada `it`. Usado para "limpar a mesa".
 *   beforeAll / afterEach / afterAll
 *       Antes de todos / depois de cada / depois de todos.
 *
 *   vi.fn()      cria uma função falsa que "anota" como foi usada (Parte 3).
 *   vi.mock()    troca um arquivo inteiro por uma versão falsa (Parte 3).
 *
 * Os matchers que usamos neste arquivo:
 *   .toBe(x)                 igual a x, para valores simples (número, texto)
 *   .toEqual(obj)            objetos/listas com o MESMO CONTEÚDO
 *   .toMatchObject({...})    o objeto TEM ao menos estes campos (ignora o resto)
 *   .toHaveLength(n)         tamanho de texto/lista
 *   .toBeInstanceOf(Classe)  é daquela classe (ex.: UnauthorizedError)
 *   .toThrow("texto")        a função lançou erro com essa mensagem
 *   .toHaveBeenCalledWith()  a função falsa foi chamada com ESTES argumentos
 *   .not                     inverte QUALQUER matcher:  expect(x).not.toBe(y)
 *
 * IMPORTANTE sobre `async/await`:
 *   Quase tudo no projeto é assíncrono (devolve Promise). Num teste:
 *     - `await` antes de chamar a função, quando você quer o resultado;
 *     - `await expect(...).rejects...` quando espera que dê erro.
 *   Se você ESQUECER o await, o teste termina antes da verificação rodar.
 *   O Vitest atual avisa e falha o teste ("Promise ... was not awaited");
 *   em ferramentas mais antigas ele passava em silêncio. É o erro número 1
 *   de quem começa.
 */

/**
 * ----------------------------------------------------------------------------
 * PARTE 3 — O PROBLEMA DAS DEPENDÊNCIAS E A SOLUÇÃO: MOCKS
 * ----------------------------------------------------------------------------
 * O UserService, para funcionar, usa outras coisas:
 *
 *      UserService ──▶ UserRepository ──▶ Prisma ──▶ BANCO DE DADOS
 *                  └─▶ sendMail ───────────────────▶ GMAIL
 *
 * Se o teste usasse o banco e o Gmail de verdade:
 *   ✗ ficaria lento (rede);
 *   ✗ falharia se o banco estivesse fora do ar (não é bug seu!);
 *   ✗ sujaria o banco e mandaria e-mails reais;
 *   ✗ não daria para simular "o Gmail caiu" quando você quisesse.
 *
 * SOLUÇÃO: no teste, trocamos essas dependências por DUBLÊS (mocks) —
 * versões falsas que a gente controla.  Pense num dublê de cinema: faz o
 * papel do ator verdadeiro, só que sem risco.
 *
 *   UserService ──▶ repository FALSO (devolve o que EU mandar)
 *               └─▶ sendMail FALSO   (só anota que foi chamado)
 *
 * Isso só é fácil porque o service recebe o repository pelo construtor:
 *      new UserService(repository)
 * No teste entregamos um repository falso. Foi para isso que a arquitetura
 * em camadas serve: o service não sabe (nem precisa saber) se o repository
 * é de verdade ou de mentira.
 *
 * A FERRAMENTA CENTRAL: vi.fn()  ("função espiã")
 * -----------------------------------------------
 *   const buscarUsuario = vi.fn();
 *
 * Uma vi.fn() é uma função que:
 *   (a) por padrão não faz nada e devolve `undefined`;
 *   (b) anota TUDO: quantas vezes foi chamada e com quais argumentos;
 *   (c) pode ser programada para devolver o que você quiser.
 *
 * Programar o que ela devolve (sempre ANTES de chamar o código testado):
 *
 *   fn.mockResolvedValue(x)      devolve uma Promise que RESOLVE com x
 *                                (use para métodos async: "deu certo, veio x")
 *   fn.mockResolvedValueOnce(x)  igual, mas só na PRÓXIMA chamada
 *   fn.mockRejectedValue(erro)   devolve uma Promise que REJEITA com erro
 *                                (use para simular falha: "o Gmail caiu")
 *   fn.mockReturnValue(x)        devolve x direto (função NÃO async)
 *
 * Ler o que foi anotado (depois de chamar o código testado):
 *
 *   expect(fn).toHaveBeenCalled()              foi chamada alguma vez?
 *   expect(fn).not.toHaveBeenCalled()          NÃO foi chamada?
 *   expect(fn).toHaveBeenCalledTimes(2)        foi chamada 2 vezes?
 *   expect(fn).toHaveBeenCalledWith({a: 1})    foi chamada com este argumento?
 *   fn.mock.calls[0][0]                        1º argumento da 1ª chamada
 *                                              (para inspecionar com calma)
 */

/**
 * ----------------------------------------------------------------------------
 * PARTE 4 — A RECEITA: COMO CONSTRUIR UM TESTE, PASSO A PASSO
 * ----------------------------------------------------------------------------
 * Vamos usar de exemplo o método que queremos testar: authLogin(email, senha).
 *
 * PASSO 1 — Leia a função e liste TODOS os finais possíveis.
 *   Abra user.service.ts e pergunte: "de quantas maneiras isto pode terminar?"
 *     a) email existe + senha certa      → devolve { id, name, role, token }
 *     b) email NÃO existe                → erro 401
 *     c) email existe + senha errada     → erro 401
 *     d) JWT_SECRET não configurado      → erro 500
 *   Cada final vira UM `it`. Regra de ouro: um teste = um final.
 *
 * PASSO 2 — Descubra do que a função DEPENDE.
 *   authLogin chama  repository.findUserByEmail(...)   → precisa de um mock.
 *   Também usa bcrypt (compare) e jsonwebtoken (sign). Esses são rápidos e
 *   previsíveis, então usamos os REAIS. Só se faz mock do que é lento,
 *   externo ou imprevisível (banco, e-mail, relógio, internet).
 *
 * PASSO 3 — Escreva o teste em 3 blocos: ARRANGE → ACT → ASSERT.
 *
 *   ARRANGE (preparar): monte o cenário. Diga o que os mocks devolvem.
 *       repository.findUserByEmail.mockResolvedValue(usuario)
 *
 *   ACT (agir): chame A função que está sendo testada. UMA chamada só.
 *       const resultado = await service.authLogin({ email, password })
 *
 *   ASSERT (verificar): confira o resultado e os efeitos.
 *       expect(resultado.name).toBe("Maria")
 *
 * PASSO 4 — Rode, veja ficar verde. Depois ESTRAGUE de propósito.
 *   Mude algo no service (ex.: troque `!passwordMatch` por `passwordMatch`)
 *   e rode de novo: o teste TEM que ficar vermelho. Se continuar verde, o
 *   teste não está testando nada. Desfaça a mudança depois.
 *
 * PASSO 5 — Nomeie bem. "funciona" é ruim.
 *   Bom: "lança UnauthorizedError quando a senha está incorreta".
 *
 * COMO AS PEÇAS SE CONECTAM (ordem em que o Vitest executa):
 *
 *   1. Carrega o arquivo; vi.mock() é aplicado ANTES de tudo (hoisting).
 *   2. Cria o repository falso e o service (uma vez só).
 *   3. beforeAll   → roda uma vez (gera o hash da senha).
 *   4. Para CADA `it`:
 *        beforeEach → zera os mocks e define JWT_SECRET
 *        o teste (Arrange → Act → Assert)
 *        afterEach  → desfaz as variáveis de ambiente
 *   5. Mostra o relatório verde/vermelho.
 */

/**
 * ----------------------------------------------------------------------------
 * PARTE 5 — COLA RÁPIDA: "QUANDO EU QUISER ___, FAÇO ___"
 * ----------------------------------------------------------------------------
 *
 * ▸ Quero que o banco "devolva" um usuário:
 *       repository.findUserByEmail.mockResolvedValue(criarUsuario())
 *
 * ▸ Quero simular "não encontrou no banco":
 *       repository.findUserByEmail.mockResolvedValue(null)
 *
 * ▸ Quero simular uma FALHA de serviço externo (Gmail, banco):
 *       vi.mocked(sendMail).mockRejectedValue(new Error("SMTP caiu"))
 *
 * ▸ Quero conferir o VALOR devolvido pela função:
 *       const r = await service.metodo(...)
 *       expect(r).toBe("texto")          // valor simples
 *       expect(r).toEqual({ a: 1 })      // objeto inteiro
 *       expect(r).toMatchObject({ a: 1 })// só alguns campos
 *
 * ▸ Quero conferir que um ERRO foi lançado (sem await antes do service!):
 *       await expect(service.metodo(...)).rejects.toBeInstanceOf(MeuErro)
 *       await expect(service.metodo(...)).rejects.toThrow("mensagem")
 *
 * ▸ Quero conferir que algo FOI chamado (e com o quê):
 *       expect(repository.createUser).toHaveBeenCalledWith({ ... })
 *
 * ▸ Quero conferir que algo NÃO foi chamado:
 *       expect(repository.createUser).not.toHaveBeenCalled()
 *
 * ▸ Quero olhar com calma o argumento que foi enviado ao mock:
 *       const arg = repository.createUser.mock.calls[0]![0]
 *       expect(arg.password_hash).not.toBe("senha123")
 *
 * ▸ Quero rodar o MESMO teste com várias entradas:
 *       it.each([["caso A", 1], ["caso B", 2]])("faz %s", async (_n, v) => {...})
 *
 * ▸ Quero fingir uma variável de ambiente só neste teste:
 *       vi.stubEnv("JWT_SECRET", "abc")      (o afterEach desfaz)
 *
 * ▸ Quero trocar um arquivo inteiro por um falso (ex.: o mailer):
 *       vi.mock("../../config/mailer", () => ({ sendMail: vi.fn() }))
 */

// =============================================================================
// A PARTIR DAQUI: O CÓDIGO DE VERDADE
// =============================================================================

// -----------------------------------------------------------------------------
// IMPORTS — de onde vem cada coisa
// -----------------------------------------------------------------------------
// Do Vitest: as ferramentas de teste descritas na Parte 2.
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
// Do bcrypt: vamos usar o `hash` REAL para fabricar uma senha criptografada
// válida (o service vai comparar a senha digitada com ela).
import { hash } from "bcrypt";
// Do jsonwebtoken: o `verify` REAL, para abrir o token e conferir o conteúdo.
import { verify } from "jsonwebtoken";

// A classe que estamos testando.
import { UserService } from "./user.service";
// `import type` = importa só o TIPO (para o TypeScript), nunca o arquivo
// real. Importante: assim o teste NÃO carrega o Prisma nem conecta no banco.
import type { UserRepository } from "./user.repository";
// Este `sendMail` vai ser o FALSO por causa do vi.mock logo abaixo.
import { sendMail } from "../../config/mailer";
// As classes de erro, para conferir "que tipo de erro foi lançado".
import {
  ConflictError,
  InternalServerError,
  UnauthorizedError,
} from "../../errors/app-error";

// -----------------------------------------------------------------------------
// MOCK DE UM ARQUIVO INTEIRO: vi.mock(...)
// -----------------------------------------------------------------------------
// O user.service.ts faz:   import { sendMail } from "../../config/mailer"
// O mailer verdadeiro conecta no Gmail. Aqui dizemos ao Vitest:
//   "sempre que alguém importar ESSE caminho, entregue ISTO no lugar".
//
// Linha a linha:
//   vi.mock(                       → "troque o módulo..."
//     "../../config/mailer",       → ...que fica neste caminho (o mesmo do import!)
//     () => ({ sendMail: vi.fn() })→ ...por um objeto com as mesmas exportações.
//   )                                 Aqui só `sendMail`, agora uma vi.fn().
//
// Detalhe: o Vitest move o vi.mock para o TOPO do arquivo antes de rodar
// (isso se chama "hoisting"). Por isso funciona mesmo estando depois dos
// imports. O `sendMail` importado lá em cima já é o falso.
vi.mock("../../config/mailer", () => ({
  sendMail: vi.fn(),
}));

// -----------------------------------------------------------------------------
// MOCK DE UM OBJETO: o repository falso
// -----------------------------------------------------------------------------
// O service chama métodos do repository. Criamos um objeto com SÓ os métodos
// que os testes deste arquivo usam, cada um sendo uma vi.fn() (função espiã).
//
//   repository.findUserByEmail   → "buscar usuário por email"
//   repository.findUserByPhone   → "buscar usuário por telefone"
//   repository.createUser        → "gravar usuário novo"
//   repository.createPasswordResetToken → "gravar token de recuperação"
//
// Todos devolvem `undefined` por padrão; cada teste programa o que precisa.
const repository = {
  findUserByEmail: vi.fn(),
  findUserByPhone: vi.fn(),
  createUser: vi.fn(),
  createPasswordResetToken: vi.fn(),
};

// Montamos o service entregando o repository FALSO pelo construtor.
//
// `repository as unknown as UserRepository` é um "cast" do TypeScript:
// nosso objeto não tem TODOS os métodos do repository real, então o
// TypeScript reclamaria. Aqui dizemos "confia, é um UserRepository". Só se
// faz isso em teste; no código de produção seria uma gambiarra.
const service = new UserService(repository as unknown as UserRepository);

// -----------------------------------------------------------------------------
// DADOS DE APOIO
// -----------------------------------------------------------------------------
const JWT_SECRET_TESTE = "segredo-so-para-testes";
const SENHA_CORRETA = "senha123";

// Guardará o hash (senha criptografada) criado no beforeAll abaixo.
// Precisa existir fora da função porque `criarUsuario` também o usa.
let passwordHash: string;

// "FÁBRICA DE DADOS FALSOS": devolve um usuário completo e válido.
// Por que isso existe? Para não copiar o objeto inteiro em cada teste.
// Quem chama só informa o que é DIFERENTE:
//
//     criarUsuario()                     → usuário normal
//     criarUsuario({ role: "ADMIN" })    → o mesmo, mas admin
//     criarUsuario({ name: "João" })     → o mesmo, mas com outro nome
//
// `...sobrescrever` vem por último, então o que for passado SUBSTITUI o
// padrão. Os campos correspondem às colunas da tabela `users`.
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
// HOOKS — o que roda antes/depois dos testes
// -----------------------------------------------------------------------------

// beforeAll: UMA vez, antes do primeiro teste.
// Criar o hash é um pouco lento, então fazemos uma vez só.
// `hash(SENHA_CORRETA, 4)`: criptografa "senha123". O 4 é o "custo" do
// bcrypt: mínimo = rápido. (Em produção o projeto usa 10; em teste não
// precisamos de força, só de um hash válido.)
beforeAll(async () => {
  passwordHash = await hash(SENHA_CORRETA, 4);
});

// beforeEach: antes de CADA teste. Serve para começar com a mesa limpa.
beforeEach(() => {
  // Zera as chamadas anotadas E o que cada mock devolve.
  // Sem isto, um teste "vaza" para o seguinte: o `mockResolvedValue` de um
  // teste continuaria valendo no próximo, e surgem testes que passam
  // sozinhos mas falham em conjunto. REGRA: testes independentes.
  vi.resetAllMocks();

  // Define a variável de ambiente só durante o teste, para ele não depender
  // do seu arquivo .env real (que muda de máquina para máquina).
  vi.stubEnv("JWT_SECRET", JWT_SECRET_TESTE);
});

// afterEach: depois de CADA teste. Desfaz os stubEnv, devolvendo o
// process.env ao que era antes.
afterEach(() => {
  vi.unstubAllEnvs();
});

// =============================================================================
// OS TESTES
// =============================================================================

describe("UserService.authLogin  (POST /auth/login)", () => {
  // ---------------------------------------------------------------------------
  // TESTE 1 — CAMINHO FELIZ (explicado linha a linha)
  // ---------------------------------------------------------------------------
  it("retorna os dados do usuário e um token JWT válido quando email e senha estão corretos", async () => {
    // ===== ARRANGE (preparar o cenário) =====

    // Cria um usuário falso completo (com a senha "senha123" já em hash).
    const usuario = criarUsuario();

    // PROGRAMA o repository falso: "quando alguém chamar findUserByEmail,
    // devolva `usuario`". É como dizer ao dublê o que ele deve responder.
    // `mockResolvedValue` porque o método real é async (devolve Promise).
    repository.findUserByEmail.mockResolvedValue(usuario);

    // ===== ACT (agir: chamar a função testada) =====

    // Chama o login de verdade. O service vai: buscar o usuário (receberá o
    // `usuario` falso), comparar a senha com o hash e gerar o JWT.
    // `await` porque authLogin é async.
    const resultado = await service.authLogin({
      email: usuario.email,
      password: SENHA_CORRETA,
    });

    // ===== ASSERT (verificar) =====

    // 1) O formato do retorno.
    // `toEqual` compara o CONTEÚDO do objeto inteiro.
    // `expect.any(String)` significa "aqui pode ser qualquer texto". Usamos
    // porque o token muda a cada execução (tem data dentro), então não dá
    // para comparar com um valor fixo.
    expect(resultado).toEqual({
      id: usuario.id,
      name: usuario.name,
      role: usuario.role,
      token: expect.any(String),
    });

    // 2) O token tem o conteúdo certo?
    // Não basta ele "existir". `verify` abre o token com o mesmo segredo
    // (se o segredo estivesse errado, aqui já daria erro).
    const payload = verify(resultado.token, JWT_SECRET_TESTE);
    // `toMatchObject` exige só os campos citados; o payload também tem
    // `iat` e `exp` e não precisamos listá-los.
    // `sub` (subject) = id do usuário, como o service define em `subject`.
    expect(payload).toMatchObject({ sub: usuario.id, role: "CLIENT" });

    // 3) O token expira em 30 dias?
    // `iat` = quando foi emitido, `exp` = quando expira (em segundos).
    // A diferença tem que ser 30 dias em segundos.
    const { exp, iat } = payload as { exp: number; iat: number };
    expect(exp - iat).toBe(30 * 24 * 60 * 60);

    // 4) O service buscou pelo email certo? (conferindo a CHAMADA ao mock)
    // `toHaveBeenCalledWith` confere os argumentos com que o mock foi usado.
    expect(repository.findUserByEmail).toHaveBeenCalledWith({
      email: usuario.email,
    });
  });

  // ---------------------------------------------------------------------------
  // TESTE 2 — TESTAR UM ERRO (a receita de erro, passo a passo)
  // ---------------------------------------------------------------------------
  it("lança UnauthorizedError quando a senha está incorreta", async () => {
    // ARRANGE: o usuário existe, mas vamos digitar a senha errada.
    repository.findUserByEmail.mockResolvedValue(criarUsuario());

    // ACT — ATENÇÃO, é aqui que erro se testa diferente de sucesso:
    // NÃO escrevemos `await` na chamada. Guardamos a Promise numa variável.
    //
    // Por quê? Se déssemos `await service.authLogin(...)` e ela lançasse
    // erro, a exceção estouraria AQUI, no meio do teste, e o teste quebraria
    // por "exceção inesperada". Queremos que o erro seja ESPERADO, então
    // entregamos a Promise ao `expect(...).rejects`, que sabe lidar com isso.
    const promise = service.authLogin({
      email: "maria@email.com",
      password: "senha-errada",
    });

    // ASSERT:
    // `.rejects` = "espere esta Promise ser REJEITADA (dar erro) e confira o
    //  motivo". Sem o `await` na frente, o teste termina antes da verificação
    //  (o Vitest avisa e falha o teste).
    //
    // `.toBeInstanceOf(UnauthorizedError)` = o erro é dessa classe (o que
    // dá o status 401 na API).
    await expect(promise).rejects.toBeInstanceOf(UnauthorizedError);
    // `.toThrow("...")` = a mensagem do erro é exatamente esta.
    // (Uma Promise pode ser aguardada mais de uma vez; por isso dá para
    // fazer duas verificações no mesmo erro.)
    await expect(promise).rejects.toThrow("Email ou senha incorretos");
  });

  // ---------------------------------------------------------------------------
  // TESTE 3 — "NÃO ACHOU NO BANCO" + conferindo vários campos do erro
  // ---------------------------------------------------------------------------
  it("devolve a MESMA mensagem para email inexistente (não revela se o email existe)", async () => {
    // O repository real devolve `null` quando não acha. Simulamos isso.
    repository.findUserByEmail.mockResolvedValue(null);

    // Aqui chamamos o service DENTRO do expect (forma mais curta de testar
    // erro: o `await` fica na frente do `expect`, não do service).
    //
    // `toMatchObject` num erro: confere vários campos de uma vez. Todo erro
    // do projeto (AppError) tem `message` e `statusCode`. Assim testamos o
    // texto E o código HTTP que o cliente receberia.
    await expect(
      service.authLogin({ email: "naoexiste@email.com", password: "qualquer" }),
    ).rejects.toMatchObject({
      message: "Email ou senha incorretos",
      statusCode: 401,
    });
  });

  // ---------------------------------------------------------------------------
  // TESTE 4 — configuração do ambiente quebrada
  // ---------------------------------------------------------------------------
  it("lança InternalServerError quando JWT_SECRET não está configurado", async () => {
    repository.findUserByEmail.mockResolvedValue(criarUsuario());

    // O beforeEach definiu JWT_SECRET. Aqui SOBRESCREVEMOS só neste teste
    // com string vazia (que o service trata como "não configurado").
    // O afterEach desfaz, então não afeta os outros testes.
    vi.stubEnv("JWT_SECRET", "");

    await expect(
      service.authLogin({ email: "maria@email.com", password: SENHA_CORRETA }),
    ).rejects.toBeInstanceOf(InternalServerError);
  });

  // ---------------------------------------------------------------------------
  // TESTE 5 — O MESMO TESTE COM VÁRIAS ENTRADAS: it.each
  // ---------------------------------------------------------------------------
  // Em vez de copiar e colar o teste 3 vezes, damos uma TABELA de casos.
  // Cada linha da tabela = [descrição, valor]. Vira um teste separado.
  //
  //   `%s` no título é trocado pela primeira coluna (a descrição).
  //   `_descricao` (com underline) é a descrição: o nome começa com `_`
  //   para sinalizar "recebo, mas não uso no corpo".
  //   `senha` é o valor de cada linha, usado dentro do teste.
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
  // Dados de entrada reaproveitados nos 3 testes deste describe.
  const dados = {
    name: "Maria",
    email: "maria@email.com",
    phone: "11999999999",
    password: SENHA_CORRETA,
  };

  // ---------------------------------------------------------------------------
  // TESTE 6 — CONFERIR O QUE FOI ENVIADO AO "BANCO" (efeito colateral)
  // ---------------------------------------------------------------------------
  it("cria o usuário, salva a senha com hash e devolve o nome", async () => {
    // ARRANGE: nenhum email/telefone existe ainda (pode cadastrar) e o
    // createUser "devolve" o usuário criado.
    repository.findUserByEmail.mockResolvedValue(null);
    repository.findUserByPhone.mockResolvedValue(null);
    repository.createUser.mockResolvedValue(criarUsuario());

    // ACT
    const nome = await service.CreateNewUser(dados);

    // ASSERT 1: o valor devolvido. `toBe` para valor simples (texto).
    expect(nome).toBe("Maria");

    // ASSERT 2: o que o service MANDOU gravar.
    // Importante: não testamos só o retorno, testamos o EFEITO. Um service
    // que devolvesse "Maria" mas gravasse a senha em texto puro passaria no
    // ASSERT 1 e seria um desastre de segurança.
    //
    // `mock.calls` = lista das chamadas; [0] = a primeira; [0] de novo = o
    // primeiro argumento dela. Então `calls[0]![0]` é "o objeto que foi
    // passado ao createUser". (O `!` diz ao TypeScript "tenho certeza que
    // existe", pois um índice pode ser undefined.)
    const gravado = repository.createUser.mock.calls[0]![0];

    // A senha pura NUNCA pode ir ao banco.
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

  // ---------------------------------------------------------------------------
  // TESTE 7 — ERRO + conferir que algo NÃO aconteceu
  // ---------------------------------------------------------------------------
  it("lança ConflictError e NÃO cria usuário quando o email já existe", async () => {
    // O email já existe (devolve um usuário) e o telefone é livre.
    repository.findUserByEmail.mockResolvedValue(criarUsuario());
    repository.findUserByPhone.mockResolvedValue(null);

    await expect(service.CreateNewUser(dados)).rejects.toBeInstanceOf(
      ConflictError,
    );

    // `not.toHaveBeenCalled()` garante que, ao dar erro, o service parou
    // ANTES de gravar. Testar o que NÃO deveria acontecer é tão importante
    // quanto o que deveria.
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

  // ---------------------------------------------------------------------------
  // TESTE 9 — "nada deveria ter sido chamado"
  // ---------------------------------------------------------------------------
  it("responde igual e NÃO envia e-mail quando o email não existe (anti-enumeração)", async () => {
    repository.findUserByEmail.mockResolvedValue(null);

    const resposta = await service.recoveryPassword({
      email: "naoexiste@email.com",
    });

    // Mesma resposta que quando o email existe (para o atacante não
    // descobrir quem é cliente).
    expect(resposta).toBe(MENSAGEM_GENERICA);
    // E nenhum e-mail saiu nem token foi criado.
    expect(sendMail).not.toHaveBeenCalled();
    expect(repository.createPasswordResetToken).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // TESTE 10 — inspecionar os argumentos de um mock (o mais completo)
  // ---------------------------------------------------------------------------
  it("salva só o HASH do token e envia o token original por e-mail", async () => {
    // ARRANGE
    const usuario = criarUsuario();
    repository.findUserByEmail.mockResolvedValue(usuario);
    repository.createPasswordResetToken.mockResolvedValue({ id: "token-1" });
    // `sendMail` já é falso (vi.mock lá em cima). Como o resetAllMocks o
    // zerou, ele devolve undefined — e isso basta ("enviou sem erro").

    // ACT
    const resposta = await service.recoveryPassword({ email: usuario.email });

    // ASSERT
    expect(resposta).toBe(MENSAGEM_GENERICA);

    // O que foi gravado no banco (1º argumento do createPasswordResetToken):
    const salvo = repository.createPasswordResetToken.mock.calls[0]![0];
    expect(salvo.userId).toBe(usuario.id);
    expect(salvo.token_hash).toHaveLength(64); // sha256 em hex = 64 caracteres

    // O que foi enviado por e-mail. sendMail(para, assunto, html).
    // `vi.mocked(sendMail)` só avisa o TypeScript que `sendMail` é um mock
    // (para ele aceitar `.mock.calls`). Em runtime não muda nada.
    // Desestruturamos os 3 argumentos da 1ª chamada de uma vez.
    const [para, assunto, html] = vi.mocked(sendMail).mock.calls[0]!;
    expect(para).toBe(usuario.email);
    expect(assunto).toBe("Recuperação de senha");

    // O banco guarda o HASH; o e-mail leva o token CRU. Se o banco vazar,
    // ninguém consegue usar os tokens.
    expect(html).not.toContain(salvo.token_hash);
    // Esta regex procura o token cru dentro do link do e-mail.
    // (ATENÇÃO: quando você corrigir o link com FRONTEND_URL, ajuste isto.)
    const tokenCru = /recoverypassword\/([a-f0-9]{64})/.exec(html)?.[1];
    expect(tokenCru).toBeDefined();
    expect(tokenCru).not.toBe(salvo.token_hash);

    // A expiração fica ~15 minutos à frente. Comparamos com folga de 5s,
    // porque o relógio andou entre a chamada e a verificação.
    const quinzeMin = 15 * 60 * 1000;
    const diferenca = salvo.expiresAt.getTime() - Date.now();
    expect(diferenca).toBeGreaterThan(quinzeMin - 5000);
    expect(diferenca).toBeLessThanOrEqual(quinzeMin);
  });

  // ---------------------------------------------------------------------------
  // TESTE 11 — SIMULAR UMA FALHA EXTERNA: mockRejectedValue
  // ---------------------------------------------------------------------------
  it("lança InternalServerError quando o envio do e-mail falha", async () => {
    repository.findUserByEmail.mockResolvedValue(criarUsuario());
    repository.createPasswordResetToken.mockResolvedValue({ id: "token-1" });

    // `mockRejectedValue`: "quando chamarem sendMail, DÊ ERRO com isto".
    // É assim que simulamos o Gmail fora do ar sem precisar derrubar o Gmail.
    vi.mocked(sendMail).mockRejectedValue(new Error("SMTP caiu"));

    await expect(
      service.recoveryPassword({ email: "maria@email.com" }),
    ).rejects.toThrow("Erro ao enviar email de recuperação de senha.");
  });
});

// =============================================================================
// EXERCÍCIOS PARA VOCÊ
// =============================================================================
// `it.todo` aparece no relatório como "pendente" e não roda nada. Use como
// lista do que implementar sozinho. Para cada um, siga a receita da PARTE 4:
//   1. liste os finais possíveis  2. descubra as dependências
//   3. Arrange → Act → Assert     4. estrague de propósito para ver falhar
//
// Dicas de qual receita da PARTE 5 usar:
//  • resetPassword com token inválido → "erro" + mock de
//      repository.updatePasswordResetToken devolvendo null
//      (precisa adicionar esse método ao objeto `repository` lá em cima)
//  • getUserById não devolve password_hash → "conferir o valor devolvido"
//      com expect(resultado).not.toHaveProperty("password_hash")
//  • updateProfile permite manter o próprio telefone → "conferir que NÃO
//      deu erro" (basta chamar e conferir o retorno)
describe("exercícios", () => {
  it.todo("resetPassword lança BadRequestError quando o token é inválido");
  it.todo("getUserById não devolve password_hash");
  it.todo("updateProfile permite manter o próprio telefone");
});
