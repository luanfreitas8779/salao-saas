// =============================================================================
// DEGRAU 5 — TESTANDO UM CONTROLLER (o mais simples do projeto)
// =============================================================================
//
// Alvo: src/app/procedures/procedure.controller.ts
//
// Rodar:   npx vitest run estudo-testes/05
//
// -----------------------------------------------------------------------------
// PASSO 1 — O que é um controller? (3 tarefas, só isso)
// -----------------------------------------------------------------------------
//
// Abra o `procedure.controller.ts` e olhe o método mais curto:
//
//     findActiveProcedures = async (_: Request, res: Response) => {
//       const findActiveProcedures = await this.service.findActiveProcedures();
//       res.status(200).json({ findActiveProcedures });
//     };
//
// Ele faz exatamente 3 coisas:
//
//     1. LÊ o que chegou na requisição        (req.body, req.params...)
//     2. CHAMA o service                      (a regra de negócio mora lá)
//     3. RESPONDE com status + JSON           (res.status(200).json(...))
//
// Não tem regra. Não tem `if`. Não tem banco. Por isso o teste dele é
// tranquilo — e é um bom primeiro contato.
//
// O QUE ESTAMOS TESTANDO AQUI, em uma frase:
//   "O controller entrega ao service o que veio na requisição, e devolve
//    na resposta o que o service retornou, com o status certo."
//
// -----------------------------------------------------------------------------
// PASSO 2 — O problema: como chamar um controller sem servidor?
// -----------------------------------------------------------------------------
//
// O controller espera dois objetos do Express: `req` (a requisição) e `res`
// (a resposta). Para testar "de verdade" eu teria que: subir o servidor,
// ligar o banco, fazer login, pegar um token, mandar uma requisição...
// Só para testar 3 linhas!
//
// Mas pensa comigo: o controller só USA um pedacinho do `req` e do `res`.
// Então a gente fabrica `req` e `res` de mentira, só com o que ele precisa:
//
//     req = { body: {...}, params: {...} }          ← objeto comum
//     res = { status: função falsa, json: função falsa }
//
// É o mesmo truque do dublê do degrau 3.
//
import { describe, it, expect, vi } from "vitest";
import type { Request, Response } from "express";

import { ProcedureController } from "../src/app/procedures/procedure.controller";
import type { ProcedureService } from "../src/app/procedures/procedure.service";

// `import type` = importo só o "formato" (para o TypeScript). Assim o teste
// NÃO carrega o Prisma nem conecta no banco. Tudo fica rápido e isolado.

// -----------------------------------------------------------------------------
// PASSO 3 — O truque do `res`: por que `status` precisa devolver o `res`
// -----------------------------------------------------------------------------
//
// Olhe como o controller responde:
//
//     res.status(200).json({ ... })
//         └────┬────┘ └──┬──┘
//              │         └─ 2º: chama .json no que o status devolveu
//              └─ 1º: status(200) devolve o próprio `res`
//
// É um "encadeamento". Para o `res` falso funcionar, o `status` falso
// também precisa devolver o `res` — senão, na hora do `.json`, estoura
// "Cannot read properties of undefined".
//
// A ferramenta para isso é `vi.fn().mockReturnThis()`:
//   "quando chamarem esta função, devolva o objeto em que ela foi chamada".
//   Como foi chamada em `res.status(...)`, ela devolve o `res`.
//
// -----------------------------------------------------------------------------
// PASSO 4 — Montar o cenário (uma função para não repetir)
// -----------------------------------------------------------------------------
//
// Em todo teste de controller eu preciso de 3 coisas:
//    - um service falso    (para eu mandar o que ele responde)
//    - o controller real   (entregando o service falso)
//    - um `res` falso      (para conferir o que foi respondido)
//
// Vou colocar isso numa função. IMPORTANTE: ela cria tudo NOVO a cada
// chamada. Assim, cada teste começa limpo, sem `beforeEach` nem reset.
function montarCenario() {
  // Service falso: só os métodos que os testes deste arquivo usam.
  const service = {
    findActiveProcedures: vi.fn(),
    createProcedure: vi.fn(),
    deleteProcedure: vi.fn(),
  };

  // O controller de verdade, recebendo o service falso pelo construtor.
  // (`as unknown as ProcedureService` = "confia, é um service". O TypeScript
  // reclamaria que faltam métodos; em teste a gente cala ele assim.)
  const controller = new ProcedureController(
    service as unknown as ProcedureService,
  );

  // Response falsa: `status` devolve o próprio `res` (encadeamento) e
  // `json` é só uma espiã que anota o que recebeu.
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  };

  return { service, controller, res };
}

