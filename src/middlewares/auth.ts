import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config/env'; // Menggunakan config aman yang kita bahas tadi

const auth = {
    authMiddleware: (req: Request, res: Response, next: NextFunction) => {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ message: 'Akses ditolak. Token tidak disediakan.' });
        }

        const token = authHeader.split(' ')[1] || '';

        try {
            const decoded = jwt.verify(token, JWT_SECRET) as any;

            // Simpan data payload ke dalam request object
            req.user = {
                userId: decoded.userId,
                role: decoded.role,
                siswaId: decoded.siswaId
            };

            next();
        } catch (error) {
            return res.status(403).json({ message: 'Token tidak valid atau telah kedaluwarsa.' });
        }
    },
    authorizeRole: (...allowedRoles: string[]) => {
        return (req: Request, res: Response, next: NextFunction) => {
            if (!req.user) {
                return res.status(401).json({ message: 'Tidak terautentikasi.' });
            }

            if (!allowedRoles.includes(req.user.role)) {
                return res.status(403).json({
                    message: `Akses ditolak. Role ${req.user.role} tidak diizinkan mengakses rute ini.`
                });
            }

            next();
        };
    },
};

export default auth