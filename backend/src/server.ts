import cors from "cors";
import { env } from "./schemas/validateEnvSchema";
import express, { Request, Response } from "express";
import { routes } from "./routes";
import helmet from "helmet";

const PORT = env.PORT;
const app = express();
app.use(helmet());
app.use(express.json());
app.use(cors());
app.use(routes);
app.use((error: Error, _: Request, res: Response, next: any) => {
  if (error instanceof Error) {
    res.status(400).json({
      message: error.message,
    });
  }
  res.status(500).json({
    error: "Internal server error!",
  });
});

app.listen(PORT, () => {
  console.log("Funcionouu!! Server rodando na porta " + PORT);
});