// =============================================================================
// TESTE 1 — o mais simples: sem entrada, só resposta
// =============================================================================
describe("ProcedureController.findActiveProcedures  (GET /procedures)", () => {
  it("responde 200 com a lista de procedimentos ativos", async () => {
    // ----- ARRANGE (preparar) -----
    const { service, controller, res } = montarCenario();

    // Programo o que o service falso responde: uma lista com 1 item.
    const lista = [{ id: "1", name: "Corte", price: 5000 }];
    service.findActiveProcedures.mockResolvedValue(lista);

    // O método ignora o `req` (veja o `_` no código dele), então mando um
    // objeto vazio. O `as unknown as Request` é só para o TypeScript aceitar.
    const req = {} as unknown as Request;

    // ----- ACT (agir) -----
    // Chamo o método do controller de verdade, com req e res falsos.
    await controller.findActiveProcedures(req, res as unknown as Response);

    // ----- ASSERT (conferir) -----
    // 1) Respondeu com o status 200?
    expect(res.status).toHaveBeenCalledWith(200);

    // 2) Respondeu com o JSON certo? Repare no formato: o controller embrulha
    //    a lista num objeto com a chave `findActiveProcedures`.
    expect(res.json).toHaveBeenCalledWith({ findActiveProcedures: lista });
  });
});

// -----------------------------------------------------------------------------
// FAÇA VOCÊ #1 — conferindo que o teste de fato protege
// -----------------------------------------------------------------------------
// Abra procedure.controller.ts e, em `findActiveProcedures`, troque
// `res.status(200)` por `res.status(201)`. Rode este arquivo.
// → O teste fica vermelho. Leia a mensagem:
//       expected "vi.fn()" to be called with arguments: [ 200 ]
//   Traduzindo: "eu esperava que o `status` fosse chamado com 200, e não foi".
//   (Logo abaixo ela mostra com o que ele FOI chamado: 201.)
// Desfaça.
// É assim que você sabe que o teste vigia aquele status.

// =============================================================================
// TESTE 2 — entrada vinda do corpo (req.body) e status 201
// =============================================================================
// Aqui o controller LÊ algo do `req` e passa para o service. O teste agora
// confere a "entrega" — que o service recebeu exatamente o que chegou.
describe("ProcedureController.createNewProcedure  (POST /procedures)", () => {
  it("entrega o corpo da requisição ao service e responde 201", async () => {
    const { service, controller, res } = montarCenario();

    // O que "chega" do cliente. Eu fabrico o req só com o `body`.
    const req = {
      body: {
        name: "Corte",
        description: "Corte feminino",
        price: 5000,
        duration_minutes: 60,
      },
    } as unknown as Request;

    // O que o service "devolve" depois de criar.
    const criado = { id: "1", name: "Corte" };
    service.createProcedure.mockResolvedValue(criado);

    await controller.createNewProcedure(req, res as unknown as Response);

    // 1) O service recebeu os 4 campos, do jeitinho certo? (Esta é a
    //    principal função do controller: repassar direito.)
    expect(service.createProcedure).toHaveBeenCalledWith({
      name: "Corte",
      description: "Corte feminino",
      price: 5000,
      duration_minutes: 60,
    });

    // 2) Criação responde 201 (e não 200!).
    expect(res.status).toHaveBeenCalledWith(201);

    // 3) E devolve o que o service retornou, embrulhado na chave certa.
    expect(res.json).toHaveBeenCalledWith({ createNewProcedure: criado });
  });
});

// -----------------------------------------------------------------------------
// FAÇA VOCÊ #2 — descubra um bug de "entrega"
// -----------------------------------------------------------------------------
// Em createNewProcedure, troque `price: price` por `price: duration_minutes`
// (um erro de digitação, daqueles que acontecem). Rode.
// → Este teste fica vermelho e mostra exatamente qual campo veio errado.
// Teste manual no Postman talvez demorasse a notar! Desfaça.

