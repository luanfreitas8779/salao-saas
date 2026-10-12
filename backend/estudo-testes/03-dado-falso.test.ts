// =============================================================================
// DEGRAU 3 — DADO FALSO (MOCK)
// =============================================================================
//
// Até aqui só testamos funções que não dependem de nada. Mas o seu sistema
// real não é assim. Olhe o cadastro de usuário:
//
//     1. consulta o BANCO para ver se o email já existe
//     2. se não existe, grava o usuário NO BANCO
//
// Ou seja: a função depende do banco. E agora?
//
//     npx vitest run estudo-testes/03
//
// -----------------------------------------------------------------------------
// PASSO 1 — O PROBLEMA (sentir a dor antes do remédio)
// -----------------------------------------------------------------------------
//
// Se o teste usasse o banco de verdade:
//
//   ✗ precisaria do Postgres ligado — sem ele, o teste quebra (e não é bug seu)
//   ✗ cada execução gravaria usuário de verdade e sujaria o banco
//   ✗ seria lento (rede, disco)
//   ✗ e como você simularia "o banco caiu"? Não dá.
//
// Pensa comigo: para testar a REGRA ("email repetido dá erro"), eu preciso do
// banco funcionando mesmo? Não! A regra está no código. O banco é só quem
// responde "sim" ou "não" para a pergunta "esse email existe?".
//
// -----------------------------------------------------------------------------
// PASSO 2 — O REMÉDIO: trocar o banco por um DUBLÊ
// -----------------------------------------------------------------------------
//
// Um dublê (também chamado de "mock" ou "dado falso") é um objeto que PARECE
// o banco, mas eu controlo o que ele responde.
//
//     código ──fala com──▶ [ repositório FALSO ]   ← eu mando a resposta
//
// Para isso funcionar, a função não pode "criar" o repositório por conta
// própria. Ela precisa RECEBER ele de fora. É exatamente o que o seu service
// faz: `new UserService(repository)`. Esse detalhe do seu projeto é o que
// torna o teste possível.
//
import { describe, it, expect, vi, beforeEach } from "vitest";

// Esta é uma função de brinquedo que imita o cadastro do seu projeto.
// IGNORE os detalhes dela, só repare em UMA coisa: ela recebe `repositorio`
// como parâmetro, e chama dois métodos dele.
interface Repositorio {
  buscarPorEmail(email: string): Promise<unknown>;
  salvar(email: string): Promise<{ id: string; email: string }>;
}

async function cadastrar(repositorio: Repositorio, email: string) {
  const jaExiste = await repositorio.buscarPorEmail(email);

  if (jaExiste) {
    throw new Error("Já existe um usuário com este email!");
  }

  return repositorio.salvar(email);
}

// -----------------------------------------------------------------------------
// PASSO 3 — Primeiro um dublê FEITO NA MÃO (sem ferramenta nenhuma)
// -----------------------------------------------------------------------------
describe("cadastrar (com dublê feito na mão)", () => {
  it("salva o usuário quando o email está livre", async () => {
    // O dublê: um objeto comum com as mesmas funções do repositório.
    // `buscarPorEmail` SEMPRE responde `null` ("não achei ninguém").
    // `salvar` devolve um usuário qualquer.
    const repositorioFalso = {
      buscarPorEmail: async () => null,
      salvar: async (email: string) => ({ id: "1", email }),
    };

    // Chamo a função entregando o dublê no lugar do banco.
    const usuario = await cadastrar(repositorioFalso, "maria@email.com");

    // Confiro o resultado.
    expect(usuario).toEqual({ id: "1", email: "maria@email.com" });
  });
});

// Funcionou! Sem Postgres, sem internet, rapidinho.
//
// Mas olha a limitação. Eu quero conferir uma coisa importante:
// "quando o email JÁ existe, o `salvar` NÃO pode ser chamado".
// Como eu descubro se o `salvar` foi chamado, com um dublê na mão?
//
// Teria que criar um contador:
//
//     let chamadasDoSalvar = 0;
//     const repositorioFalso = {
//       buscarPorEmail: async () => ({ id: "9" }),
//       salvar: async (email) => { chamadasDoSalvar++; return {...}; },
//     };
//     ...
//     expect(chamadasDoSalvar).toBe(0);
//
// Funciona, mas em todo teste eu teria que reinventar isso. Que chato.
// É AQUI que entra a ferramenta.

// -----------------------------------------------------------------------------
// PASSO 4 — vi.fn(): o dublê que anota tudo sozinho
// -----------------------------------------------------------------------------
//
// `vi.fn()` cria uma função falsa que:
//
//   1. por padrão não faz nada;
//   2. ANOTA cada vez que foi chamada, e com quais argumentos;
//   3. responde o que eu mandar.
//
// É o dublê com um caderninho. Ele resolve o problema do contador sozinho.
//
// Como mandar ela responder? Os dois mais usados:
//
//     funcao.mockResolvedValue(X)   →  "quando chamarem, responda X"
//                                       (use em funções async, que é o caso
//                                        de tudo que fala com o banco)
//     funcao.mockRejectedValue(erro)→  "quando chamarem, dê ERRO"
//
// Vamos usar. Primeiro o dublê, agora com vi.fn():
const repositorio = {
  buscarPorEmail: vi.fn(),
  salvar: vi.fn(),
};

