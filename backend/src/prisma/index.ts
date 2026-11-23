import { env } from "../schemas/validateEnvSchema";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = env.DATABASE_URL;
const adapter = new PrismaPg({ connectionString });

const prismaClient = new PrismaClient({ adapter });

export default prismaClient;
