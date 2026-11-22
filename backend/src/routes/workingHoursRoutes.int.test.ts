import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { api, autorizacao, criarAdmin, criarCliente } from "../../test-integration/api";
import { limparBanco, prismaClient } from "../../test-integration/database";

// Teste de API: requisições HTTP de verdade em /api/working-hours, até o banco de teste.

let cliente: Awaited<ReturnType<typeof criarCliente>>;
let admin: Awaited<ReturnType<typeof criarAdmin>>;

const segunda = {
  day: 1,
  start_time: "09:00",
  end_time: "19:00",
  break_start: "13:00",
  break_end: "14:00",
  isOpen: true,
};

beforeEach(async () => {
  await limparBanco();
  cliente = await criarCliente();
  admin = await criarAdmin();
  await prismaClient.workingHours.create({
    data: { dayOfWeek: 1, start_time: "08:00", end_time: "18:00", isOpen: true },
  });
});

afterAll(async () => {
  await prismaClient.$disconnect();
});

describe("PUT /api/working-hours", () => {
  it("o admin atualiza o expediente (200) e a mudança fica no banco", async () => {
    const res = await api()
      .put("/api/working-hours")
      .set("Authorization", autorizacao(admin))
      .send({ newData: [segunda] });

    expect(res.status).toBe(200);
    const noBanco = await prismaClient.workingHours.findFirst({ where: { dayOfWeek: 1 } });
    expect(noBanco).toMatchObject({ start_time: "09:00", break_start: "13:00" });
  });

  it("o cliente recebe 403 e nada muda", async () => {
    const res = await api()
      .put("/api/working-hours")
      .set("Authorization", autorizacao(cliente))
      .send({ newData: [segunda] });

    expect(res.status).toBe(403);
    const noBanco = await prismaClient.workingHours.findFirst({ where: { dayOfWeek: 1 } });
    expect(noBanco?.start_time).toBe("08:00");
  });

  it("responde 400 quando a pausa fica fora do expediente", async () => {
    const res = await api()
      .put("/api/working-hours")
      .set("Authorization", autorizacao(admin))
      .send({ newData: [{ ...segunda, break_start: "20:00", break_end: "21:00" }] });

    expect(res.status).toBe(400);
  });
});
