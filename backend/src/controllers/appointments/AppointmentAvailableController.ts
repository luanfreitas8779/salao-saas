import { AppointmentAvailabilityService } from "../../services/appointments/AppointmentAvailabilityService";
import { Request, Response } from "express";

export class AppointmentsAvailabilityController {
  async handle(req: Request, res: Response) {
    const { day, duration_time } = req.body;

    const service = new AppointmentAvailabilityService();

    const result = await service.execute({
      day: day,
      duration_time: duration_time,
    });

    res.json(result);
  }
}
