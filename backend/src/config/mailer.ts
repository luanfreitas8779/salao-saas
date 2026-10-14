import nodemailer from "nodemailer";
import { InternalServerError } from "../errors/app-error";

export const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export async function sendMail(to: string, subject: string, html: string) {
  try {
    await transporter.sendMail({
      from: `"Suporte" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    });
    return;
  } catch {
    throw new InternalServerError("Falha ao enviar o email, tente novamente!");
  }
}
