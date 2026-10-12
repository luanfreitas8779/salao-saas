// =============================================================================
// DEGRAU 1 — O PRIMEIRO TESTE
// =============================================================================
//
// Objetivo desta aula: ver um teste ficar VERDE, depois VERMELHO, e entender
// o que cada pedacinho faz. Só isso. Sem banco, sem mock, sem nada.
//
// Como rodar (no terminal, dentro da pasta backend):
//
//     npx vitest run estudo-testes/01
//
// -----------------------------------------------------------------------------
// PASSO 1 — As 3 palavras que você precisa conhecer
// -----------------------------------------------------------------------------
//
//   it("...", () => { ... })       → UM teste. O texto é o que você ESPERA.
//   describe("...", () => { ... }) → Uma "caixinha" que agrupa vários testes.
//   expect(...).toBe(...)          → A verificação: "eu espero que X seja Y".
//
// É isso. Só essas 3.
//
// De onde elas vêm? Do Vitest (a ferramenta de testes). Por isso o import:
import { describe, it, expect } from "vitest";

// -----------------------------------------------------------------------------
// PASSO 2 — Um teste de verdade
// -----------------------------------------------------------------------------
describe("matemática básica", () => {
  it("dois mais dois é quatro", () => {
    // Isto lê-se: "eu ESPERO que (2 + 2) SEJA 4".
    expect(2 + 2).toBe(4);
  });
});

// Rode agora. Você vai ver algo assim:
//
//     ✓ estudo-testes/01-primeiro-teste.test.ts (...)
//     Tests  ... passed
//
// Verde = o que você esperava é o que aconteceu. 🎉

// -----------------------------------------------------------------------------
// PASSO 3 — FAÇA VOCÊ: deixe ficar vermelho
// -----------------------------------------------------------------------------
//
// Vá no teste acima e troque `.toBe(4)` por `.toBe(5)`. Salve e rode.
//
// Vai aparecer algo como:
//
//     AssertionError: expected 4 to be 5
//
// Leia isso como uma frase: "eu esperava 5, mas veio 4".
// O Vitest te dá o RECIBO do que deu errado. Aprenda a ler essa frase —
// você vai ler ela MUITAS vezes.
//
// Depois volte para `.toBe(4)`.

// -----------------------------------------------------------------------------
// PASSO 4 — Testando uma função SUA
// -----------------------------------------------------------------------------
//
// Até agora testamos `2 + 2`. Em projeto real a gente testa funções que nós
// escrevemos. Vamos criar uma pequena aqui mesmo, só para treinar:
function calcularPreco(precoBase: number, desconto: number): number {
  return precoBase - desconto;
}

describe("calcularPreco", () => {
  it("subtrai o desconto do preço base", () => {
    // 1) QUANDO eu chamo a função com 100 e 20...
    const resultado = calcularPreco(100, 20);

    // 2) ENTÃO eu espero 80.
    expect(resultado).toBe(80);
  });

  it("sem desconto, devolve o preço cheio", () => {
    expect(calcularPreco(100, 0)).toBe(100);
  });
});

// Repare na estrutura, ela vai se repetir em TODO teste daqui para frente:
//
//     const resultado = funcao(entrada);   ← faço a coisa
//     expect(resultado).toBe(esperado);    ← confiro
//
// -----------------------------------------------------------------------------
// PASSO 5 — FAÇA VOCÊ: o alarme de verdade
// -----------------------------------------------------------------------------
//
// Lembra da história do `!` apagado? Aqui vai a versão pequena:
//
//   1. Na função `calcularPreco`, troque `-` por `+` (agora ela SOMA o desconto).
//   2. Rode os testes.
//   3. Veja os DOIS... espera, só UM ficou vermelho. Qual? Por quê?
//      (Dica: o teste "sem desconto" continua verde. Pense: 100 + 0 = ?)
//
// Isso ensina uma coisa importante: **um teste só pega o bug que ele sabe
// procurar**. Testar com desconto 0 não pega o erro; testar com 20 pega.
// Por isso a gente escolhe BEM os casos.
//
// Desfaça a mudança (volte para `-`).
//
// -----------------------------------------------------------------------------
// FECHAMENTO
// -----------------------------------------------------------------------------
// ✔ Um teste é: chamar algo + conferir o resultado.
// ✔ `it` = um teste, `describe` = grupo, `expect(...).toBe(...)` = conferir.
// ✔ Vermelho não é "erro seu", é o alarme funcionando.
//
// Próximo: 02-funcao-do-projeto.test.ts  (faça os desafios aqui embaixo antes)

