import "dotenv/config";
import { z } from "zod";
import { BadRequestError } from "../errors/app-error";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().int().min(1).default(3333),
  EMAIL_USER: z.string().min(1),
  EMAIL_PASS: z.string().min(1),
  JWT_SECRET: z.string().min(1),
});

const parseEnv = envSchema.safeParse(process.env);

if (!parseEnv.success) {
  console.error("Erro na validação das variáveis de ambiente:", parseEnv.error.format());
  throw new BadRequestError("TA FALTANDO VARIAVEL!");
}

export const env = parseEnv.data;
