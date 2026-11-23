import { z, ZodObject, ZodType } from "zod";

import { authLoginSchema } from "../schemas/users/authLoginSchema";
import { createUserSchema } from "../schemas/users/userSchema";
import { recoveryPasswordSchema } from "../schemas/users/recoveryPasswordSchema";
import { resetPasswordSchema } from "../schemas/users/resetPasswordSchema";
import { updateProfileSchema } from "../schemas/users/updateProfileSchema";
import { searchClientsSchema } from "../schemas/users/searchClientsSchema";
import { createProcedureSchema } from "../schemas/procedures/createProcedureSchema";
import { editProcedureSchema } from "../schemas/procedures/editProcedureSchema";
import { deleteProcedureSchema } from "../schemas/procedures/deleteProcedureSchema";
import { workingHoursSchema } from "../schemas/workingHours/workingHoursSchema";
import { newScheduleBlockSchema } from "../schemas/scheduleBlocks/createScheduleBlockSchema";
import { listScheduleBlocksSchema } from "../schemas/scheduleBlocks/listScheduleBlocksSchema";
import { updateScheduleBlockSchema } from "../schemas/scheduleBlocks/updateScheduleBlockSchema";
import { scheduleBlockIdParamSchema } from "../schemas/scheduleBlocks/scheduleBlockIdParamSchema";
import { appointmentAvailabilitySchema } from "../schemas/appointments/appointmentAvailabilitySchema";
import { createAppointmentSchema } from "../schemas/appointments/createAppointmentSchema";
import { appointmentBoardSchema } from "../schemas/appointments/appointmentBoardSchema";
import { appointmentIdParamSchema } from "../schemas/appointments/appointmentIdParamSchema";
import { updateAppointmentSchema } from "../schemas/appointments/updateAppointmentSchema";
import { listMyAppointmentsSchema } from "../schemas/appointments/listMyAppointmentsSchema";

//Documentação OpenAPI (Swagger) da API.
//O corpo, a query e os parâmetros de rota de cada operação são gerados a partir dos
//MESMOS schemas do Zod que as rotas usam no validateSchema: se uma regra de validação
//mudar, a documentação muda junto. As respostas são descritas à mão logo abaixo.
//O openapi.test.ts compara este documento com as rotas reais do Express.

type JsonSchema = Record<string, unknown>;

interface Parameter {
  name: string;
  in: "query" | "path";
  required: boolean;
  schema: JsonSchema;
}

interface Operation {
  tags: string[];
  summary: string;
  description?: string;
  security?: { bearerAuth: string[] }[];
  parameters?: Parameter[];
  requestBody?: { required: boolean; content: Record<string, { schema: JsonSchema }> };
  responses: Record<
    string,
    { description: string; content?: Record<string, { schema: JsonSchema }>; headers?: Record<string, JsonSchema> }
  >;
}

//------------------------------------------------------------------------------
// Conversão dos schemas do Zod
//------------------------------------------------------------------------------

//io: "input" descreve o que o cliente ENVIA. Ex.: o telefone entra como texto com
//máscara e o Zod o transforma; para quem chama a API, o campo é uma string.
//Os refine (regras entre campos) não têm equivalente em JSON Schema e ficam de fora:
//por isso as operações que dependem deles explicam a regra na descrição.
function toJsonSchema(schema: ZodType): JsonSchema {
  const { $schema: _, ...jsonSchema } = z.toJSONSchema(schema, {
    io: "input",
    unrepresentable: "any",
  }) as JsonSchema;
  return jsonSchema;
}

//Os schemas do projeto validam { body, query, params } (ver o validateSchema).
//Aqui cada parte vira o pedaço correspondente da operação OpenAPI.
function fromRequestSchema(requestSchema: ZodObject) {
  const { body, query, params } = requestSchema.shape as Record<string, ZodType | undefined>;

  const parameters: Parameter[] = [
    ...toParameters(params, "path"),
    ...toParameters(query, "query"),
  ];

  return {
    ...(parameters.length > 0 ? { parameters } : {}),
    ...(body
      ? {
          requestBody: {
            required: true,
            content: { "application/json": { schema: toJsonSchema(body) } },
          },
        }
      : {}),
  };
}

