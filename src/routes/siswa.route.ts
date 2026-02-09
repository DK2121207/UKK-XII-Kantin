import { Router } from "express";
import { user_controller } from "../controllers/siswa.controller";
import { validateResource, validatorSchema } from "../middlewares/validate";
import auth from '../middlewares/auth'
import { upload } from "../config/multer.config";

const siswaRoute = Router()

siswaRoute.put('/:id', auth.authMiddleware, auth.authorizeRole('admin', 'siswa'), upload.single('foto'), user_controller.updateSiswa)
siswaRoute.delete('/:id', auth.authMiddleware, auth.authorizeRole('admin'), user_controller.softDeleteSiswa)

export default siswaRoute