import { AppointmentService } from "./appointment.service";
import { Request, Response } from "express";

export class AppointmentController {
  constructor(private readonly service: AppointmentService) {}

  availableTimes = async (req: Request, res: Response) => {
    const { procedure_id, date } = req.query as {
      procedure_id: string;
      date: string;
    };

    const result = await this.service.availableTimes({
      procedure_id,
      date,
    });

    res.status(200).json(result);
  };

  createAppointment = async (req: Request, res: Response) => {
    const { start_time, observation, procedure_id, client_id } = req.body;

    const result = await this.service.createAppointment({
      start_time,
      observation,
      actor_id: req.user_id!,
      actor_role: req.user_role,
      procedure_id,
      client_id,
    });

    res.status(201).json(result);
  };

  listMine = async (req: Request, res: Response) => {
    const result = await this.service.listMine(req.user_id!);
    res.status(200).json(result);
  };

  listBoard = async (req: Request, res: Response) => {
    const { start_date, end_date } = req.query as {
      start_date: string;
      end_date: string;
    };

    const result = await this.service.listBoard(start_date, end_date);
    res.status(200).json(result);
  };

  cancelAppointment = async (req: Request, res: Response) => {
    const result = await this.service.cancelAppointment({
      appointmentId: req.params.id as string,
      actor_id: req.user_id!,
      actor_role: req.user_role,
    });

    res.status(200).json(result);
  };

  updateAppointment = async (req: Request, res: Response) => {
    const { start_time, procedure_id, observation } = req.body;

    const result = await this.service.updateAppointment({
      appointmentId: req.params.id as string,
      actor_id: req.user_id!,
      actor_role: req.user_role,
      start_time,
      procedure_id,
      observation,
    });

    res.status(200).json(result);
  };
}
