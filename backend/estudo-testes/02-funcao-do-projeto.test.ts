// =============================================================================
// DEGRAU 2 — TESTANDO UMA FUNÇÃO DO SEU PROJETO
// =============================================================================
//
// No degrau 1 a função estava dentro do próprio arquivo. Agora vamos testar
// uma função REAL do salão: as de `src/utils/businessTime.ts`.
//
// Por que começar por elas? Porque são funções "puras":
//
//     entra um valor  →  sai um valor.   Pronto.
//
// Elas não usam banco, não mandam e-mail, não dependem de nada. São as mais
// fáceis de testar. (As difíceis vêm no degrau 3.)
//
//     npx vitest run estudo-testes/02
//
// -----------------------------------------------------------------------------
// ANTES: o que essas funções fazem?
// -----------------------------------------------------------------------------
// O salão guarda horários como texto: "08:30". Para fazer conta (o horário
// cabe antes do fechamento?), o código converte para MINUTOS desde a meia-noite:
//
//     toMinutes("08:30")   → 510      (8 × 60 + 30)
//     fromMinutes(510)     → "08:30"  (o caminho de volta)
//
import { describe, it, expect } from "vitest";
import {
  toMinutes,
  fromMinutes,
  businessDayOfWeek,
  toBusinessWallClock,
} from "../src/utils/businessTime";

// Se você achou estranho o `../src/...`: este arquivo está na pasta
// `estudo-testes`, então "../" sobe um nível até `backend` e entra em `src`.

// -----------------------------------------------------------------------------
// PASSO 1 — O teste mais direto: entrada → saída
// -----------------------------------------------------------------------------
describe("toMinutes", () => {
  it("converte um horário em minutos desde a meia-noite", () => {
    expect(toMinutes("08:30")).toBe(510);
  });

  // Um teste por situação. Meia-noite é um caso especial que vale conferir:
  it("converte meia-noite em 0", () => {
    expect(toMinutes("00:00")).toBe(0);
  });

  // E o último minuto do dia:
  it("converte 23:59 em 1439", () => {
    expect(toMinutes("23:59")).toBe(1439);
  });
});

// -----------------------------------------------------------------------------
// PASSO 2 — O caminho de volta, e um truque: testar os DOIS lados
// -----------------------------------------------------------------------------
describe("fromMinutes", () => {
  it("converte minutos em horário no formato HH:mm", () => {
    expect(fromMinutes(510)).toBe("08:30");
  });

  // Repare: `padStart` coloca o zero na frente. Sem ele, daria "8:5".
  // Este teste existe para proteger isso:
  it("completa com zero à esquerda", () => {
    expect(fromMinutes(65)).toBe("01:05");
  });

  // Truque: se eu converto ida e volta, tenho que cair onde comecei.
  it("é o inverso de toMinutes", () => {
    expect(fromMinutes(toMinutes("14:45"))).toBe("14:45");
  });
});

// -----------------------------------------------------------------------------
// PASSO 3 — Quando o resultado é um OBJETO: toEqual
// -----------------------------------------------------------------------------
// `toBe` serve para valor simples (número, texto). Para comparar objetos, use
// `toEqual`, que compara o CONTEÚDO, não "se é o mesmo objeto na memória".
//
// A função abaixo converte um instante (UTC) para o horário do salão (UTC-3).
// 11:00 em UTC são 08:00 em São Paulo.
describe("toBusinessWallClock", () => {
  it("converte um instante UTC para data e minutos no horário do salão", () => {
    const instante = new Date("2026-10-12T11:00:00Z");

    const resultado = toBusinessWallClock(instante);

    expect(resultado).toEqual({ date: "2026-10-12", minutes: 480 }); // 08:00
  });

  // Caso interessante: 01:00 UTC ainda é o dia ANTERIOR no Brasil.
  // Este é o tipo de bug de fuso que passa batido em teste manual.
  it("vira para o dia anterior quando o UTC está na madrugada", () => {
    const instante = new Date("2026-10-12T01:00:00Z");

    expect(toBusinessWallClock(instante)).toEqual({
      date: "2026-10-11",
      minutes: 22 * 60, // 22:00 do dia 11
    });
  });
});

