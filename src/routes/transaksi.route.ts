import { Router } from "express";
import { transaksiController } from "../controllers/transaksi.controller";
import auth from "../middlewares/auth";
import { prisma } from "../lib/prisma";

const transaksiRoute = Router();

// Siswa melakukan checkout
transaksiRoute.post("/checkout", auth.authMiddleware, auth.authorizeRole('siswa'), transaksiController.checkout);
// Siswa mengubah pesanan (selama belum dikonfirmasi)
transaksiRoute.put("/checkout/:id", auth.authMiddleware, auth.authorizeRole('siswa'), transaksiController.updateTransaksi);
// Siswa membatalkan pesanan (selama belum dikonfirmasi)
transaksiRoute.delete("/:id", auth.authMiddleware, auth.authorizeRole('siswa'), transaksiController.deleteTransaksi);

// Staff update status pesanan
transaksiRoute.put("/status/:id", auth.authMiddleware, auth.authorizeRole('staff_kantin'), transaksiController.updateStatus);

// Siswa melihat histori transaksinya
transaksiRoute.get("/history", 
    auth.authMiddleware, 
    auth.authorizeRole('siswa'), 
    transaksiController.getHistorySiswa
);

// Siswa mencetak nota (download PDF)
transaksiRoute.get("/nota/:id", 
    auth.authMiddleware, 
    auth.authorizeRole('siswa'), 
    transaksiController.generateNota
);

export default transaksiRoute;