import { UserProfileService } from "../../services/user/UserProfileService";
import { Request, Response } from "express";

export class UserProfileController {
  async handle(req: Request, res: Response) {
    const id = req.user_id;

    const userProfileService = new UserProfileService();

    const user = await userProfileService.execute({
      id: id as string,
    });

    res.status(200).json({ user: user });
  }
}