function toParameters(schema: ZodType | undefined, location: "query" | "path"): Parameter[] {
  if (!schema) {
    return [];
  }

  const jsonSchema = toJsonSchema(schema) as {
    properties?: Record<string, JsonSchema>;
    required?: string[];
  };

  return Object.entries(jsonSchema.properties ?? {}).map(([name, propertySchema]) => ({
    name,
    in: location,
    required: location === "path" || (jsonSchema.required ?? []).includes(name),
    schema: propertySchema,
  }));
}

//------------------------------------------------------------------------------
// Respostas
//------------------------------------------------------------------------------

const ref = (name: string): JsonSchema => ({ $ref: `#/components/schemas/${name}` });
const listOf = (name: string): JsonSchema => ({ type: "array", items: ref(name) });

function json(description: string, schema: JsonSchema, headers?: Record<string, JsonSchema>) {
  return { description, content: { "application/json": { schema } }, ...(headers ? { headers } : {}) };
}

const errorResponses = {
  400: json("Entrada inválida (os details dizem qual campo) ou regra de negócio violada", ref("ValidationError")),
  401: json(
    "Sem token, token inválido ou expirado, ou token revogado por um login mais novo " +
      "ou por uma troca de senha (\"Sessão encerrada, faça login novamente\")",
    ref("Error"),
  ),
  403: json(
    "Usuário sem permissão para esta operação, ou que ainda precisa trocar a senha inicial " +
      "(\"Troque a senha antes de continuar\")",
    ref("Error"),
  ),
  404: json("Recurso não encontrado", ref("Error")),
  409: json("Conflito com um dado existente", ref("Error")),
  429: json("Muitas tentativas: aguarde e tente de novo", ref("Error")),
};

type HttpMethod = "get" | "post" | "put" | "patch" | "delete";
type Paths = Record<string, Partial<Record<HttpMethod, Operation>>>;

//Só para dar o tipo genérico ao objeto de rotas, sem perder a checagem de cada operação
function definePaths(paths: Paths): Paths {
  return paths;
}

type Access = "public" | "user" | "prof";

interface OperationOptions {
  tag: string;
  summary: string;
  description?: string;
  access: Access;
  request?: ZodObject;
  success: [status: number, response: ReturnType<typeof json>];
  errors?: (keyof typeof errorResponses)[];
}

function operation({ tag, summary, description, access, request, success, errors = [] }: OperationOptions): Operation {
  //quem exige login pode receber 401; quem é só do profissional (PROF) pode receber 403
  const accessErrors: (keyof typeof errorResponses)[] =
    access === "prof" ? [401, 403] : access === "user" ? [401] : [];
  const allErrors = [...new Set([...(request ? [400 as const] : []), ...accessErrors, ...errors])];

  return {
    tags: [tag],
    summary,
    ...(description ? { description } : {}),
    ...(access !== "public" ? { security: [{ bearerAuth: [] }] } : {}),
    ...(request ? fromRequestSchema(request) : {}),
    responses: {
      [success[0]]: success[1],
      ...Object.fromEntries(allErrors.sort().map((status) => [status, errorResponses[status]])),
    },
  };
}

//------------------------------------------------------------------------------
// Documento
//------------------------------------------------------------------------------

