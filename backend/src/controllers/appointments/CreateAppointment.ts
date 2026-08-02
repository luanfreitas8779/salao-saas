import { CreateAppointmentService } from "../../services/appointments/CreateAppointment";
import { Request, Response } from "express";

export class CreateAppointmentController {
  async handle(req: Request, res: Response) {
    const { start_time, observation, procedure_id } = req.body;
    const client_id = req.user_id;
    if (!client_id) {
      throw new Error("Cliente não identificado, faça login novamente.");
    }

    const service = new CreateAppointmentService();

    const result = await service.execute({
      start_time: start_time,
      observation: observation,
      client_id: client_id,
      procedure_id: procedure_id,
    });

    res.json(result);
  }
}
