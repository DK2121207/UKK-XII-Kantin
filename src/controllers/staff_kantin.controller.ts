import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { validatorSchema } from "../middlewares/validate";
import bcrypt from "bcryptjs";
// import Joi from "joi";

export const staffController = {
    // READ: Get All Staff (Admin only)
    getAllStaff: async (req: Request, res: Response) => {
        try {
            const staff = await prisma.staff_kantin.findMany({
                include: {
                    stan: { select: { nama_stan: true } },
                    user: { select: { username: true, is_active: true } }
                }
            });
            res.json({ data: staff });
        } catch (error) {
            res.status(500).json({ message: "Gagal mengambil data staff" });
        }
    },

    // UPDATE: Update Profil Staff
    updateStaff: async (req: Request, res: Response) => {
        const { id } = req.params;
        const { error, value } = validatorSchema.siswaSchema.validate(req.body, { stripUnknown: true }); // Menggunakan pola yang sama dengan siswa
        
        if (error) {
            // if (req.file) fs.unlinkSync(req.file?.path);
            return res.status(400).json({ message: error.details[0]?.message });
        }

        try {
            const result = await prisma.$transaction(async (tx) => {
                const current = await tx.staff_kantin.findUnique({ where: { id: Number(id) } });
                if (!current) throw new Error("NOT_FOUND");

                // Update User jika password/username berubah
                if (value.password || value.nama_staff) {
                    await tx.user.update({
                        where: { id: current.id_user },
                        data: {
                            username: value.username, // Opsional jika username ingin diubah
                            password: await bcrypt.hash(value.password, 10)
                        }
                    });
                }

                // Handle Foto
                let fotoPath = current.foto;
                if (req.file) {
                    // if (current.foto && fs.existsSync(current.foto)) fs.unlinkSync(current.foto);
                    fotoPath = req.file?.path;
                }

                return await tx.staff_kantin.update({
                    where: { id: Number(id) },
                    data: {
                        nama_staff: value.nama_staff,
                        alamat: value.alamat,
                        telp: value.telp,
                        foto: fotoPath,
                        id_stan: Number(value.id_stan)
                    }
                });
            });

            res.json({ message: "Profil staff diperbarui", data: result });
        } catch (error: any) {
            // if (req.file) fs.unlinkSync(req.file?.path);
            res.status(500).json({ message: error.message });
        }
    },

    // DELETE: Soft Delete Staff
    deleteStaff: async (req: Request, res: Response) => {
        const { id } = req.params;
        try {
            const staff = await prisma.staff_kantin.findUnique({ where: { id: Number(id) } });
            if (!staff) return res.status(404).json({ message: "Staff tidak ditemukan" });

            await prisma.user.update({
                where: { id: staff.id_user },
                data: { is_active: false }
            });

            res.json({ message: "Akun staff berhasil dinonaktifkan" });
        } catch (error) {
            res.status(500).json({ message: "Gagal menghapus staff" });
        }
    }
};