// =============================================================================
// TESTE 3 — entrada vinda da URL (req.params)
// =============================================================================
// Na rota `DELETE /procedures/:id`, o `id` vem da URL, não do corpo.
// Por isso o req falso tem `params`, em vez de `body`.
describe("ProcedureController.deleteProcedure  (DELETE /procedures/:id)", () => {
  it("usa o id da URL e responde 200", async () => {
    const { service, controller, res } = montarCenario();

    const req = { params: { id: "abc-123" } } as unknown as Request;
    service.deleteProcedure.mockResolvedValue({ id: "abc-123" });

    await controller.deleteProcedure(req, res as unknown as Response);

    // O service recebeu o id certo?
    expect(service.deleteProcedure).toHaveBeenCalledWith({ id: "abc-123" });
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

// =============================================================================
// TESTE 4 — e quando o service dá erro?
// =============================================================================
// Olhe de novo o controller: NÃO tem `try/catch`. Isso é proposital, e o
// teste abaixo documenta essa decisão:
//
//   O controller deixa o erro "subir". O Express 5 pega esse erro e manda
//   para o handler global (server.ts), que responde 401, 409, 500...
//   Quem decide o status do erro NÃO é o controller.
//
// Então o que esperamos: o erro do service aparece (rejeita), e o controller
// NÃO responde nada sozinho (não chama res.status nem res.json).
describe("quando o service lança erro", () => {
  it("deixa o erro subir e não responde sozinho", async () => {
    const { service, controller, res } = montarCenario();

    // `mockRejectedValue` = "quando chamarem, DÊ ERRO". (Degrau 4!)
    service.findActiveProcedures.mockRejectedValue(new Error("falha"));

    const req = {} as unknown as Request;

    // Lembra: `await expect(chamada).rejects...` — com await, sempre.
    await expect(
      controller.findActiveProcedures(req, res as unknown as Response),
    ).rejects.toThrow("falha");

    // E o `res` ficou intocado:
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });
});

// -----------------------------------------------------------------------------
// FAÇA VOCÊ #3 — escreva um teste sozinho
// -----------------------------------------------------------------------------
// Ainda não testamos `editProcedure` (PUT /procedures/:id). Ele usa os DOIS:
// `req.params.id` e `req.body`. Escreva um teste que confira:
//   - o service.editProcedure recebeu { id, name, description, price,
//     duration_minutes } com os valores certos;
//   - res.status foi chamado com 200;
//   - res.json recebeu { editProcedure: <o que o service devolveu> }.
//
// Dica: copie a estrutura do TESTE 2 e junte o `params` do TESTE 3.
// Lembre de adicionar `editProcedure: vi.fn()` no service de `montarCenario`.
//
// -----------------------------------------------------------------------------
// FECHAMENTO — o que um teste de controller garante (e o que NÃO garante)
// -----------------------------------------------------------------------------
//
//   ✔ O controller repassa ao service o que veio no req (body/params).
//   ✔ Responde com o status certo (200, 201...).
//   ✔ Devolve no JSON o que o service retornou, na chave certa.
//   ✔ Não "engole" erros (deixa subir para o handler global).
//
//   ✘ NÃO testa se a rota existe, nem a URL (isso é teste de rota/HTTP).
//   ✘ NÃO testa validação Zod nem login/permissão (são middlewares).
//   ✘ NÃO testa regra de negócio (isso é o teste do service).
//
// Cada camada tem o seu teste. O controller é o mais simples porque ele
// é só um "carteiro": pega do req, entrega ao service, devolve no res.
//
// Próximo: `src/app/user/user.service.test.ts` — o teste do service, onde
// moram as regras. Com o que você viu nos degraus 1 a 5, você já lê tudo.
// (Faça os desafios aqui embaixo antes.)

// =============================================================================
// 🏆 DESAFIOS DO DEGRAU 5 — agora é com você
// =============================================================================
//
// Regras do jogo:
//   - Use `montarCenario()` (acima) em cada teste.
//   - Adicione ao `service` falso, dentro de `montarCenario`, os métodos
//     novos que você precisar (ex.: `findAllProcedures: vi.fn()`).
//   - Troque cada `it.todo(...)` por um `it(...)`.
//   - Abra o `procedure.controller.ts` e LEIA o método antes de testar:
//     veja de onde vem cada entrada (`req.body`? `req.params`?) e qual a
//     chave do JSON de resposta.
//
// -----------------------------------------------------------------------------
// DESAFIO 1 — `findAllProcedures`  (GET /procedures/all)
// -----------------------------------------------------------------------------
//   Escreva um teste que confira:
//     a) o service foi chamado;
//     b) `res.status` foi chamado com 200;
//     c) `res.json` recebeu `{ findAllProcedures: <lista que o service deu> }`.
//
//   Parece com o TESTE 1, não é? Boa! A diferença é só a chave do JSON.
//   Ler o controller antes é o que evita errar essa chave.
//
// -----------------------------------------------------------------------------
// DESAFIO 2 — `editProcedure`  (PUT /procedures/:id)  + o caso de erro
// -----------------------------------------------------------------------------
//   Este método usa os DOIS: `req.params.id` (URL) e `req.body` (corpo).
//   Escreva 2 testes:
//
//     a) caminho feliz:
//          - `req` com `params: { id: ... }` E `body: { ... 4 campos ... }`;
//          - o service recebeu `{ id, name, description, price,
//            duration_minutes }`;
//          - respondeu 200 com `{ editProcedure: <retorno do service> }`.
//
//     b) erro: o service rejeita (use `mockRejectedValue`). Confira que o
//        erro sobe e que `res.status` e `res.json` NÃO foram chamados.
//
//   Dica: junte o `params` do TESTE 3 com o `body` do TESTE 2.
//   (O "FAÇA VOCÊ #3" acima é a versão guiada do item (a); aqui você faz
//   completo, com o erro.)
describe("DESAFIOS do degrau 5", () => {
  it.todo("DESAFIO 1: findAllProcedures responde 200 com a chave certa");
  it.todo("DESAFIO 2a: editProcedure usa params + body e responde 200");
  it.todo("DESAFIO 2b: editProcedure deixa o erro subir sem responder");
});