// `beforeEach` roda ANTES de cada teste. Aqui usamos para limpar o caderninho
// e as respostas programadas. Sem isso, o que um teste programou "vaza" para
// o próximo e você terá testes que dependem da ordem. Péssimo.
beforeEach(() => {
  vi.resetAllMocks();
});

describe("cadastrar (com vi.fn)", () => {
  it("salva o usuário quando o email está livre", async () => {
    // --- 1) PREPARAR: programo as respostas do dublê.
    // "Quando perguntarem se o email existe, responda null (ninguém)."
    repositorio.buscarPorEmail.mockResolvedValue(null);
    // "Quando mandarem salvar, responda com este usuário."
    repositorio.salvar.mockResolvedValue({ id: "1", email: "maria@email.com" });

    // --- 2) AGIR: chamo a função de verdade.
    const usuario = await cadastrar(repositorio, "maria@email.com");

    // --- 3) CONFERIR: aqui está a novidade. Posso perguntar ao caderninho.
    expect(usuario).toEqual({ id: "1", email: "maria@email.com" });

    // "O `salvar` foi chamado COM este argumento?"
    expect(repositorio.salvar).toHaveBeenCalledWith("maria@email.com");

    // "Foi chamado exatamente 1 vez?"
    expect(repositorio.salvar).toHaveBeenCalledTimes(1);
  });
});

// -----------------------------------------------------------------------------
// PASSO 5 — FAÇA VOCÊ
// -----------------------------------------------------------------------------
//
// EXERCÍCIO A — troque a resposta e veja o que muda
//   No teste acima, troque `mockResolvedValue(null)` do `buscarPorEmail` por
//   `mockResolvedValue({ id: "9" })` ("achei alguém"). Rode.
//   → O que acontece? Por quê? (A função lança erro: o email já existe.)
//   Desfaça.
//
// EXERCÍCIO B — tire o `vi.resetAllMocks()` do beforeEach
//   Comente o beforeEach inteiro e adicione um segundo teste qualquer que
//   confira `toHaveBeenCalledTimes(1)`. Veja o que acontece quando os
//   testes "vazam" um para o outro. Depois desfaça.
//
// EXERCÍCIO C — o `mock.calls`
//   Dentro do teste, depois do ACT, adicione:
//       console.log(repositorio.salvar.mock.calls);
//   Rode e leia a saída. É o "caderninho" aberto: uma lista com os
//   argumentos de cada chamada.
//
// -----------------------------------------------------------------------------
// FECHAMENTO
// -----------------------------------------------------------------------------
// ✔ Mock = dublê: um objeto falso que eu controlo no lugar do banco/e-mail.
// ✔ `vi.fn()` = função falsa com caderninho.
// ✔ `.mockResolvedValue(x)` = programa a resposta.
// ✔ `expect(fn).toHaveBeenCalledWith(...)` = confere o caderninho.
// ✔ `beforeEach` + `vi.resetAllMocks()` = começa limpo a cada teste.
//
// Próximo: 04-erros-e-chamadas.test.ts  (faça os desafios aqui embaixo antes)

// =============================================================================
// 🏆 DESAFIOS DO DEGRAU 3 — agora é com você
// =============================================================================
//
// Regras do jogo:
//   - Use a função `cadastrar` e o `repositorio` (vi.fn) que já estão acima.
//   - Troque cada `it.todo(...)` por um `it(...)` dentro do `describe`
//     "cadastrar (com vi.fn)" ou em um novo `describe` abaixo.
//   - Siga a estrutura de 3 blocos que já viu: PREPARAR → AGIR → CONFERIR.
//
// -----------------------------------------------------------------------------
// DESAFIO 1 — "se o email já existe, NÃO salva"
// -----------------------------------------------------------------------------
//   Escreva um teste que prove: quando o `buscarPorEmail` responde que o
//   email já existe, o `salvar` NUNCA é chamado.
//
//   Passo a passo:
//     1. PREPARAR: programe `buscarPorEmail` para responder "achei alguém"
//        (use `mockResolvedValue` com um objeto qualquer, ex.: { id: "9" }).
//     2. AGIR: a função vai lançar erro nesse caso. Para segurar o erro sem
//        quebrar o teste, use:
//            await expect(cadastrar(...)).rejects.toThrow();
//        (É novidade aqui; no degrau 4 você aprofunda. Por ora, copie o
//        formato.)
//     3. CONFERIR: o `salvar` não foi chamado. A ferramenta é
//        `expect(repositorio.salvar).not.toHaveBeenCalled()`.
//
// -----------------------------------------------------------------------------
// DESAFIO 2 — "perguntou pelo email certo, uma vez só"
// -----------------------------------------------------------------------------
//   No caminho feliz (email livre), confira DUAS coisas sobre o
//   `buscarPorEmail`:
//     a) ele foi chamado com o email que a gente passou;
//     b) ele foi chamado exatamente 1 vez.
//
//   Ferramentas (você já viu as duas acima):
//     expect(...).toHaveBeenCalledWith(...)
//     expect(...).toHaveBeenCalledTimes(...)
//
//   Bônus: depois que passar, faça
//   `console.log(repositorio.buscarPorEmail.mock.calls)` e leia o
//   "caderninho" do mock.
describe("DESAFIOS do degrau 3", () => {
  it.todo("DESAFIO 1: email já existe → salvar NÃO é chamado");
  it.todo("DESAFIO 2: buscarPorEmail chamado 1 vez com o email certo");
});
