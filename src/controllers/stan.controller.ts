import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { validatorSchema } from "../middlewares/validate";

export const stanController = {
    // CREATE: Membuat Stan baru
    createStan: async (req: Request, res: Response) => {
        const { error, value } = validatorSchema.stanSchema.validate(req.body, { stripUnknown: true });
        if (error) return res.status(400).json({ message: error.details[0]?.message });

        try {
            const newStan = await prisma.stan.create({
                data: {
                    nama_stan: value.nama_stan
                }
            });
            res.status(201).json({ message: "Stan berhasil dibuat", data: newStan });
        } catch (error: any) {
            res.status(500).json({ message: "Gagal membuat stan", error: error.message });
        }
    },

    // READ: Melihat semua stan (beserta staff yang ada di dalamnya)
    getAllStan: async (req: Request, res: Response) => {
        try {
            const stans = await prisma.stan.findMany({
                include: {
                    _count: { select: { menu: true, staff_kantin: true } },
                    staff_kantin: {
                        select: { nama_staff: true, telp: true }
                    }
                }
            });
            res.json({ data: stans });
        } catch (error: any) {
            res.status(500).json({ message: "Gagal mengambil data stan" });
        }
    },

    // UPDATE: Mengubah nama stan
    updateStan: async (req: Request, res: Response) => {
        const { id } = req.params;
        const { error, value } = validatorSchema.stanSchema.validate(req.body, { stripUnknown: true });
        if (error) return res.status(400).json({ message: error.details[0]?.message });

        try {
            const updated = await prisma.stan.update({
                where: { id: Number(id) },
                data: { nama_stan: value.nama_stan }
            });
            res.json({ message: "Stan berhasil diperbarui", data: updated });
        } catch (error: any) {
            res.status(404).json({ message: "Stan tidak ditemukan" });
        }
    },

    // DELETE: Menghapus stan
    deleteStan: async (req: Request, res: Response) => {
        const { id } = req.params;
        try {
            // Cek apakah ada transaksi atau staff di stan ini
            const checkStan = await prisma.stan.findUnique({
                where: { id: Number(id) },
                include: {
                    _count: { select: { transaksi: true, staff_kantin: true } }
                }
            });

            if (!checkStan) return res.status(404).json({ message: "Stan tidak ditemukan" });

            // Proteksi: Jangan hapus jika sudah ada histori transaksi
            if (checkStan._count.transaksi > 0) {
                return res.status(400).json({ 
                    message: "Stan tidak bisa dihapus karena sudah memiliki histori transaksi. Gunakan sistem penonaktifan staff sebagai gantinya." 
                });
            }

            await prisma.stan.delete({ where: { id: Number(id) } });
            res.json({ message: "Stan berhasil dihapus permanen" });
        } catch (error: any) {
            res.status(500).json({ message: "Gagal menghapus stan" });
        }
    }
};