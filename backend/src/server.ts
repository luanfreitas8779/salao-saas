import cors from "cors";
import { env } from "./schemas/validateEnvSchema";
import express, { NextFunction, Request, Response } from "express";
import helmet from "helmet";
import { routes as userRoutes } from "./routes/userRoutes";
import { routes as proceduresRoutes } from "./routes/proceduresRoutes";
import { routes as workingHoursRoutes } from "./routes/workingHours";
import { routes as appointmentsRoutes } from "./routes/appointmentsRoutes";
import { routes as scheduleBlocksRoutes } from "./routes/scheduleBlocksRoutes";
import { AppError } from "./errors/app-error";

const PORT = env.PORT;
const app = express();
app.use(helmet());
app.use(express.json());
app.use(cors());
app.use("/api/scheduleblocks/", scheduleBlocksRoutes);
app.use("/api/users/", userRoutes);
app.use("/api/procedures/", proceduresRoutes);
app.use("/api/workinghours/", workingHoursRoutes);
app.use("/api/appointments", appointmentsRoutes);
app.use(
  (error: Error & Partial<AppError>, _: Request, res: Response, _next: NextFunction) => {
    const statusCode = error.statusCode ?? 500;
    const message = error.statusCode ? error.message : "Internal Server Error";
    res.status(statusCode).json({ message });
  },
);

app.listen(PORT, () => {
  console.log("Funcionouu!! Server rodando na porta " + PORT);
});
