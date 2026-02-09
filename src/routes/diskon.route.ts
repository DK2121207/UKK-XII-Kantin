import { Router } from "express";
import { diskonController } from "../controllers/diskon.controller";
import auth from "../middlewares/auth";

const router = Router();

// Endpoint Publik (Siswa mau lihat promo hari ini)
router.get("/active", diskonController.getDiscountedMenus);

// Endpoint Admin/Staff
router.use(auth.authMiddleware, auth.authorizeRole('admin', 'staff_kantin'));

router.post("/", diskonController.createDiskon); // Buat Master Diskon
router.post("/assign", diskonController.addMenuToDiskon); // Tempel Diskon ke Menu
router.delete("/assign/:id_diskon/:id_menu", diskonController.removeMenuFromDiskon); // Hapus Diskon dari Menu
router.put("/:id", diskonController.updateDiskon);
router.delete("/:id", diskonController.deleteDiskon);

export default router;