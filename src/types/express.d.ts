import { Role } from "../generated/prisma/enums"; // sesuaikan path generated prisma kamu

declare global {
    namespace Express {
        interface Request {
            user?: {
                userId: number;
                role: Role;
                siswaId?: number;
                stanId?: number;
            };
        }
    }
}