import { Router } from "express";
import { CreateUserController } from "./controllers/user/CreateUserController";
import { createUserSchema } from "./schemas/users/userSchema";
import { validateSchema } from "./middleweares/validateSchema";
import { authLoginSchema } from "./schemas/users/authLoginSchema";
import { AuthLoginController } from "./controllers/user/AuthLoginController";
import { recoveryPasswordSchema } from "./schemas/users/recoveryPasswordSchema";
import { RecoveryPasswordController } from "./controllers/user/RecoveryPasswordController";
import { ResetPasswordController } from "./controllers/user/ResetPasswordController";
import { resetPasswordSchema } from "./schemas/users/resetPasswordSchema";
import { isAuthenticated } from "./middleweares/isAuthenticatedMiddleweare";
import { isAdmin } from "./middleweares/isAdmin";
import { UserProfileController } from "./controllers/user/UserProfileController";
import { GetProceduresController } from "./controllers/procedures/GetProceduresController";
import { EditProceduresController } from "./controllers/procedures/EditProcedureController";
import { createProcedureSchema } from "./schemas/procedures/createProcedureSchema";
import { editProcedureSchema } from "./schemas/procedures/editProcedureSchema";
import { deleteProcedureSchema } from "./schemas/procedures/deleteProcedureSchema";
import { DeleteProcedureController } from "./controllers/procedures/DeleteProcedureController";
import { CreateAppointmentController } from "./controllers/appointments/CreateAppointment";
import {
  loginRateLimiter,
  recoveryPasswordLimiter,
} from "./middleweares/rateLimiterMiddleweare";
import { UpdateWorkingHoursController } from "./controllers/workingHours/UpdateWorkingHoursController";
import { workingHoursSchema } from "./schemas/workingHours/workingHoursSchema";
import { GetAllProceduresController } from "./controllers/procedures/GetAllProceduresController";
import { createAppointmentSchema } from "./schemas/appointments/createAppointmentSchema";
import { AppointmentsAvailabilityController } from "./controllers/appointments/AppointmentAvailableController";
import { appointmentAvailabilitySchema } from "./schemas/appointments/appointmentAvailabilitySchema";

const routes = Router();

// ======================== ROTAS DE USUÁRIO ===================================
//ROTA DE CADASTRO DE USUÁRIO
routes.post(
  "/api/auth/register",
  validateSchema(createUserSchema),
  new CreateUserController().handle,
);
//ROTA DE LOGIN
routes.post(
  "/api/auth/login",
  loginRateLimiter,
  validateSchema(authLoginSchema),
  new AuthLoginController().handle,
);
//ROTA DE RECUPERAÇÃO DE SENHA
routes.post(
  "/api/auth/recoverypassword",
  recoveryPasswordLimiter,
  validateSchema(recoveryPasswordSchema),
  new RecoveryPasswordController().handle,
);
//ROTA DE ALTERAÇÃO DE SENHA
routes.post(
  "/api/auth/resetpassword/:token",
  validateSchema(resetPasswordSchema),
  new ResetPasswordController().handle,
);

//ROTA PEGAR DADOS DO USUÁRIO LOGADO!
routes.get(
  "/api/users/profile",
  isAuthenticated,
  new UserProfileController().handle,
);

// ===================================== ROTAS DE PROCEDIMENTOS ================================

//Rota que recebe todos os procedimentos ativos
routes.get(
  "/api/procedures",
  isAuthenticated,
  new GetProceduresController().handle,
);

//Rota para listar todos os procedimentos cadastrados no banco

routes.get(
  "/api/procedures/all",
  isAuthenticated,
  isAdmin,
  new GetAllProceduresController().handle,
);

// ROTA PARA CRIAR UM NOVO PROCEDIMENTO

routes.post(
  "/api/procedures/new",
  validateSchema(createProcedureSchema),
  isAuthenticated,
  isAdmin,
  new CreateUserController().handle,
);

//ROTA PARA EDITAR UM PROCEDIMENTO
routes.put(
  "/api/procedures/edit/",
  validateSchema(editProcedureSchema),
  isAuthenticated,
  isAdmin,
  new EditProceduresController().handle,
);

//ROTA PARA DELETAR / DESATIVAR UM PROCEDIMENTO

routes.delete(
  "/api/procedures/delete",
  validateSchema(deleteProcedureSchema),
  isAuthenticated,
  isAdmin,
  new DeleteProcedureController().handle,
);

// ====================================== ROTAS DE BLOQUEIO DE AGENDA ==============================

//routes.post("/api/schedule-blocks/new");

// ====================================== ROTAS DE HORARIOS DE ATENDIMENTO ==============================

// Rota para alterar os horários

routes.put(
  "/working/hours/update",
  validateSchema(workingHoursSchema),
  isAuthenticated,
  isAdmin,
  new UpdateWorkingHoursController().handle,
);

//======================================= ROTAS DE AGENDAMENTOS ====================================

//Rota para verificar horários disponíveis

routes.get(
  "/api/appointments/availability",
  validateSchema(appointmentAvailabilitySchema),
  isAuthenticated,
  new AppointmentsAvailabilityController().handle,
);

//ROTA PARA CRIAR UM AGENDAMENTO
routes.post(
  "/api/appointments",
  isAuthenticated,
  validateSchema(createAppointmentSchema),
  new CreateAppointmentController().handle,
);

// ROTA PARA LISTAR TODOS OS AGENDAMENTOS DO CLIENTE
routes.get("/api/appointments/me", isAuthenticated);
export { routes };
