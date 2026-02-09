import bcrypt from 'bcryptjs'
import { prisma } from '../lib/prisma'
import { Request, Response } from "express";
import { validatorSchema } from '../middlewares/validate'
// import fs from 'fs'

export const user_controller = {
    updateSiswa: async (req: Request, res: Response) => {
        const { id } = req.params;

        // 1. Validasi Input (Gunakan schema yang sudah ada atau buat versi optional)
        // Tip: Untuk update, biasanya schema Joi dibuat .optional() agar tidak perlu kirim semua data
        const { error, value } = validatorSchema.updateSiswaSchema.validate(req.body, { stripUnknown: true });
        if (error) return res.status(400).json({ message: error.details[0]!.message });

        try {
            const result = await prisma.$transaction(async (tx) => {
                // 2. Cari data siswa lama
                const currentSiswa = await tx.siswa.findUnique({
                    where: { id: Number(id) },
                    include: { user: true }
                });

                if (!currentSiswa) throw new Error("NOT_FOUND");

                // 3. Jika NIS diubah, cek apakah NIS baru sudah dipakai orang lain
                if (value.nis && value.nis !== currentSiswa.nis) {
                    const nisCheck = await tx.siswa.findUnique({ where: { nis: value.nis } });
                    if (nisCheck) throw new Error("NIS_TAKEN");
                }

                // 4. Update User (Username & Password)
                const userUpdate: any = {};
                if (value.nama_siswa) userUpdate.username = value.nama_siswa;
                if (value.password) userUpdate.password = await bcrypt.hash(value.password, 10);
                if (value.email) userUpdate.email = value.email;
                userUpdate.role = 'siswa'

                await tx.user.update({
                    where: { id: currentSiswa.id_user },
                    data: userUpdate
                });

                // 5. Penanganan Foto Baru
                let fotoPath = currentSiswa.foto;
                if (req.file) {
                    // Hapus foto lama jika ada
                    // if (currentSiswa.foto && fs.existsSync(currentSiswa.foto)) {
                    //     fs.unlinkSync(currentSiswa.foto);
                    // }
                    fotoPath = req.file?.path;
                }

                // 6. Update Profil Siswa
                return await tx.siswa.update({
                    where: { id: Number(id) },
                    data: {
                        nis: value.nis,
                        nama_siswa: value.nama_siswa,
                        alamat: value.alamat,
                        telp: value.telp,
                        foto: fotoPath
                    },
                    include: { user: true }
                });
            });

            res.json({ message: "Data siswa berhasil diperbarui", data: result });

        } catch (error: any) {
            // if (req.file) fs.unlinkSync(req.file?.path); // Hapus foto baru jika transaksi gagal

            if (error.message === "NOT_FOUND") return res.status(404).json({ message: "Siswa tidak ditemukan" });
            if (error.message === "NIS_TAKEN") return res.status(409).json({ message: "NIS sudah digunakan oleh siswa lain" });

            res.status(500).json({ message: "Terjadi kesalahan", error: error.message });
        }
    },
    softDeleteSiswa: async (req: Request, res: Response) => {
        const { id } = req.params;

        try {
            await prisma.$transaction(async (tx) => {
                const siswa = await tx.siswa.findUnique({ where: { id: Number(id) } });
                if (!siswa) throw new Error("NOT_FOUND");

                // Soft delete: set user is_active menjadi false
                await tx.user.update({
                    where: { id: siswa.id_user },
                    data: { is_active: false }
                });
            });

            res.json({ message: "Siswa berhasil dinonaktifkan (Soft Delete)" });

        } catch (error: any) {
            if (error.message === "NOT_FOUND") return res.status(404).json({ message: "Siswa tidak ditemukan" });
            res.status(500).json({ message: "Gagal menghapus siswa" });
        }
    },
    getAllSiswa: async (req: Request, res: Response) => {
        try {
            const siswa = await prisma.siswa.findMany({
                where: {
                    user: { is_active: true }
                },
                include: {
                    user: { select: { username: true, is_active: true } }
                }
            });
            res.json(siswa);
        } catch (error) {
            res.status(500).json({ message: "Gagal mengambil data siswa" });
        }
    },
    getSiswaById: async (req: Request, res: Response) => {
        const { id } = req.params;
        try {
            const siswa = await prisma.siswa.findUnique({
                where: { id: Number(id) },
                include: { user: true }
            });

            if (!siswa || !siswa.user.is_active) {
                return res.status(404).json({ message: "Siswa tidak ditemukan atau nonaktif" });
            }

            res.json(siswa);
        } catch (error) {
            res.status(500).json({ message: "Error saat mengambil data" });
        }
    },
}