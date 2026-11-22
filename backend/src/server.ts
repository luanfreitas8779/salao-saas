//O env vem primeiro: se faltar alguma variável, o servidor nem chega a montar o app.
import { env } from "./schemas/validateEnvSchema";
import { app } from "./app";

//Só liga o servidor. A montagem da aplicação fica no app.ts.
app.listen(env.PORT, () => {
  console.log("Funcionouu!! Server rodando na porta " + env.PORT);
});
