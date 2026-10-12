// =============================================================================
// DEGRAU 4 — TESTANDO ERROS E CONFERINDO CHAMADAS
// =============================================================================
//
// No degrau 3 você testou o caminho feliz ("deu certo"). Mas a maior parte
// das regras de negócio é sobre o que acontece quando DÁ ERRADO:
//
//     email repetido → erro 409
//     senha errada   → erro 401
//     Gmail fora     → erro 500
//
// Este degrau ensina as 3 receitas que você mais vai usar:
//   RECEITA 1 — "a função deve dar erro"
//   RECEITA 2 — "algo NÃO pode ser chamado"
//   RECEITA 3 — "um serviço externo falhou"
//
//     npx vitest run estudo-testes/04
//
import { describe, it, expect, vi, beforeEach } from "vitest";

// A mesma função de brinquedo do degrau 3, agora com uma classe de erro
// parecida com as do seu projeto (lembra do AppError com statusCode?).
class ConflictError extends Error {
  readonly statusCode = 409;
}

interface Repositorio {
  buscarPorEmail(email: string): Promise<unknown>;
  salvar(email: string): Promise<{ id: string; email: string }>;
}

interface Mailer {
  enviarBoasVindas(email: string): Promise<void>;
}

async function cadastrar(repositorio: Repositorio, mailer: Mailer, email: string) {
  const jaExiste = await repositorio.buscarPorEmail(email);

  if (jaExiste) {
    throw new ConflictError("Já existe um usuário com este email!");
  }

  const usuario = await repositorio.salvar(email);
  await mailer.enviarBoasVindas(email);
  return usuario;
}

const repositorio = { buscarPorEmail: vi.fn(), salvar: vi.fn() };
const mailer = { enviarBoasVindas: vi.fn() };

beforeEach(() => {
  vi.resetAllMocks();
});