// =============================================================================
// 🏆 DESAFIOS DO DEGRAU 1 — agora é com você
// =============================================================================
//
// Regras do jogo:
//   - Eu NÃO deixei a resposta. Você escreve a função E o teste.
//   - Troque cada `it.todo(...)` por um `it(...)` de verdade (veja os
//     exemplos acima: `it("texto", () => { ... })`).
//   - Escreva a função logo acima do `describe`, como fizemos com
//     `calcularPreco`.
//   - Quando passar, estrague de propósito para ver ficar vermelho
//     (faz parte do desafio!).
//
// -----------------------------------------------------------------------------
// DESAFIO 1 — `ehMaiorDeIdade`
// -----------------------------------------------------------------------------
//   Crie a função `ehMaiorDeIdade(idade: number): boolean` que devolve
//   `true` se a idade for 18 ou mais, e `false` caso contrário.
//
//   Escreva 3 testes (um `it` para cada):
//     a) 30 anos  → true
//     b) 17 anos  → false
//     c) 18 anos  → true      ← o "caso de borda": o limite exato!
//
//   Dicas:
//     - Para conferir `true`/`false`, use `.toBe(true)` e `.toBe(false)`.
//     - Pergunta para pensar: qual desses 3 testes pegaria o bug de alguém
//       escrever `idade > 18` em vez de `idade >= 18`?

  function ehMaiorDeIdade (idade: number) {
    return idade >= 18
    }

  describe('Testa se é maior de idade', () => {
    it('retorna true para 30 anos', () => {
      const result = ehMaiorDeIdade(30)
      expect(result).toBe(true)
    })
    it('retorna false para 17 anos', () => {
      const result = ehMaiorDeIdade(17)
      expect(result).toBe(false)
    })
    it('retorna true para 18 anos', () => {
      const result = ehMaiorDeIdade(18)
      //aqui verifica se a escrita foi >= ou só > pois se for só > esse teste falha, importante verificar tanto menos quanto mais quanto a borda
      expect(result).toBe(true)
    })
  })
//
// -----------------------------------------------------------------------------
// DESAFIO 2 — `primeiroNome`
// -----------------------------------------------------------------------------
//   Crie a função `primeiroNome(nomeCompleto: string): string` que devolve
//   só o primeiro nome. Exemplo: "Maria da Silva" → "Maria".
//
//   Escreva 2 testes:
//     a) um nome completo com vários nomes → só o primeiro
//     b) um nome com uma palavra só ("Maria") → "Maria" mesmo
//
//   Dicas:
//     - Em JavaScript, `texto.split(" ")` quebra o texto em uma lista.
//       O primeiro item é o índice [0].

  function primeiroNome (nomeCompleto: string) {
        return nomeCompleto.split(' ')[0].trim()
  }


  describe('Testa a função primeiroNome', () => {
    it('retorna João de João da Silva Costa', () => {
      const result = primeiroNome('João da Silva Costa')
      expect(result).toBe('João')
    })
    it('retorna o próprio nome quando só tem uma palavra', () => {
      const result = primeiroNome('Maria')
      expect(result).toBe('Maria')
    })
    it('retorna o nome quando o nome começa com espaço', () => {
      const result = primeiroNome(' Maria José da Silva')
      expect(result).toBe('Maria')
    })
  })

