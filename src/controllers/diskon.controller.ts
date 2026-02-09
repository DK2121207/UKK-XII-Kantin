import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { validatorSchema } from "../middlewares/validate";

export const diskonController = {
    // 1. CREATE MASTER DISKON
    // Admin/Staff membuat event diskon (misal: "Flash Sale")
    createDiskon: async (req: Request, res: Response) => {
        const { error, value } = validatorSchema.diskonSchema.validate(req.body);
        if (error) return res.status(400).json({ message: error.details[0]?.message });

        try {
            const newDiskon = await prisma.diskon.create({
                data: {
                    nama_diskon: value.nama_diskon,
                    persentase_diskon: value.persentase_diskon,
                    tanggal_awal: new Date(value.tanggal_awal),
                    tanggal_akhir: new Date(value.tanggal_akhir)
                }
            });
            res.status(201).json({ message: "Diskon berhasil dibuat", data: newDiskon });
        } catch (error) {
            res.status(500).json({ message: "Gagal membuat diskon" });
        }
    },
    // UPDATE DISKON
    updateDiskon: async (req: Request, res: Response) => {
        const { id } = req.params;
        const { nama_diskon, persentase_diskon, tanggal_awal, tanggal_akhir } = req.body;

        // Validasi format input (bisa pakai Joi .optional())
        const { error, value } = validatorSchema.diskonSchema
            .fork(Object.keys(validatorSchema.diskonSchema.describe().keys), field => field.optional())
            .validate(req.body);

        if (error) return res.status(400).json({ message: error.details[0]?.message });

        try {
            // 1. Ambil data diskon lama untuk validasi tanggal
            const currentDiskon = await prisma.diskon.findUnique({ where: { id: Number(id) } });
            if (!currentDiskon) return res.status(404).json({ message: "Diskon tidak ditemukan" });

            // 2. Logika Validasi Tanggal (Cegah Tanggal Akhir < Tanggal Awal)
            const newStart = value.tanggal_awal ? new Date(value.tanggal_awal) : currentDiskon.tanggal_awal;
            const newEnd = value.tanggal_akhir ? new Date(value.tanggal_akhir) : currentDiskon.tanggal_akhir;

            if (newEnd < newStart) {
                return res.status(400).json({ message: "Tanggal akhir tidak boleh sebelum tanggal awal" });
            }

            // 3. Update Data
            const updatedDiskon = await prisma.diskon.update({
                where: { id: Number(id) },
                data: {
                    nama_diskon: value.nama_diskon,
                    persentase_diskon: value.persentase_diskon,
                    tanggal_awal: newStart,
                    tanggal_akhir: newEnd
                }
            });

            res.json({ message: "Diskon berhasil diperbarui", data: updatedDiskon });
        } catch (error) {
            res.status(500).json({ message: "Gagal mengupdate diskon" });
        }
    },
    // DELETE DISKON (Hard Delete)
    deleteDiskon: async (req: Request, res: Response) => {
        const { id } = req.params;

        try {
            await prisma.$transaction(async (tx) => {
                // 1. Cek apakah diskon ada
                const diskon = await tx.diskon.findUnique({ where: { id: Number(id) } });
                if (!diskon) throw new Error("NOT_FOUND");

                // 2. Hapus dulu semua relasi di tabel Menu_diskon
                // (Mencabut diskon ini dari semua menu yang menggunakannya)
                await tx.menu_diskon.deleteMany({
                    where: { id_diskon: Number(id) }
                });

                // 3. Baru hapus master Diskon-nya
                await tx.diskon.delete({
                    where: { id: Number(id) }
                });
            });

            res.json({ message: "Diskon berhasil dihapus permanen" });
        } catch (error: any) {
            if (error.message === "NOT_FOUND") {
                return res.status(404).json({ message: "Diskon tidak ditemukan" });
            }
            res.status(500).json({ message: "Gagal menghapus diskon", error: error.message });
        }
    },

    // 2. ASSIGN MENU TO DISKON (Many-to-Many Logic)
    // Menempelkan diskon ke beberapa menu sekaligus
    addMenuToDiskon: async (req: Request, res: Response) => {
        const { error, value } = validatorSchema.addMenuToDiskonSchema.validate(req.body);
        if (error) return res.status(400).json({ message: error.details[0]?.message });

        try {
            // Cek apakah Diskon Valid
            const diskon = await prisma.diskon.findUnique({ where: { id: value.id_diskon } });
            if (!diskon) return res.status(404).json({ message: "Diskon tidak ditemukan" });

            // Validasi: Pastikan menu yang dipilih ada (dan milik stan si staff jika perlu)
            // Disini kita gunakan createMany untuk efisiensi

            // Siapkan data untuk bulk insert
            const dataToInsert = value.menu_ids.map((idMenu: number) => ({
                id_diskon: value.id_diskon,
                id_menu: idMenu
            }));

            // Eksekusi insert ke tabel penghubung (Menu_diskon)
            // Gunakan createMany (MySQL support) atau loop jika DB lain
            await prisma.menu_diskon.createMany({
                data: dataToInsert,
                skipDuplicates: true // Agar tidak error jika sudah pernah ditambahkan
            });

            res.json({ message: "Diskon berhasil diterapkan ke menu terpilih" });
        } catch (error) {
            res.status(500).json({ message: "Gagal menerapkan diskon" });
        }
    },

    // 3. READ ACTIVE DISCOUNTS
    // Melihat menu apa saja yang sedang diskon HARI INI
    getDiscountedMenus: async (req: Request, res: Response) => {
        const today = new Date();

        try {
            // Cari diskon yang sedang aktif (tanggal masuk range)
            const activeDiscounts = await prisma.menu_diskon.findMany({
                where: {
                    diskon: {
                        tanggal_awal: { lte: today }, // Awal <= Hari ini
                        tanggal_akhir: { gte: today } // Akhir >= Hari ini
                    }
                },
                include: {
                    menu: true,    // Ambil detail menunya
                    diskon: true   // Ambil info berapa persennya
                }
            });

            // Format data agar Frontend mudah membacanya (Hitung Harga Akhir)
            const result = activeDiscounts.map(item => {
                const hargaAsli = item.menu.harga;
                const potongan = (hargaAsli * item.diskon.persentase_diskon) / 100;
                const hargaAkhir = hargaAsli - potongan;

                return {
                    menu: item.menu.nama_makanan,
                    harga_asli: hargaAsli,
                    diskon_label: item.diskon.nama_diskon,
                    persentase: item.diskon.persentase_diskon,
                    harga_setelah_diskon: hargaAkhir,
                    id_menu: item.menu.id
                };
            });

            res.json({
                message: "Daftar menu yang sedang diskon hari ini",
                data: result
            });

        } catch (error) {
            res.status(500).json({ message: "Gagal mengambil data diskon" });
        }
    },

    // 4. DELETE DISKON (Hapus dari Menu tertentu)
    removeMenuFromDiskon: async (req: Request, res: Response) => {
        const { id_menu, id_diskon } = req.params;
        try {
            // Karena tabel Menu_diskon tidak punya @unique compound key di schema awalmu,
            // Kita cari dulu ID-nya, atau gunakan deleteMany
            await prisma.menu_diskon.deleteMany({
                where: {
                    id_menu: Number(id_menu),
                    id_diskon: Number(id_diskon)
                }
            });
            res.json({ message: "Diskon dicabut dari menu ini" });
        } catch (error) {
            res.status(500).json({ message: "Gagal menghapus diskon" });
        }
    }
};