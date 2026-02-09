import { Router } from "express";
import { staffController } from "../controllers/staff_kantin.controller";
import auth from "../middlewares/auth";
import { upload } from "../config/multer.config";

const router = Router();
// 1. GET ALL STAFF
// Hanya Admin yang boleh melihat daftar semua pegawai
router.get("/", 
    auth.authMiddleware, 
    auth.authorizeRole('admin'), 
    staffController.getAllStaff
);

// 2. UPDATE STAFF
// Admin boleh edit siapa saja.
// Staff hanya boleh edit profilnya sendiri (Logic pengecekan ID ada di controller)
// Kita gunakan upload.single('foto_staff') sesuai config Multer dinamis
router.put("/:id", 
    auth.authMiddleware, 
    auth.authorizeRole('admin', 'staff_kantin'), 
    upload.single('foto_staff'), 
    staffController.updateStaff
);

// 3. DELETE STAFF
// Hanya Admin yang boleh memecat/menghapus staff (Soft Delete)
router.delete("/:id", 
    auth.authMiddleware, 
    auth.authorizeRole('admin'), 
    staffController.deleteStaff
);

export default router;