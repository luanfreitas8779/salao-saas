import { Request, Response } from "express";
import { UserService } from "./user.service";

interface AuthLoginProps {
  email: string;
  password: string;
}

interface CreateNewUserProps {
  name: string;
  email: string;
  phone: string;
  password: string;
}

interface RecoveryPasswordProps {
  email: string;
}

interface ResetPasswordProps {
  newPassword: string;
}

export class UserController {
  constructor(private readonly service: UserService) {}

  authLogin = async (req: Request, res: Response) => {
    const { email, password }: AuthLoginProps = req.body;

    const login = await this.service.authLogin({
      email: email,
      password: password,
    });

    res.status(200).json(login);
  };

  CreateNewUser = async (req: Request, res: Response) => {
    const { name, email, phone, password }: CreateNewUserProps = req.body;

    const createdUser = await this.service.CreateNewUser({
      name: name,
      email: email,
      phone: phone,
      password: password,
    });

    res.status(201).json(createdUser);
  };

  recoveryPassword = async (req: Request, res: Response) => {
    const { email }: RecoveryPasswordProps = req.body;

    const message = await this.service.recoveryPassword({
      email: email,
    });

    res.status(200).json({ message });
  };

  resetPassword = async (req: Request, res: Response) => {
    const token = req.params.token as string;
    const { newPassword }: ResetPasswordProps = req.body;

    const message = await this.service.resetPassword({
      token: token,
      newPassword: newPassword,
    });

    res.status(200).json({ message });
  };

  getUserById = async (req: Request, res: Response) => {
    const id: string = req.user_id!;

    const user = await this.service.getUserById({ id: id });

    res.status(200).json(user);
  };

  searchClients = async (req: Request, res: Response) => {
    const { search } = req.query as { search: string };

    const clients = await this.service.searchClients({ search: search });

    res.status(200).json(clients);
  };

  updateProfile = async (req: Request, res: Response) => {
    const { phone, password } = req.body;

    const user = await this.service.updateProfile({
      id: req.user_id!,
      phone: phone,
      password: password,
    });

    res.status(200).json(user);
  };
}