export const openApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "Salão Regina — API de agendamento",
    version: "1.0.0",
    description:
      "API REST de agendamento de um salão com profissional único.\n\n" +
      "- **Autenticação:** `Authorization: Bearer <token>`, com o token devolvido pelo `POST /api/auth/login`.\n" +
      "- **Um token ativo por usuário:** um login novo revoga o token anterior (um aparelho por vez); trocar a senha também revoga.\n" +
      "- **Primeiro acesso do profissional:** com `must_change_password: true`, toda rota autenticada responde 403, exceto `PATCH /api/users/profile` (troca de senha).\n" +
      "- **Respostas de sucesso:** o corpo é o próprio dado (objeto ou lista). Mensagens vêm em `{ message }`.\n" +
      "- **Erros:** `{ message }`; na validação, `{ message, details: [{ campo, message }] }`.\n" +
      "- **Datas e horários:** instantes em ISO 8601 (UTC). O salão funciona em UTC-3: 09:00 no salão = 12:00Z.\n" +
      "- **Preços:** inteiros, em centavos (R$ 80,00 = 8000).",
  },
  tags: [
    { name: "Autenticação" },
    { name: "Usuários" },
    { name: "Procedimentos" },
    { name: "Horário de funcionamento" },
    { name: "Bloqueios de agenda" },
    { name: "Agendamentos" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
    },
    schemas: {
      Error: {
        type: "object",
        properties: { message: { type: "string" } },
        required: ["message"],
      },
      ValidationError: {
        type: "object",
        properties: {
          message: { type: "string", examples: ["Erro de validação"] },
          details: {
            type: "array",
            items: {
              type: "object",
              properties: { campo: { type: "string" }, message: { type: "string" } },
            },
          },
        },
        required: ["message"],
      },
      Message: {
        type: "object",
        properties: { message: { type: "string" } },
        required: ["message"],
      },
      User: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string" },
          email: { type: "string", format: "email" },
          phone: { type: "string", examples: ["11999999999"] },
          role: { type: "string", enum: ["CLIENT", "PROF"] },
          must_change_password: { type: "boolean", description: "true: a senha inicial ainda precisa ser trocada" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      ClientSummary: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string" },
          email: { type: "string", format: "email" },
          phone: { type: "string" },
        },
      },
      Login: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string" },
          role: { type: "string", enum: ["CLIENT", "PROF"] },
          must_change_password: {
            type: "boolean",
            description: "true no primeiro acesso do profissional: mande a pessoa trocar a senha antes de qualquer outra coisa",
          },
          token: {
            type: "string",
            description: "JWT válido por 30 dias. Um login novo ou uma troca de senha revoga este token",
          },
        },
      },
      Procedure: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string" },
          description: { type: "string" },
          price: { type: "integer", description: "Em centavos", examples: [8000] },
          duration_minutes: { type: "integer", examples: [60] },
          is_active: { type: "boolean" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      WorkingDay: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          dayOfWeek: { type: "integer", minimum: 0, maximum: 6, description: "0 = domingo" },
          start_time: { type: "string", examples: ["08:00"] },
          end_time: { type: "string", examples: ["18:00"] },
          break_start: { type: ["string", "null"], examples: ["12:00"] },
          break_end: { type: ["string", "null"], examples: ["13:00"] },
          isOpen: { type: "boolean" },
        },
      },
      ScheduleBlock: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          start_time: { type: "string", format: "date-time" },
          end_time: { type: "string", format: "date-time" },
          reason: { type: ["string", "null"] },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      Appointment: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          client_id: { type: "string", format: "uuid" },
          procedure_id: { type: "string", format: "uuid" },
          start_time: { type: "string", format: "date-time" },
          end_time: { type: "string", format: "date-time" },
          observation: { type: ["string", "null"] },
          status: { type: "string", enum: ["SCHEDULED", "CANCELLED", "COMPLETED"] },
          createdAt: { type: "string", format: "date-time" },
          procedure: {
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              duration_minutes: { type: "integer" },
              price: { type: "integer" },
            },
          },
          client: ref("ClientSummary"),
        },
      },
    },
  },
  paths: definePaths({
    //---------------------------------------------------------------- Autenticação
    "/api/auth/register": {
      post: operation({
        tag: "Autenticação",
        summary: "Cadastra um cliente",
        description: "Todo cadastro vira CLIENT. O telefone pode vir com máscara: é salvo só com os dígitos.",
        access: "public",
        request: createUserSchema,
        success: [201, json("Usuário criado (sem o hash da senha)", ref("User"))],
        errors: [409],
      }),
    },
    "/api/auth/login": {
      post: operation({
        tag: "Autenticação",
        summary: "Faz login e devolve o token",
        description: "Limite: 5 tentativas a cada 15 minutos. Revoga o token de um login anterior do mesmo usuário.",
        access: "public",
        request: authLoginSchema,
        success: [200, json("Login feito", ref("Login"))],
        errors: [401, 429],
      }),
    },
    "/api/auth/recover": {
      post: operation({
        tag: "Autenticação",
        summary: "Pede o e-mail de recuperação de senha",
        description:
          "A resposta é a mesma exista ou não o e-mail (não revela quem é cliente). " +
          "O link enviado abre FRONTEND_URL/reset-password/<token> e vale por 15 minutos. " +
          "Limite: 3 pedidos por hora.",
        access: "public",
        request: recoveryPasswordSchema,
        success: [200, json("Pedido recebido", ref("Message"))],
        errors: [429],
      }),
    },
    "/api/auth/reset-password/{token}": {
      post: operation({
        tag: "Autenticação",
        summary: "Troca a senha usando o token do e-mail",
        description: "O token só vale uma vez e dentro dos 15 minutos. Revoga o token de quem estava logado.",
        access: "public",
        request: resetPasswordSchema,
        success: [200, json("Senha alterada", ref("Message"))],
      }),
    },

    //---------------------------------------------------------------- Usuários
    "/api/users": {
      get: operation({
        tag: "Usuários",
        summary: "Busca clientes (para o profissional agendar no balcão)",
        description: "Procura no nome, e-mail ou telefone, sem diferenciar maiúsculas. Até 20 resultados; nunca traz profissionais.",
        access: "prof",
        request: searchClientsSchema,
        success: [200, json("Clientes encontrados", listOf("ClientSummary"))],
      }),
    },
    "/api/users/profile": {
      get: operation({
        tag: "Usuários",
        summary: "Dados de quem está logado",
        access: "user",
        success: [200, json("Perfil", ref("User"))],
        errors: [404],
      }),
      patch: operation({
        tag: "Usuários",
        summary: "Atualiza o telefone e/ou a senha de quem está logado",
        description:
          "Informe ao menos um dos dois campos. É a única rota liberada no primeiro acesso, para a troca da senha inicial. " +
          "Trocar a senha revoga o token atual: faça login de novo com a senha nova.",
        access: "user",
        request: updateProfileSchema,
        success: [200, json("Perfil atualizado", ref("User"))],
        errors: [409],
      }),
    },

    //---------------------------------------------------------------- Procedimentos
    "/api/procedures": {
      get: operation({
        tag: "Procedimentos",
        summary: "Lista os procedimentos ativos",
        access: "public",
        success: [200, json("Procedimentos ativos", listOf("Procedure"))],
      }),
      post: operation({
        tag: "Procedimentos",
        summary: "Cria um procedimento",
        access: "prof",
        request: createProcedureSchema,
        success: [201, json("Procedimento criado", ref("Procedure"))],
        errors: [409],
      }),
    },
    "/api/procedures/all": {
      get: operation({
        tag: "Procedimentos",
        summary: "Lista todos os procedimentos, inclusive os inativos",
        access: "prof",
        success: [200, json("Todos os procedimentos", listOf("Procedure"))],
      }),
    },
    "/api/procedures/{id}": {
      put: operation({
        tag: "Procedimentos",
        summary: "Edita um procedimento",
        access: "prof",
        request: editProcedureSchema,
        success: [200, json("Procedimento atualizado", ref("Procedure"))],
        errors: [404, 409],
      }),
      delete: operation({
        tag: "Procedimentos",
        summary: "Desativa um procedimento",
        description: "Exclusão lógica: o procedimento fica com is_active = false e sai da lista pública.",
        access: "prof",
        request: deleteProcedureSchema,
        success: [200, json("Procedimento desativado", ref("Procedure"))],
        errors: [404],
      }),
    },

    //---------------------------------------------------------------- Horário de funcionamento
    "/api/working-hours": {
      get: operation({
        tag: "Horário de funcionamento",
        summary: "Expediente de cada dia da semana",
        access: "public",
        success: [200, json("Dias de domingo (0) a sábado (6)", listOf("WorkingDay"))],
      }),
      put: operation({
        tag: "Horário de funcionamento",
        summary: "Atualiza o expediente de um ou mais dias",
        description:
          "Abertura antes do fechamento; pausa com início e fim (ou nenhum dos dois), dentro do expediente; " +
          "sem dias repetidos. Ou todos os dias enviados mudam, ou nenhum.",
        access: "prof",
        request: workingHoursSchema,
        success: [200, json("Dias atualizados", listOf("WorkingDay"))],
      }),
    },

    //---------------------------------------------------------------- Bloqueios
    "/api/schedule-blocks": {
      get: operation({
        tag: "Bloqueios de agenda",
        summary: "Lista os bloqueios de um período",
        description: "Datas do salão (YYYY-MM-DD); o último dia entra inteiro.",
        access: "prof",
        request: listScheduleBlocksSchema,
        success: [200, json("Bloqueios em ordem de início", listOf("ScheduleBlock"))],
      }),
      post: operation({
        tag: "Bloqueios de agenda",
        summary: "Bloqueia um intervalo da agenda",
        description: "O início vem antes do fim. Recusado (400) se houver outro bloqueio ou um agendamento no intervalo.",
        access: "prof",
        request: newScheduleBlockSchema,
        success: [201, json("Bloqueio criado", ref("ScheduleBlock"))],
      }),
    },
    "/api/schedule-blocks/{id}": {
      put: operation({
        tag: "Bloqueios de agenda",
        summary: "Edita um bloqueio",
        description: "Mesmas regras da criação; o próprio bloqueio não conta como conflito.",
        access: "prof",
        request: updateScheduleBlockSchema,
        success: [200, json("Bloqueio atualizado", ref("ScheduleBlock"))],
        errors: [404],
      }),
      delete: operation({
        tag: "Bloqueios de agenda",
        summary: "Remove um bloqueio",
        access: "prof",
        request: scheduleBlockIdParamSchema,
        success: [200, json("Bloqueio removido", ref("ScheduleBlock"))],
        errors: [404],
      }),
    },

    //---------------------------------------------------------------- Agendamentos
    "/api/appointments/slots": {
      get: operation({
        tag: "Agendamentos",
        summary: "Horários livres de um dia para um procedimento",
        description: "Grade de 30 em 30 minutos a partir da abertura, sem pausa, agendamentos, bloqueios e horários passados.",
        access: "user",
        request: appointmentAvailabilitySchema,
        success: [200, json("Horários livres no fuso do salão", { type: "array", items: { type: "string", examples: ["09:00"] } })],
        errors: [404],
      }),
    },
    "/api/appointments": {
      post: operation({
        tag: "Agendamentos",
        summary: "Cria um agendamento",
        description:
          "O cliente agenda para si. Só o profissional pode informar client_id (agendamento no balcão). " +
          "O horário precisa ser futuro, dentro do expediente, fora da pausa e na grade de 30 minutos. " +
          "Se dois pedidos disputarem o mesmo horário, um recebe 201 e o outro 409.",
        access: "user",
        request: createAppointmentSchema,
        success: [201, json("Agendamento criado", ref("Appointment"))],
        errors: [403, 404, 409],
      }),
    },
    "/api/appointments/me": {
      get: operation({
        tag: "Agendamentos",
        summary: "Agendamentos de quem está logado (paginado)",
        description: "Paginação por offset: page começa em 1; limit padrão 20, máximo 100. O total de agendamentos vem no header X-Total-Count.",
        access: "user",
        request: listMyAppointmentsSchema,
        success: [
          200,
          json("Uma página, do mais recente para o mais antigo", listOf("Appointment"), {
            "X-Total-Count": {
              description: "Total de agendamentos do usuário (todas as páginas)",
              schema: { type: "integer" },
            },
          }),
        ],
      }),
    },
    "/api/appointments/board": {
      get: operation({
        tag: "Agendamentos",
        summary: "Grade de agendamentos de um período",
        description: "Período de no máximo 31 dias (a grade não é paginada: o período é o limite).",
        access: "prof",
        request: appointmentBoardSchema,
        success: [200, json("Agendamentos em ordem de início", listOf("Appointment"))],
      }),
    },
    "/api/appointments/{id}/complete": {
      patch: operation({
        tag: "Agendamentos",
        summary: "Marca o agendamento como atendido",
        description: "Só depois do início do agendamento. Não vale para cancelado nem para já concluído.",
        access: "prof",
        request: appointmentIdParamSchema,
        success: [200, json("Agendamento concluído", ref("Appointment"))],
        errors: [404],
      }),
    },
    "/api/appointments/{id}/cancel": {
      patch: operation({
        tag: "Agendamentos",
        summary: "Cancela um agendamento",
        description: "O cliente só cancela os próprios, com no mínimo 24h de antecedência. O profissional não tem esse limite. Concluído não pode ser cancelado.",
        access: "user",
        request: appointmentIdParamSchema,
        success: [200, json("Agendamento cancelado", ref("Appointment"))],
        errors: [403, 404],
      }),
    },
    "/api/appointments/{id}": {
      patch: operation({
        tag: "Agendamentos",
        summary: "Edita horário, procedimento e/ou observação",
        description: "Informe ao menos um campo. Mesmas regras da criação e do prazo de 24h para o cliente. Concluído não pode ser editado.",
        access: "user",
        request: updateAppointmentSchema,
        success: [200, json("Agendamento atualizado", ref("Appointment"))],
        errors: [403, 404, 409],
      }),
    },
  }),
};
