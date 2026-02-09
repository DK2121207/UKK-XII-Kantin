import { Router } from "express";
import { authController } from "../controllers/auth.controller";
import { upload } from "../config/multer.config"; // Pastikan path multer benar

const authRoute = Router();

// Endpoint khusus siswa (NIS)
authRoute.post("/login/siswa", authController.loginSiswa);

// Endpoint khusus staff & admin (Username)
authRoute.post("/login/staff", authController.loginStaff);

// === REGISTER ===
// Registrasi Siswa (Biasanya public atau via admin)
authRoute.post("/register/siswa", upload.single("foto_siswa"), authController.registerSiswa);

// Registrasi Staff (Wajib menyertakan ID Stan)
authRoute.post("/register/staff", upload.single("foto_staff"), authController.registerStaff);

export default authRoute;