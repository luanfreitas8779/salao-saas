import nodemailer from "nodemailer";
import { InternalServerError } from "../errors/app-error";
import { env } from "../schemas/validateEnvSchema";

export const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: env.EMAIL_USER,
    pass: env.EMAIL_PASS,
  },
});

export async function sendMail(to: string, subject: string, html: string) {
  try {
    await transporter.sendMail({
      from: `"Suporte" <${env.EMAIL_USER}>`,
      to,
      subject,
      html,
    });
    return;
  } catch {
    throw new InternalServerError("Falha ao enviar o email, tente novamente!");
  }
}