// =============================================================================
// RECEITA 1 — "A FUNÇÃO DEVE DAR ERRO"
// =============================================================================
describe("RECEITA 1: testar que dá erro", () => {
  it("lança ConflictError quando o email já existe", async () => {
    // Preparo: o dublê diz "achei alguém com esse email".
    repositorio.buscarPorEmail.mockResolvedValue({ id: "9" });

    // ATENÇÃO — este é o ponto mais importante do degrau inteiro:
    //
    //   ✗ ERRADO:   await cadastrar(...)           ← o erro estoura AQUI,
    //                                                 o teste quebra por
    //                                                 "exceção inesperada".
    //
    //   ✓ CERTO:    await expect( cadastrar(...) ).rejects....
    //                                              ← o `expect` segura a
    //                                                 função e espera o erro.
    //
    // Lê-se: "eu ESPERO que (a chamada) seja REJEITADA com um ConflictError".
    await expect(
      cadastrar(repositorio, mailer, "maria@email.com"),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("o erro traz a mensagem e o status certos", async () => {
    repositorio.buscarPorEmail.mockResolvedValue({ id: "9" });

    // `toMatchObject` confere SÓ os campos que eu citei (ignora o resto).
    // Ótimo para erro: eu quero a mensagem e o status, não o stack inteiro.
    await expect(
      cadastrar(repositorio, mailer, "maria@email.com"),
    ).rejects.toMatchObject({
      message: "Já existe um usuário com este email!",
      statusCode: 409,
    });
  });
});

// =============================================================================
// RECEITA 2 — "ALGO NÃO PODE TER SIDO CHAMADO"
// =============================================================================
// Quando dá erro, o mais importante muitas vezes é o que NÃO aconteceu.
// Se o email já existe, o código NÃO pode gravar usuário nem mandar e-mail.
// Um service com bug poderia lançar o erro E MESMO ASSIM gravar. O teste de
// erro sozinho não pegaria isso. Este pega:
describe("RECEITA 2: testar que algo NÃO foi chamado", () => {
  it("não salva nem envia e-mail quando o email já existe", async () => {
    repositorio.buscarPorEmail.mockResolvedValue({ id: "9" });

    // Espero o erro (e já "engulo" ele, para o teste seguir adiante)...
    await expect(
      cadastrar(repositorio, mailer, "maria@email.com"),
    ).rejects.toThrow();

    // ...e AGORA confiro o caderninho: nenhuma dessas foi chamada.
    expect(repositorio.salvar).not.toHaveBeenCalled();
    expect(mailer.enviarBoasVindas).not.toHaveBeenCalled();
  });

  it("(caminho feliz) salva E envia o e-mail com o endereço certo", async () => {
    repositorio.buscarPorEmail.mockResolvedValue(null);
    repositorio.salvar.mockResolvedValue({ id: "1", email: "maria@email.com" });

    await cadastrar(repositorio, mailer, "maria@email.com");

    // O lado positivo da mesma moeda: foi chamado, e com o argumento certo.
    expect(repositorio.salvar).toHaveBeenCalledWith("maria@email.com");
    expect(mailer.enviarBoasVindas).toHaveBeenCalledWith("maria@email.com");
  });
});

// =============================================================================
// RECEITA 3 — "UM SERVIÇO EXTERNO FALHOU"
// =============================================================================
// Como você testa "o Gmail caiu" sem derrubar o Gmail? Programando o dublê
// para dar erro. Em vez de `mockResolvedValue`, usamos `mockRejectedValue`.
describe("RECEITA 3: simular falha de serviço externo", () => {
  it("propaga o erro quando o envio do e-mail falha", async () => {
    repositorio.buscarPorEmail.mockResolvedValue(null);
    repositorio.salvar.mockResolvedValue({ id: "1", email: "maria@email.com" });

    // "Quando mandarem enviar o e-mail, DÊ ERRO com esta mensagem."
    mailer.enviarBoasVindas.mockRejectedValue(new Error("SMTP caiu"));

    await expect(
      cadastrar(repositorio, mailer, "maria@email.com"),
    ).rejects.toThrow("SMTP caiu");
  });
});

// -----------------------------------------------------------------------------
// FAÇA VOCÊ
// -----------------------------------------------------------------------------
//
// EXERCÍCIO A — o `await` esquecido (o erro nº 1 de iniciante)
//   No primeiro teste da RECEITA 1, apague o `await` antes do `expect`.
//   Rode e leia a mensagem. O Vitest atual te avisa e falha o teste:
//
//       Promise returned by `expect(actual).rejects...` was not awaited.
//
//   Ele te protege. Mas guarde o porquê: sem o `await`, o teste TERMINA
//   antes de a verificação acontecer. Em ferramentas/versões mais antigas
//   isso passava em silêncio (teste "de mentira", sempre verde).
//   Coloque o `await` de volta.
//   Lição: `await expect(...).rejects` — SEMPRE com await.
//
// EXERCÍCIO B — estrague a regra de verdade
//   Em `cadastrar`, apague o `throw` do `if (jaExiste)` (deixe o if vazio).
//   Rode. Quantos testes ficaram vermelhos? Quais? Faz sentido?
//   Desfaça.
//
// EXERCÍCIO C — escreva um teste seu
//   Faça um teste: "quando o `salvar` falha (mockRejectedValue), o e-mail de
//   boas-vindas NÃO deve ser enviado". Siga a RECEITA 2 + a RECEITA 3.
//
// -----------------------------------------------------------------------------
// FECHAMENTO — a cola do que você sabe agora
// -----------------------------------------------------------------------------
//   Quero que o banco devolva algo   → fn.mockResolvedValue(x)
//   Quero simular "não achou"        → fn.mockResolvedValue(null)
//   Quero simular uma falha          → fn.mockRejectedValue(new Error("..."))
//   Quero conferir um erro           → await expect(chamada).rejects.toThrow()
//   Quero conferir que foi chamado   → expect(fn).toHaveBeenCalledWith(...)
//   Quero conferir que NÃO chamou    → expect(fn).not.toHaveBeenCalled()
//
// Próximo: 05-controller-simples.test.ts — testar um controller de verdade.
// Depois dele, o `src/app/user/user.service.test.ts` (o teste do login).
// (Faça os desafios aqui embaixo antes.)

// =============================================================================
// 🏆 DESAFIOS DO DEGRAU 4 — agora é com você
// =============================================================================
//
// Regras do jogo:
//   - Use `cadastrar`, `repositorio` e `mailer` que já estão acima.
//   - Troque cada `it.todo(...)` por um `it(...)`.
//   - Lembre: `await expect(...).rejects...` — SEMPRE com await.
//   - (O "FAÇA VOCÊ C" lá em cima, sobre `salvar` falhar, continua valendo
//     como treino. Estes desafios são novos.)
//
// -----------------------------------------------------------------------------
// DESAFIO 1 — "o banco caiu"
// -----------------------------------------------------------------------------
//   E se o PRÓPRIO `buscarPorEmail` falhar (banco fora do ar)? Escreva um
//   teste que prove três coisas:
//     a) o erro sobe (a função é rejeitada com a mesma mensagem);
//     b) `salvar` NÃO é chamado;
//     c) o e-mail de boas-vindas NÃO é enviado.
//
//   Receitas que você precisa (todas estão acima):
//     - simular falha:        mockRejectedValue(new Error("..."))
//     - conferir erro:        await expect(...).rejects.toThrow("...")
//     - conferir não chamado: expect(...).not.toHaveBeenCalled()
//
// -----------------------------------------------------------------------------
// DESAFIO 2 — vários emails, um teste só (`it.each`)
// -----------------------------------------------------------------------------
//   Escreva UM teste que rode para 3 emails diferentes livres e confira que,
//   para cada um, o `salvar` foi chamado com aquele email.
//
//   Novidade: `it.each`. O formato é:
//
//       it.each([
//         ["descrição do caso A", "valor A"],
//         ["descrição do caso B", "valor B"],
//       ])("faz algo com %s", async (_descricao, valor) => {
//         // dentro: use `valor` como entrada
//       });
//
//     - `%s` no título é trocado pelo primeiro item da linha.
//     - `_descricao` (com underline) significa "recebo, mas não uso".
//
//   Dica: o teste "cada um tem seu email" é ótimo para pegar bug de quem
//   "fixa" um email dentro da função sem querer.
describe("DESAFIOS do degrau 4", () => {
  it.todo("DESAFIO 1: buscarPorEmail falha → erro sobe, nada é salvo/enviado");
  it.todo("DESAFIO 2: it.each com 3 emails livres, salvar com cada um");
});
