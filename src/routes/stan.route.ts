import { Router } from "express";
import { stanController } from "../controllers/stan.controller";
import auth from "../middlewares/auth";

const stanRoute = Router();

// Semua rute di bawah ini wajib Admin
stanRoute.use(auth.authMiddleware, auth.authorizeRole('admin'));

stanRoute.post("/", stanController.createStan);
stanRoute.get("/", stanController.getAllStan);
stanRoute.put("/:id", stanController.updateStan);
stanRoute.delete("/:id", stanController.deleteStan);

export default stanRoute;