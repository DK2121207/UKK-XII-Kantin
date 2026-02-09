import { Router } from "express";
import menuController from "../controllers/menu.controller";
import auth from "../middlewares/auth";
import { upload } from "../config/multer.config";

const menuRoute = Router();

// Publik/Siswa bisa melihat menu
menuRoute.get("/", menuController.getAllMenu);

// Hanya Staff Kantin dan Admin yang bisa kelola data
menuRoute.post("/", auth.authMiddleware, auth.authorizeRole('admin', 'staff_kantin'), upload.single("foto_menu"), menuController.createMenu);
menuRoute.put("/:id", auth.authMiddleware, auth.authorizeRole('admin', 'staff_kantin'), upload.single("foto_menu"), menuController.updateMenu);
menuRoute.delete("/:id", auth.authMiddleware, auth.authorizeRole('admin', 'staff_kantin'), menuController.deleteMenu);

export default menuRoute;