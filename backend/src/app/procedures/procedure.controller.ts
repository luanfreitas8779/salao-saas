import { ProcedureService } from "./procedure.service";
import { Request, Response } from "express";

interface CreateNewProcedureProps {
  name: string;
  description: string;
  price: number;
  duration_minutes: number;
}

interface DeleteProcedureProps {
  id: string;
}

interface EditProceduresProps {
  id: string;
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
    const createNewProcedure = await this.service.createProcedure({
      name: name,
      description: description,
      price: price,
      duration_minutes: duration_minutes,
    });

    res.status(201).json({ createNewProcedure });
  };

  deleteProcedure = async (req: Request, res: Response) => {
    const { id }: DeleteProcedureProps = req.body;
    const deleteProcedure = await this.service.deleteProcedure({ id: id });
    res.status(200).json({ deleteProcedure });
  };

  editProcedure = async (req: Request, res: Response) => {
    const {
      id,
      name,
      description,
      price,
      duration_minutes,
    }: EditProceduresProps = req.body;
    const editProcedure = await this.service.editProcedure({
      id: id,
      name: name,
      description: description,
      price: price,
      duration_minutes: duration_minutes,
    });
    res.status(200).json({ editProcedure });
  };

  findAllProcedures = async (_: Request, res: Response) => {
    const findAllProcedures = await this.service.findAllProcedures();
    res.status(200).json({ findAllProcedures });
  };

  findActiveProcedures = async (_: Request, res: Response) => {
    const findActiveProcedures = await this.service.findActiveProcedures();
    res.status(200).json({ findActiveProcedures });
  };
}