describe("businessDayOfWeek", () => {
  // 0 = domingo ... 6 = sábado. 12/10/2026 é uma segunda-feira.
  it("devolve 1 para uma segunda-feira", () => {
    expect(businessDayOfWeek("2026-10-12")).toBe(1);
  });

  it("devolve 0 para um domingo", () => {
    expect(businessDayOfWeek("2026-10-11")).toBe(0);
  });
});

// -----------------------------------------------------------------------------
// PASSO 4 — FAÇA VOCÊ
// -----------------------------------------------------------------------------
//
// EXERCÍCIO A — estrague de propósito
//   Abra `src/utils/businessTime.ts` e, em `toMinutes`, troque `hours * 60`
//   por `hours * 6`. Rode este arquivo.
//   → Quantos testes ficaram vermelhos? Leia a mensagem de um deles.
//   Desfaça.
//
// EXERCÍCIO B — escreva um teste novo
//   Escreva um `it` que confira `toMinutes("12:00")` igual a 720.
//   Depois, outro que confira `fromMinutes(0)` igual a "00:00".
//
// EXERCÍCIO C — pense como o dono do bug
//   Quais outros valores de `businessDayOfWeek` valem testar? (Pense em
//   sábado.) Escreva o teste. Rode. Passou de primeira ou você errou a data?
//   Se errou, ótimo: você aprendeu que o TESTE também pode estar errado,
//   e que a mensagem de erro te ajuda a descobrir quem errou.
//
// -----------------------------------------------------------------------------
// FECHAMENTO
// -----------------------------------------------------------------------------
// ✔ Função pura: entrada → saída. A mais fácil de testar.
// ✔ `toBe` para valores simples, `toEqual` para objetos.
// ✔ Teste os casos de borda: zero, o último valor, a virada do dia.
//
// Próximo: 03-dado-falso.test.ts — onde as coisas ficam interessantes.
// (Faça os desafios aqui embaixo antes.)

// =============================================================================
// 🏆 DESAFIOS DO DEGRAU 2 — agora é com você
// =============================================================================
//
// Regras do jogo:
//   - Troque cada `it.todo(...)` por um `it(...)` de verdade.
//   - Estas funções AINDA NÃO estão importadas lá em cima. Adicione
//     `businessDateTime` e `nextBusinessDay` na lista do `import { ... }`.
//   - Ao terminar, estrague a função em `businessTime.ts` de propósito e
//     confira que seus testes ficam vermelhos. Depois desfaça.
//
// Antes de começar, o que as funções fazem:
//
//     businessDateTime("2026-10-12", "08:00")
//         → o INSTANTE (Date) em que são 08:00 em São Paulo nesse dia.
//           São Paulo é UTC-3, então 08:00 lá = 11:00 em UTC.
//
//     nextBusinessDay("2026-10-12")
//         → o instante em que COMEÇA o dia seguinte (meia-noite do dia 13,
//           no horário de São Paulo).
//
// -----------------------------------------------------------------------------
// DESAFIO 1 — `businessDateTime`
// -----------------------------------------------------------------------------
//   Escreva um teste que confira que:
//       businessDateTime("2026-10-12", "08:00")
//   é o instante  2026-10-12 às 11:00 UTC.
//
//   Dicas:
//     - Um `Date` de UTC se cria assim:  new Date("2026-10-12T11:00:00.000Z")
//     - Para comparar dois `Date`, use `.toEqual(...)`.
//       (Alternativa: compare os textos com `.toISOString()` e `.toBe(...)`.)
//
// -----------------------------------------------------------------------------
// DESAFIO 2 — `nextBusinessDay`
// -----------------------------------------------------------------------------
//   Escreva um teste que confira o que `nextBusinessDay("2026-10-12")`
//   devolve, e depois um SEGUNDO teste com a virada de mês:
//   `nextBusinessDay("2026-10-31")`.
//
//   Dicas:
//     - Calcule o valor esperado NO PAPEL antes de rodar: o dia seguinte
//       começa à meia-noite de São Paulo. Em UTC, meia-noite de SP é qual hora?
//     - Se o seu teste falhar, leia o "expected / received": ele mostra os dois
//       valores. Pergunte-se: quem errou, a função ou a minha conta?
describe("DESAFIOS do degrau 2", () => {
  it.todo("DESAFIO 1: businessDateTime('2026-10-12', '08:00') é 11:00 UTC");
  it.todo("DESAFIO 2: nextBusinessDay (dia comum e virada de mês)");
});
