import cors from "cors";
import express, { Router } from "express";
import helmet from "helmet";
import swaggerUi from "swagger-ui-express";
import { routes as authRoutes } from "./routes/authRoutes";
import { routes as userRoutes } from "./routes/userRoutes";
import { routes as proceduresRoutes } from "./routes/proceduresRoutes";
import { routes as workingHoursRoutes } from "./routes/workingHoursRoutes";
import { routes as appointmentsRoutes } from "./routes/appointmentsRoutes";
import { routes as scheduleBlocksRoutes } from "./routes/scheduleBlocksRoutes";
import { errorHandler } from "./middlewares/errorHandler";
import { openApiDocument } from "./docs/openapi";

//Monta a aplicação Express (middlewares, rotas e handler de erros) sem ligar o servidor.
//Separado do server.ts para os testes de API usarem o app sem abrir uma porta.
export const app = express();

//Prefixo de cada grupo de rotas. Exportado para o teste da documentação comparar
//as rotas reais com as documentadas.
export const apiRoutes: [prefix: string, router: Router][] = [
  ["/api/schedule-blocks", scheduleBlocksRoutes],
  ["/api/auth", authRoutes],
  ["/api/users", userRoutes],
  ["/api/procedures", proceduresRoutes],
  ["/api/working-hours", workingHoursRoutes],
  ["/api/appointments", appointmentsRoutes],
];

app.use(helmet());
app.use(express.json());
//CORS aberto de propósito: este repositório é uma demonstração, sem front publicado.
//O X-Total-Count (total da paginação) precisa ser exposto para o front conseguir lê-lo.
app.use(cors({ exposedHeaders: ["X-Total-Count"] }));

//Documentação: página do Swagger em /api/docs e o documento OpenAPI em /api/docs.json
app.get("/api/docs.json", (_req, res) => {
  res.json(openApiDocument);
});
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(openApiDocument));

for (const [prefix, router] of apiRoutes) {
  app.use(prefix, router);
}

app.use(errorHandler);
