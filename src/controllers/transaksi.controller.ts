import { Request, Response } from "express";
import PDFDocument from "pdfkit"
import { prisma } from "../lib/prisma";
import { validatorSchema } from "../middlewares/validate";

// Helper untuk format Rupiah
const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(amount);
};

// Helper untuk format Tanggal
const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('id-ID', {
        day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
};

export const transaksiController = {
    checkout: async (req: Request, res: Response) => {
        // 1. Validasi Input
        const { error, value } = validatorSchema.checkoutSchema.validate(req.body);
        if (error) return res.status(400).json({ message: error.details[0]!.message });

        const id_siswa = req.user?.siswaId; // Diambil dari JWT Token login siswa
        const today = new Date();

        try {
            const result = await prisma.$transaction(async (tx) => {
                // 2. Buat Header Transaksi dulu
                const transaksi = await tx.transaksi.create({
                    data: {
                        id_siswa: id_siswa!,
                        id_stan: value.id_stan,
                        tanggal: today,
                        status: 'belum_dikonfirm'
                    }
                });

                let totalBayar = 0;
                const detailData = [];

                // 3. Loop setiap item untuk cek harga & diskon
                for (const item of value.items) {
                    // Ambil detail menu
                    const menu = await tx.menu.findUnique({
                        where: { id: item.id_menu },
                        include: {
                            menu_diskon: {
                                where: {
                                    diskon: {
                                        tanggal_awal: { lte: today },
                                        tanggal_akhir: { gte: today }
                                    }
                                },
                                include: { diskon: true }
                            }
                        }
                    });

                    if (!menu) throw new Error(`Menu dengan ID ${item.id_menu} tidak ditemukan`);
                    if (menu.id_stan !== value.id_stan) throw new Error(`Menu ${menu.nama_makanan} bukan milik stan ini`);

                    // 4. LOGIKA DISKON CERDAS
                    let hargaFinal = menu.harga;
                    if (menu.menu_diskon.length > 0) {
                        // Jika ada diskon aktif, ambil yang pertama (atau bisa disesuaikan logicnya)
                        const diskon = menu.menu_diskon[0]?.diskon;
                        const potongan = (menu.harga * diskon!.persentase_diskon) / 100;
                        hargaFinal = menu.harga - potongan;
                    }

                    totalBayar += hargaFinal * item.qty;

                    // 5. Siapkan data untuk Detail_transaksi
                    detailData.push({
                        id_transaksi: transaksi.id,
                        id_menu: item.id_menu,
                        qty: item.qty,
                        harga_beli: hargaFinal // Simpan harga saat transaksi terjadi
                    });
                }

                // 6. Bulk Insert ke Detail_transaksi
                await tx.detail_transaksi.createMany({
                    data: detailData
                });

                return {
                    id_transaksi: transaksi.id,
                    total_bayar: totalBayar,
                    detail: detailData
                };
            });

            res.status(201).json({
                message: "Checkout berhasil, silakan tunggu konfirmasi stan",
                data: result
            });

        } catch (error: any) {
            res.status(400).json({ message: error.message });
        }
    },
    // GET HISTORY SISWA (Filter by Month & Year)
    getHistorySiswa: async (req: Request, res: Response) => {
        const siswaId = req.user?.siswaId; // Dari token login siswa

        // Ambil query params dari URL (misal: /transaksi/history?bulan=3&tahun=2024)
        const { bulan, tahun } = req.query;

        try {
            // 1. Logika Filter Tanggal
            let dateFilter = {};

            if (bulan) {
                const year = tahun ? Number(tahun) : new Date().getFullYear(); // Default tahun ini
                const month = Number(bulan) - 1; // JS Month mulai dari 0 (Januari = 0)

                // Tanggal Awal Bulan (Tgl 1 jam 00:00:00)
                const startDate = new Date(year, month, 1);

                // Tanggal Akhir Bulan (Tgl 0 jam 23:59:59 dari bulan depannya)
                const endDate = new Date(year, month + 1, 0, 23, 59, 59);

                dateFilter = {
                    gte: startDate,
                    lte: endDate
                };
            }

            // 2. Query Database
            const rawHistory = await prisma.transaksi.findMany({
                where: {
                    id_siswa: siswaId!,
                    ...(bulan && { tanggal: dateFilter }) // Terapkan filter hanya jika bulan diisi
                },
                include: {
                    stan: {
                        select: { nama_stan: true }
                    },
                    detail_transaksi: {
                        include: {
                            menu: { select: { nama_makanan: true, foto: true } }
                        }
                    }
                },
                orderBy: {
                    tanggal: 'desc' // Yang terbaru di atas
                }
            });

            // 3. Format Data & Hitung Total Bayar
            // Karena total harga tidak disimpan di tabel header Transaksi, kita hitung on-the-fly
            const history = rawHistory.map((trx) => {
                const totalBayar = trx.detail_transaksi.reduce((sum, detail) => {
                    return sum + (detail.harga_beli * detail.qty);
                }, 0);

                return {
                    id_transaksi: trx.id,
                    tanggal: trx.tanggal,
                    status: trx.status,
                    nama_stan: trx.stan.nama_stan,
                    total_bayar: totalBayar, // Hasil kalkulasi
                    items: trx.detail_transaksi.map(d => ({
                        nama_menu: d.menu.nama_makanan,
                        foto: d.menu.foto, // Agar frontend bisa tampilkan thumbnail
                        qty: d.qty,
                        harga_satuan: d.harga_beli,
                        subtotal: d.harga_beli * d.qty
                    }))
                };
            });

            res.json({
                message: "Histori transaksi berhasil diambil",
                filter: {
                    bulan: bulan || "Semua",
                    tahun: tahun || "Semua"
                },
                data: history
            });

        } catch (error: any) {
            res.status(500).json({ message: "Gagal mengambil histori", error: error.message });
        }
    },
    // GET HISTORY STAN (Untuk Staff Kantin)
    getHistoryStan: async (req: Request, res: Response) => {
        const stanId = req.user?.stanId; // ID Stan dari token login staff
        const { bulan, tahun } = req.query;

        try {
            // 1. Logika Filter Tanggal (Sama seperti siswa)
            let dateFilter = {};
            if (bulan) {
                const year = tahun ? Number(tahun) : new Date().getFullYear();
                const month = Number(bulan) - 1;
                
                const startDate = new Date(year, month, 1);
                const endDate = new Date(year, month + 1, 0, 23, 59, 59);

                dateFilter = {
                    gte: startDate,
                    lte: endDate
                };
            }

            // 2. Query Database
            const rawHistory = await prisma.transaksi.findMany({
                where: {
                    id_stan: stanId!, // KUNCI: Hanya ambil data stan ini
                    ...(bulan && { tanggal: dateFilter }) 
                },
                include: {
                    siswa: { // Staff butuh tahu siapa pemesannya
                        select: { nama_siswa: true, nis: true }
                    },
                    detail_transaksi: {
                        include: {
                            menu: { select: { nama_makanan: true } }
                        }
                    }
                },
                orderBy: {
                    tanggal: 'desc'
                }
            });

            // 3. Format Data & Hitung Pendapatan
            let totalPendapatanBulanIni = 0;

            const history = rawHistory.map((trx) => {
                const totalTransaksi = trx.detail_transaksi.reduce((sum, detail) => {
                    return sum + (detail.harga_beli * detail.qty);
                }, 0);

                // Akumulasi pendapatan total (hanya jika status sudah selesai/dibayar, opsional)
                // Di sini kita hitung semua transaksi yang masuk
                totalPendapatanBulanIni += totalTransaksi;

                return {
                    id_transaksi: trx.id,
                    tanggal: trx.tanggal,
                    pemesan: trx.siswa.nama_siswa, // Info untuk staff
                    nis_pemesan: trx.siswa.nis,
                    status: trx.status,
                    total_bayar: totalTransaksi,
                    items: trx.detail_transaksi.map(d => ({
                        nama_menu: d.menu.nama_makanan,
                        qty: d.qty,
                        harga_satuan: d.harga_beli
                    }))
                };
            });

            res.json({
                message: "Data penjualan stan berhasil diambil",
                filter: {
                    bulan: bulan || "Semua",
                    tahun: tahun || "Semua"
                },
                summary: {
                    total_transaksi: history.length,
                    total_pendapatan: totalPendapatanBulanIni // Ringkasan omzet
                },
                data: history
            });

        } catch (error: any) {
            res.status(500).json({ message: "Gagal mengambil histori penjualan", error: error.message });
        }
    },
    // UPDATE PESANAN (Hanya jika belum dikonfirmasi)
    updateTransaksi: async (req: Request, res: Response) => {
        const { id } = req.params; // ID Transaksi
        const { items } = req.body; // Array menu baru [{id_menu, qty}, ...]
        const id_siswa = req.user?.siswaId;
        const today = new Date();

        // Validasi input item (bisa pakai schema items checkout)
        const { error, value } = validatorSchema.checkoutSchema.validate(req.body);
        if (error) return res.status(400).json({ message: error.details[0]!.message });

        try {
            const result = await prisma.$transaction(async (tx) => {
                // 1. Ambil data transaksi lama
                const transaksi = await tx.transaksi.findUnique({
                    where: { id: Number(id) }
                });

                // 2. Validasi Keamanan & Status
                if (!transaksi) throw new Error("TRANSAKSI_NOT_FOUND");

                // Pastikan yang ubah adalah pemilik pesanan
                if (transaksi.id_siswa !== id_siswa) throw new Error("UNAUTHORIZED");

                // INI LOGIKA UTAMANYA: Cek Status
                if (transaksi.status !== 'belum_dikonfirm') {
                    throw new Error("STATUS_LOCKED"); // Tidak boleh ubah jika sudah diproses
                }

                // 3. Hapus Detail Lama (Wipe)
                await tx.detail_transaksi.deleteMany({
                    where: { id_transaksi: Number(id) }
                });

                // 4. Hitung Ulang Detail Baru (Replace)
                let totalBayar = 0;
                const newDetailData = [];

                for (const item of items) {
                    // Ambil detail menu & Cek Diskon (Sama persis dengan logic checkout)
                    const menu = await tx.menu.findUnique({
                        where: { id: item.id_menu },
                        include: {
                            menu_diskon: {
                                where: {
                                    diskon: {
                                        tanggal_awal: { lte: today },
                                        tanggal_akhir: { gte: today }
                                    }
                                },
                                include: { diskon: true }
                            }
                        }
                    });

                    if (!menu) throw new Error(`Menu ID ${item.id_menu} tidak ditemukan`);

                    // Validasi: Menu baru harus dari Stan yang SAMA dengan transaksi awal
                    if (menu.id_stan !== transaksi.id_stan) {
                        throw new Error(`Menu ${menu.nama_makanan} bukan dari stan ini. Buat pesanan baru untuk stan lain.`);
                    }

                    // Hitung Harga + Diskon
                    let hargaFinal = menu.harga;
                    if (menu.menu_diskon.length > 0) {
                        const diskon = menu.menu_diskon[0]!.diskon;
                        const potongan = (menu.harga * diskon.persentase_diskon) / 100;
                        hargaFinal = menu.harga - potongan;
                    }

                    totalBayar += hargaFinal * item.qty;

                    newDetailData.push({
                        id_transaksi: transaksi.id,
                        id_menu: item.id_menu,
                        qty: item.qty,
                        harga_beli: hargaFinal
                    });
                }

                // 5. Masukkan Detail Baru
                await tx.detail_transaksi.createMany({
                    data: newDetailData
                });

                // Opsional: Update tanggal transaksi jadi "terakhir diedit"
                // await tx.transaksi.update({ where: { id: Number(id) }, data: { tanggal: new Date() } });

                return {
                    id_transaksi: transaksi.id,
                    total_baru: totalBayar,
                    items: newDetailData
                };
            });

            res.json({ message: "Pesanan berhasil diperbarui", data: result });

        } catch (error: any) {
            if (error.message === "STATUS_LOCKED") {
                return res.status(400).json({ message: "Pesanan sudah diproses atau dimasak, tidak bisa diubah lagi." });
            }
            if (error.message === "UNAUTHORIZED") {
                return res.status(403).json({ message: "Ini bukan pesanan Anda" });
            }
            res.status(500).json({ message: "Gagal update pesanan", error: error.message });
        }
    },
    // DELETE TRANSAKSI (Batalkan Pesanan)
    deleteTransaksi: async (req: Request, res: Response) => {
        const { id } = req.params;
        const id_siswa = req.user?.siswaId; // Dari token login siswa

        try {
            await prisma.$transaction(async (tx) => {
                // 1. Cek keberadaan transaksi
                const transaksi = await tx.transaksi.findUnique({
                    where: { id: Number(id) }
                });

                if (!transaksi) throw new Error("NOT_FOUND");

                // 2. Cek Kepemilikan (Hanya pemilik yang boleh hapus)
                if (transaksi.id_siswa !== id_siswa) {
                    throw new Error("UNAUTHORIZED");
                }

                // 3. Cek Status (Inti Logika)
                // Jika sudah diproses (dimasak/diantar/sampai), tidak boleh dihapus
                if (transaksi.status !== 'belum_dikonfirm') {
                    throw new Error("STATUS_LOCKED");
                }

                // 4. Hapus Detail Transaksi Terlebih Dahulu
                // Wajib dilakukan karena foreign key constraint
                await tx.detail_transaksi.deleteMany({
                    where: { id_transaksi: Number(id) }
                });

                // 5. Hapus Header Transaksi
                await tx.transaksi.delete({
                    where: { id: Number(id) }
                });
            });

            res.json({ message: "Pesanan berhasil dibatalkan dan dihapus" });

        } catch (error: any) {
            if (error.message === "NOT_FOUND") {
                return res.status(404).json({ message: "Transaksi tidak ditemukan" });
            }
            if (error.message === "UNAUTHORIZED") {
                return res.status(403).json({ message: "Anda tidak berhak menghapus pesanan ini" });
            }
            if (error.message === "STATUS_LOCKED") {
                return res.status(400).json({
                    message: "Pesanan tidak bisa dibatalkan karena sudah diproses oleh kantin"
                });
            }
            res.status(500).json({ message: "Gagal membatalkan pesanan", error: error.message });
        }
    },
    // 7. Update Status (Untuk Staff Kantin)
    updateStatus: async (req: Request, res: Response) => {
        const { id } = req.params;
        const { status } = req.body; // enum: belum_dikonfirm, dimasak, diantar, sampai

        try {
            const transaksi = await prisma.transaksi.findUnique({ where: { id: Number(id) } });

            if (!transaksi) return res.status(404).json({ message: "Transaksi tidak ditemukan" });

            // Pastikan staff hanya bisa update stan miliknya sendiri
            if (req.user?.role === 'staff_kantin' && transaksi.id_stan !== req.user.stanId) {
                return res.status(403).json({ message: "Bukan otoritas stan Anda" });
            }

            const updated = await prisma.transaksi.update({
                where: { id: Number(id) },
                data: { status }
            });

            res.json({ message: `Status diperbarui menjadi ${status}`, data: updated });
        } catch (error) {
            res.status(500).json({ message: "Gagal update status" });
        }
    },
    // CETAK NOTA / BUKTI PEMESANAN
    generateNota: async (req: Request, res: Response) => {
        const { id } = req.params;
        const id_siswa = req.user?.siswaId;

        try {
            // 1. Ambil Data Transaksi
            const transaksi = await prisma.transaksi.findUnique({
                where: { id: Number(id) },
                include: {
                    stan: true,
                    siswa: true,
                    detail_transaksi: {
                        include: { menu: true }
                    }
                }
            });

            // 2. Validasi
            if (!transaksi) return res.status(404).json({ message: "Transaksi tidak ditemukan" });
            if (transaksi.id_siswa !== id_siswa) return res.status(403).json({ message: "Akses ditolak" });

            // 3. Setup PDF Stream
            const doc = new PDFDocument({ size: 'A5', margin: 50 }); // Ukuran A5 cukup untuk nota

            // Set Header agar browser tahu ini adalah file PDF untuk didownload
            const filename = `Nota-${transaksi.id}-${transaksi.siswa.nis}.pdf`;
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

            // Pipe PDF langsung ke Response
            doc.pipe(res);

            // ================= DESAIN NOTA =================

            // -- HEADER --
            doc.fontSize(20).text('KANTIN SEKOLAH', { align: 'center' });
            doc.fontSize(12).text('Bukti Pemesanan Digital', { align: 'center' });
            doc.moveDown();
            doc.moveTo(50, doc.y).lineTo(370, doc.y).stroke(); // Garis pemisah
            doc.moveDown();

            // -- INFO TRANSAKSI --
            doc.fontSize(10);
            doc.text(`ID Transaksi : #${transaksi.id}`);
            doc.text(`Tanggal      : ${formatDate(transaksi.tanggal)}`);
            doc.text(`Pemesan      : ${transaksi.siswa.nama_siswa} (${transaksi.siswa.nis})`);
            doc.text(`Stan Tujuan  : ${transaksi.stan.nama_stan}`);
            doc.text(`Status       : ${transaksi.status.toUpperCase()}`);
            doc.moveDown();

            // -- TABEL ITEM --
            // Kita buat tabel sederhana menggunakan koordinat X
            const tableTop = doc.y;
            const itemX = 50;
            const qtyX = 230;
            const priceX = 280;

            // Fungsi Helper untuk Gambar Header Tabel (Biar bisa dipanggil ulang saat ganti halaman)
            const drawTableHeader = (y: number) => {
                doc.font('Helvetica-Bold');
                doc.text('Menu', itemX, y);
                doc.text('Qty', qtyX, y);
                doc.text('Total', priceX, y);
                doc.moveTo(50, y + 15).lineTo(370, y + 15).stroke();
            };

            drawTableHeader(doc.y); // Gambar header pertama kali

            let y = tableTop + 20;
            let totalBayar = 0;

            doc.font('Helvetica');

            // Loop Item
            transaksi.detail_transaksi.forEach(item => {
                const subtotal = item.harga_beli * item.qty;
                totalBayar += subtotal;

                // === PERBAIKAN DI SINI: LOGIKA GANTI HALAMAN ===
                // Tinggi kertas A5 itu sekitar 595 point. Kita beri batas aman di 500.
                if (y > 500) {
                    doc.addPage({ size: 'A5', margin: 50 }); // Buat halaman baru
                    y = 50; // Reset posisi Y ke atas
                    drawTableHeader(y); // Gambar ulang header tabel di halaman baru
                    y += 25; // Geser ke bawah sedikit untuk item pertama
                    doc.font('Helvetica'); // Pastikan font kembali normal
                }
                // ===============================================

                doc.text(item.menu.nama_makanan, itemX, y, { width: 170 });
                doc.text(item.qty.toString(), qtyX, y);
                doc.text(formatCurrency(subtotal), priceX, y);

                y += 20; // Pindah baris
            });

            // Garis Total
            doc.moveTo(50, y).lineTo(370, y).stroke();
            y += 10;

            // -- TOTAL --
            doc.font('Helvetica-Bold').fontSize(12);
            doc.text('TOTAL BAYAR', itemX, y);
            doc.text(formatCurrency(totalBayar), priceX, y);

            // -- FOOTER --
            doc.moveDown(4);
            doc.fontSize(10).font('Helvetica-Oblique');
            doc.text('Harap tunjukkan nota ini saat mengambil pesanan.', { align: 'center' });
            doc.text('Terima kasih!', { align: 'center' });

            // Finalize PDF
            doc.end();

        } catch (error) {
            // Jika error terjadi SEBELUM pipe, kita bisa kirim JSON error.
            // Tapi jika sudah pipe, stream akan putus.
            console.error(error);
            if (!res.headersSent) {
                res.status(500).json({ message: "Gagal mencetak nota" });
            }
        }
    },
};