import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { validatorSchema } from "../middlewares/validate";
// import fs from "fs";

const menuController = {
    // ==========================================
    // CREATE MENU
    // ==========================================
    createMenu: async (req: Request, res: Response) => {
        // 1. Validasi Input Body
        const { error, value } = validatorSchema.menuSchema.validate(req.body, { stripUnknown: true });
        
        // Jika validasi gagal, HAPUS file yang baru saja diupload Multer agar tidak nyampah
        if (error) {
            // if (req.file) fs.unlinkSync(req.file?.path);
            return res.status(400).json({ message: error.details[0]?.message });
        }

        // Validasi: Wajib ada file foto saat Create
        if (!req.file) {
            return res.status(400).json({ message: "Foto menu wajib diupload" });
        }

        try {
            // 2. Tentukan ID Stan
            // Jika Staff: Pakai stanId dari token. Jika Admin: Pakai id_stan dari body.
            let stanIdTarget = 0;
            if (req.user?.role === 'staff_kantin') {
                stanIdTarget = req.user.stanId!;
            } else if (req.user?.role === 'admin') {
                if (!value.id_stan) throw new Error("Admin wajib menyertakan id_stan");
                stanIdTarget = Number(value.id_stan);
            }

            // 3. Simpan ke Database
            const newMenu = await prisma.menu.create({
                data: {
                    nama_makanan: value.nama_makanan,
                    harga: Number(value.harga), // Pastikan jadi number/float
                    jenis: value.jenis, // enum: makanan / minuman
                    deskripsi: value.deskripsi,
                    foto: req.file?.path, // Path otomatis dari Multer (uploads/menu/...)
                    id_stan: stanIdTarget
                }
            });

            res.status(201).json({ message: "Menu berhasil dibuat", data: newMenu });

        } catch (error: any) {
            // Cleanup: Hapus file jika database gagal simpan
            // if (req.file) fs.unlinkSync(req.file.path);
            res.status(500).json({ message: "Gagal membuat menu", error: error.message });
        }
    },

    // ==========================================
    // UPDATE MENU
    // ==========================================
    updateMenu: async (req: Request, res: Response) => {
        const { id } = req.params;
        
        // 1. Validasi Input Body
        const { error, value } = validatorSchema.menuSchema.validate(req.body, { stripUnknown: true });

        if (error) {
            // if (req.file) fs.unlinkSync(req.file?.path);
            return res.status(400).json({ message: error.details[0]?.message });
        }

        try {
            // 2. Cari Menu Lama (Penting untuk ambil path foto lama & cek kepemilikan)
            const oldMenu = await prisma.menu.findUnique({
                where: { id: Number(id) }
            });

            if (!oldMenu) {
                // if (req.file) fs.unlinkSync(req.file?.path);
                return res.status(404).json({ message: "Menu tidak ditemukan" });
            }

            // 3. Cek Otoritas (Staff hanya boleh edit menu stannya sendiri)
            if (req.user?.role === 'staff_kantin' && oldMenu.id_stan !== req.user?.stanId) {
                // if (req.file) fs.unlinkSync(req.file?.path);
                return res.status(403).json({ message: "Anda tidak memiliki akses ke menu ini" });
            }

            // 4. Logika Ganti Foto
            let finalFoto = oldMenu.foto; // Default pakai foto lama
            
            if (req.file) {
                // Jika user upload foto baru:
                // a. Hapus foto lama dari storage
                // if (oldMenu.foto && fs.existsSync(oldMenu.foto)) {
                //     fs.unlinkSync(oldMenu.foto);
                // }
                // b. Set path foto baru
                finalFoto = req.file?.path;
            }

            // 5. Update Database
            const updatedMenu = await prisma.menu.update({
                where: { id: Number(id) },
                data: {
                    nama_makanan: value.nama_makanan,
                    harga: Number(value.harga),
                    jenis: value.jenis,
                    deskripsi: value.deskripsi,
                    foto: finalFoto,
                    // Admin bisa pindahkan menu ke stan lain, Staff tidak bisa
                    id_stan: req.user?.role === 'admin' && value.id_stan ? Number(value.id_stan) : oldMenu.id_stan
                }
            });

            res.json({ message: "Menu berhasil diperbarui", data: updatedMenu });

        } catch (error: any) {
            // Cleanup: Jika update DB gagal, hapus foto BARU yang terlanjur diupload
            // if (req.file) fs.unlinkSync(req.file?.path);
            res.status(500).json({ message: "Gagal update menu", error: error.message });
        }
    },
    // READ: Get All Menu (Bisa difilter berdasarkan Stan)
    getAllMenu: async (req: Request, res: Response) => {
        const { id_stan } = req.query;
        try {
            const menus = await prisma.menu.findMany({
                where: {
                    ...(id_stan && { id_stan: Number(id_stan) }),
                    is_available: true // Hanya tampilkan yang tersedia
                },
                include: { stan: { select: { nama_stan: true } } }
            });
            res.json({ data: menus });
        } catch (error) {
            res.status(500).json({ message: "Gagal mengambil data menu" });
        }
    },
    // DELETE: Soft Delete Menu
    deleteMenu: async (req: Request, res: Response) => {
        const { id } = req.params;
        try {
            // Kita gunakan Soft Delete (is_available = false) 
            // agar histori transaksi tidak rusak
            await prisma.menu.update({
                where: { id: Number(id) },
                data: { is_available: false }
            });
            res.json({ message: "Menu berhasil dinonaktifkan" });
        } catch (error) {
            res.status(404).json({ message: "Menu tidak ditemukan" });
        }
    }
};

export default menuController