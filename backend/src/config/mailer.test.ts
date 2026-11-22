import { beforeEach, describe, expect, it, vi } from "vitest";

// O mailer cria o "transporter" do nodemailer no momento do import.
// Por isso o nodemailer é trocado por um falso ANTES do import do mailer:
// o vi.hoisted cria a função falsa lá no topo, junto com o vi.mock.
const { sendMailFalso } = vi.hoisted(() => ({ sendMailFalso: vi.fn() }));

vi.mock("nodemailer", () => ({
  default: {
    createTransport: () => ({ sendMail: sendMailFalso }),
  },
}));

import { sendMail } from "./mailer";
import { InternalServerError } from "../errors/app-error";

beforeEach(() => {
  vi.resetAllMocks();
});

describe("sendMail", () => {
  it("envia o e-mail com destinatário, assunto e corpo HTML", async () => {
    sendMailFalso.mockResolvedValue({ messageId: "1" });

    await sendMail("maria@email.com", "Recuperação de senha", "<p>Olá</p>");

    expect(sendMailFalso).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "maria@email.com",
        subject: "Recuperação de senha",
        html: "<p>Olá</p>",
      }),
    );
    expect(sendMailFalso).toHaveBeenCalledTimes(1);
  });

  it("troca qualquer falha do envio por InternalServerError com mensagem para o usuário", async () => {
    sendMailFalso.mockRejectedValue(new Error("Invalid login: 535 Username and Password not accepted"));

    const promise = sendMail("maria@email.com", "Assunto", "<p>Olá</p>");

    await expect(promise).rejects.toBeInstanceOf(InternalServerError);
    await expect(promise).rejects.toThrow("Falha ao enviar o email, tente novamente!");
  });
});
