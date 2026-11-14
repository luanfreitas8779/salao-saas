import { describe, expect, it } from "vitest";

import { createProcedureSchema } from "./createProcedureSchema";
import { editProcedureSchema } from "./editProcedureSchema";
import { deleteProcedureSchema } from "./deleteProcedureSchema";

const ID_VALIDO = "3f1c9a52-8c4e-4f7a-9d2b-6a1e5c7b8d90";

const valido = {
  name: "Corte feminino",
  description: "Corte com lavagem",
  price: 8000, // em centavos
  duration_minutes: 60,
};

describe("createProcedureSchema", () => {
  it("aceita um procedimento válido", () => {
    expect(createProcedureSchema.safeParse({ body: valido }).success).toBe(true);
  });

  it("recusa preço decimal: o preço é guardado em centavos (inteiro)", () => {
    const resultado = createProcedureSchema.safeParse({
      body: { ...valido, price: 49.9 },
    });

    expect(resultado.success).toBe(false);
    expect(resultado.error?.issues[0]?.message).toBe("Formato inválido");
  });

  it("recusa preço enviado como texto", () => {
    const resultado = createProcedureSchema.safeParse({
      body: { ...valido, price: "8000" },
    });

    expect(resultado.error?.issues[0]?.message).toBe("O preço precisa ser um número");
  });

  it("recusa duração decimal", () => {
    expect(
      createProcedureSchema.safeParse({ body: { ...valido, duration_minutes: 30.5 } })
        .success,
    ).toBe(false);
  });

  // Regras que o schema ainda NÃO tem. Decida o que o negócio exige
  // e, se for o caso, corrija o schema e transforme em teste de verdade.
  it.todo("recusa nome vazio?");
  it.todo("recusa preço negativo? E zero?");
  it.todo("recusa duração zero ou negativa?");
});

describe("editProcedureSchema", () => {
  it("aceita id válido na URL e os campos no body", () => {
    expect(
      editProcedureSchema.safeParse({ params: { id: ID_VALIDO }, body: valido }).success,
    ).toBe(true);
  });

  it("recusa id que não é UUID", () => {
    expect(
      editProcedureSchema.safeParse({ params: { id: "123" }, body: valido }).success,
    ).toBe(false);
  });

  it("recusa preço decimal", () => {
    expect(
      editProcedureSchema.safeParse({
        params: { id: ID_VALIDO },
        body: { ...valido, price: 10.5 },
      }).success,
    ).toBe(false);
  });
});

describe("deleteProcedureSchema", () => {
  it.each([
    [ID_VALIDO, true],
    ["nao-e-uuid", false],
  ])("id %s → aceito = %s", (id, aceito) => {
    expect(deleteProcedureSchema.safeParse({ params: { id } }).success).toBe(aceito);
  });
});
