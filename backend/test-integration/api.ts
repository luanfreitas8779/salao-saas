import request from "supertest";
import { sign } from "jsonwebtoken";

import { app } from "../src/app";
import { criarUsuario } from "./database";

// Ferramentas dos testes de API: requisições HTTP de verdade no app Express,
// passando por rota, middlewares, controller, service, repository e banco de teste.

// supertest faz a requisição direto no app, sem abrir uma porta
export const api = () => request(app);

// Gera o token como o login gera (mesmo segredo, mesmo formato), sem passar pela
// rota de login. Assim os testes das outras rotas não gastam o limite de
// tentativas de login (rate limiter).
export function tokenPara(usuario: { id: string; role: string }) {
  return sign({ role: usuario.role }, process.env.JWT_SECRET as string, {
    subject: usuario.id,
    expiresIn: "1h",
  });
}

export function autorizacao(usuario: { id: string; role: string }) {
  return `Bearer ${tokenPara(usuario)}`;
}

export async function criarCliente() {
  return criarUsuario({ role: "CLIENT" });
}

export async function criarAdmin() {
  return criarUsuario({ role: "ADMIN" });
}
