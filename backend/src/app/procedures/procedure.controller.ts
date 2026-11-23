import { ProcedureService } from "./procedure.service";
import { Request, Response } from "express";

interface CreateNewProcedureProps {
  name: string;
  description: string;
  price: number;
  duration_minutes: number;
}

interface EditProceduresProps {
  name: string;
  description: string;
  price: number;
  duration_minutes: number;
}

export class ProcedureController {
  constructor(private readonly service: ProcedureService) {}

  createNewProcedure = async (req: Request, res: Response) => {
    const {
      name,
      description,
      price,
      duration_minutes,
    }: CreateNewProcedureProps = req.body;
    const procedure = await this.service.createProcedure({
      name: name,
      description: description,
      price: price,
      duration_minutes: duration_minutes,
    });

    res.status(201).json(procedure);
  };

  deleteProcedure = async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const deactivatedProcedure = await this.service.deleteProcedure({ id: id });
    res.status(200).json(deactivatedProcedure);
  };

  editProcedure = async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const {
      name,
      description,
      price,
      duration_minutes,
    }: EditProceduresProps = req.body;
    const updatedProcedure = await this.service.editProcedure({
      id: id,
      name: name,
      description: description,
      price: price,
      duration_minutes: duration_minutes,
    });
    res.status(200).json(updatedProcedure);
  };

  findAllProcedures = async (_: Request, res: Response) => {
    const procedures = await this.service.findAllProcedures();
    res.status(200).json(procedures);
  };

  findActiveProcedures = async (_: Request, res: Response) => {
    const activeProcedures = await this.service.findActiveProcedures();
    res.status(200).json(activeProcedures);
  };
}
