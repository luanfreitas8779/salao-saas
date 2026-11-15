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

  it("recusa nome vazio", () =>{
    expect(createProcedureSchema.safeParse({
      body: {
        ...valido,
        name: ""
      }
    }).success).toBe(false)
  });

  // sem o trim, "      " e "  ab  " passariam no .min(3), porque os espaços contam
  it.each([
    {name: "      ", caso: "só espaços"},
    {name: "  ab  ", caso: "2 letras cercadas de espaços"},
  ])("recusa nome com $caso, pois os espaços não contam para o mínimo", ({name}) => {
    expect(createProcedureSchema.safeParse({
      body: {
        ...valido,
        name
      }
    }).success).toBe(false)
  });

  it("remove os espaços do começo e do fim do nome", () => {
    const resultado = createProcedureSchema.safeParse({
      body: {
        ...valido,
        name: "  Corte feminino  "
      }
    });

    expect(resultado.data?.body.name).toBe("Corte feminino")
  });

  it.each([
    {price: -100, success: false},
    {price: 0, success: false},
    {price: 499, success: false}
  ])("recusa preço $price", ({price, success}) => {
    
    expect(createProcedureSchema.safeParse({
      body: {
        ...valido,
        price: price
      }
    }).success).toBe(success)
  });

  it("Aceita o preço mínimo definido de 500 centavos", () => {
    expect(createProcedureSchema.safeParse({
      body: {
        ...valido,
        price: 500
      }
    }).success).toBe(true)
  })

  it.each([
    {duration_minutes: 0, success: false},
    {duration_minutes: -10, success: false}
  ])("recusa duração $duration_minutes", ({duration_minutes, success}) => {
    expect(createProcedureSchema.safeParse({
      body: {
        ...valido,
        duration_minutes
      }
    }).success).toBe(success)

  });

  it("Aceita a duração mínima de 1 minuto", () => {
    expect(createProcedureSchema.safeParse({
      body: {
        ...valido,
        duration_minutes: 1
      }
    }).success).toBe(true)
  })

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

  it("recusa nome vazio", () => {
    expect(editProcedureSchema.safeParse({
      params: { id: ID_VALIDO },
      body: {
        ...valido,
        name: ""
      }
    }).success).toBe(false)
  });

  // sem o trim, "      " e "  ab  " passariam no .min(3), porque os espaços contam
  it.each([
    {name: "      ", caso: "só espaços"},
    {name: "  ab  ", caso: "2 letras cercadas de espaços"},
  ])("recusa nome com $caso, pois os espaços não contam para o mínimo", ({name}) => {
    expect(editProcedureSchema.safeParse({
      params: { id: ID_VALIDO },
      body: {
        ...valido,
        name
      }
    }).success).toBe(false)
  });

  it("remove os espaços do começo e do fim do nome", () => {
    const resultado = editProcedureSchema.safeParse({
      params: { id: ID_VALIDO },
      body: {
        ...valido,
        name: "  Corte feminino  "
      }
    });

    expect(resultado.data?.body.name).toBe("Corte feminino")
  });

  it.each([
    {price: -100, success: false},
    {price: 0, success: false},
    {price: 499, success: false}
  ])("recusa preço $price", ({price, success}) => {
    expect(editProcedureSchema.safeParse({
      params: { id: ID_VALIDO },
      body: {
        ...valido,
        price: price
      }
    }).success).toBe(success)
  });

  it("Aceita o preço mínimo definido de 500 centavos", () => {
    expect(editProcedureSchema.safeParse({
      params: { id: ID_VALIDO },
      body: {
        ...valido,
        price: 500
      }
    }).success).toBe(true)
  });

  it.each([
    {duration_minutes: 0, success: false},
    {duration_minutes: -10, success: false}
  ])("recusa duração $duration_minutes", ({duration_minutes, success}) => {
    expect(editProcedureSchema.safeParse({
      params: { id: ID_VALIDO },
      body: {
        ...valido,
        duration_minutes
      }
    }).success).toBe(success)
  });

  it("Aceita a duração mínima de 1 minuto", () => {
    expect(editProcedureSchema.safeParse({
      params: { id: ID_VALIDO },
      body: {
        ...valido,
        duration_minutes: 1
      }
    }).success).toBe(true)
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
