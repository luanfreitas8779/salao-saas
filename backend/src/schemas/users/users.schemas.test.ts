import { describe, expect, it } from "vitest";

import { authLoginSchema } from "./authLoginSchema";
import { createUserSchema } from "./userSchema";
import { recoveryPasswordSchema } from "./recoveryPasswordSchema";
import { resetPasswordSchema } from "./resetPasswordSchema";
import { updateProfileSchema } from "./updateProfileSchema";

// Os schemas validam o objeto { body, query, params } que o validateSchema
// monta. Por isso a entrada dos testes vem embrulhada em `body`.
// safeParse não lança erro: devolve { success, data } ou { success, error }.

function mensagens(resultado: { success: boolean; error?: { issues: { message: string }[] } }) {
  return resultado.error?.issues.map((issue) => issue.message) ?? [];
}

describe("authLoginSchema", () => {
  const valido = { email: "maria@email.com", password: "senha123" };

  it("aceita email e senha válidos", () => {
    expect(authLoginSchema.safeParse({ body: valido }).success).toBe(true);
  });

  it("recusa email sem @ com a mensagem do schema", () => {
    const resultado = authLoginSchema.safeParse({
      body: { ...valido, email: "maria.email.com" },
    });

    expect(resultado.success).toBe(false);
    expect(mensagens(resultado)).toContain("Digite um email válido!");
  });

  it.each([
    ["5 caracteres (um a menos que o mínimo)", "12345", false],
    ["6 caracteres (exatamente o mínimo)", "123456", true],
    ["7 caracteres (um a mais)", "1234567", true],
  ])("senha com %s → aceita = %s", (_caso, password, aceita) => {
    expect(
      authLoginSchema.safeParse({ body: { ...valido, password } }).success,
    ).toBe(aceita);
  });
});

describe("createUserSchema", () => {
  const valido = {
    name: "Maria da Silva",
    email: "maria@email.com",
    phone: "11999999999",
    password: "senha123",
  };

  it("aceita um cadastro válido", () => {
    expect(createUserSchema.safeParse({ body: valido }).success).toBe(true);
  });

  it("limpa o telefone, deixando só os dígitos", () => {
    const resultado = createUserSchema.safeParse({
      body: { ...valido, phone: "(11) 99999-9999" },
    });

    expect(resultado.data?.body.phone).toBe("11999999999");
  });

  it.each([
    ["9 dígitos (sem DDD completo)", "119999999", "O número deve conter DDD + 8 dígitos"],
    ["12 dígitos", "119999999999", "O número deve conter no máximo 11 dígitos"],
    ["só letras", "abcdefghijk", "O número deve conter DDD + 8 dígitos"],
  ])("recusa telefone com %s", (_caso, phone, mensagem) => {
    const resultado = createUserSchema.safeParse({ body: { ...valido, phone } });

    expect(resultado.success).toBe(false);
    expect(mensagens(resultado)).toContain(mensagem);
  });

  it("aceita telefone fixo com 10 dígitos (limite mínimo)", () => {
    expect(
      createUserSchema.safeParse({ body: { ...valido, phone: "1133334444" } }).success,
    ).toBe(true);
  });

  it("recusa nome com menos de 10 caracteres", () => {
    const resultado = createUserSchema.safeParse({ body: { ...valido, name: "Maria" } });

    expect(mensagens(resultado)).toContain("O nome precisa ter no mínimo 10 caracteres");
  });


  it("recusa nome formado só por espaços", () => {
    const resultado = createUserSchema.safeParse({
      body: { ...valido, name: "          "}
    });

    expect(mensagens(resultado)).toContain("O nome precisa ter no mínimo 10 caracteres")
  });

  it("recusa email inválido e senha curta, apontando os dois problemas", () => {
    const resultado = createUserSchema.safeParse({
      body: { ...valido, email: "maria", password: "123" },
    });

    expect(mensagens(resultado)).toEqual([
      "Precisa ser um email válido",
      "A senha deve ter no mínimo 6 caracteres",
    ]);
  });
});

describe("recoveryPasswordSchema", () => {
  it("aceita um email válido", () => {
    expect(
      recoveryPasswordSchema.safeParse({ body: { email: "maria@email.com" } }).success,
    ).toBe(true);
  });

  it("recusa email inválido com a mensagem do schema", () => {
    const resultado = recoveryPasswordSchema.safeParse({ body: { email: "maria" } });

    expect(mensagens(resultado)).toContain("Formato de email inválido");
  });
});

describe("resetPasswordSchema", () => {
  it("aceita o token na URL e a nova senha no body", () => {
    expect(
      resetPasswordSchema.safeParse({
        params: { token: "abc123" },
        body: { newPassword: "novaSenha" },
      }).success,
    ).toBe(true);
  });

  it("recusa nova senha com menos de 6 caracteres", () => {
    const resultado = resetPasswordSchema.safeParse({
      params: { token: "abc123" },
      body: { newPassword: "123" },
    });

    expect(mensagens(resultado)).toContain("A senha deve ter no mínimo 6 caracteres");
  });
});

describe("updateProfileSchema", () => {
  it("aceita só o telefone, já limpo", () => {
    const resultado = updateProfileSchema.safeParse({
      body: { phone: "(11) 98888-7777" },
    });

    expect(resultado.data?.body).toEqual({ phone: "11988887777" });
  });

  it("aceita só a senha", () => {
    expect(
      updateProfileSchema.safeParse({ body: { password: "novaSenha" } }).success,
    ).toBe(true);
  });

  it("recusa o body vazio, sem telefone nem senha", () => {
    const resultado = updateProfileSchema.safeParse({ body: {} });

    expect(mensagens(resultado)).toContain("Informe telefone e/ou senha para atualizar");
  });
});
