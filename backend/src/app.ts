import cors from "cors";
import express from "express";
import helmet from "helmet";
import { routes as authRoutes } from "./routes/authRoutes";
import { routes as userRoutes } from "./routes/userRoutes";
import { routes as proceduresRoutes } from "./routes/proceduresRoutes";
import { routes as workingHoursRoutes } from "./routes/workingHoursRoutes";
import { routes as appointmentsRoutes } from "./routes/appointmentsRoutes";
import { routes as scheduleBlocksRoutes } from "./routes/scheduleBlocksRoutes";
import { errorHandler } from "./middlewares/errorHandler";

//Monta a aplicação Express (middlewares, rotas e handler de erros) sem ligar o servidor.
//Separado do server.ts para os testes de API usarem o app sem abrir uma porta.
export const app = express();

app.use(helmet());
app.use(express.json());
app.use(cors());
app.use("/api/schedule-blocks", scheduleBlocksRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/procedures", proceduresRoutes);
app.use("/api/working-hours", workingHoursRoutes);
app.use("/api/appointments", appointmentsRoutes);
app.use(errorHandler);
