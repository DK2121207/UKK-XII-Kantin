import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { validatorSchema } from "../middlewares/validate";
import { JWT_SECRET, JWT_EXPIRES_IN, JWT_EXPIRES_IN_OPT } from "../config/env";
// import fs from 'fs'

export const authController = {
    // ===========================
    // REGISTER SISWA
    // ===========================
    // ===========================
    // REGISTER SISWA (Updated)
    // ===========================
    registerSiswa: async (req: Request, res: Response) => {
        // 1. Validasi Input
        const { error, value } = validatorSchema.registerSiswa.validate(req.body, { stripUnknown: true });
        
        if (error) {
            // if (req.file) fs.unlinkSync(req.file.path);
            return res.status(400).json({ message: error.details[0]?.message });
        }

        try {
            const result = await prisma.$transaction(async (tx) => {
                // 2. Cek Uniqueness (NIS, dan EMAIL)
                
                // Cek NIS (di tabel Siswa)
                const nisCheck = await tx.siswa.findUnique({ where: { nis: value.nis } });
                if (nisCheck) throw new Error("NIS_TAKEN");

                // Cek Email (di tabel User) <--- PENGECEKAN BARU
                const emailCheck = await tx.user.findUnique({ where: { email: value.email } });
                if (emailCheck) throw new Error("EMAIL_TAKEN");

                // 3. Buat Akun User (Simpan Email di sini)
                const newUser = await tx.user.create({
                    data: {
                        username: value.username,
                        email: value.email, // <--- SIMPAN EMAIL
                        password: await bcrypt.hash(value.password, 10),
                        role: 'siswa',
                        is_active: true
                    }
                });

                // 4. Buat Profil Siswa
                return await tx.siswa.create({
                    data: {
                        nis: value.nis,
                        nama_siswa: value.nama_siswa,
                        alamat: value.alamat,
                        telp: value.telp,
                        foto: req.file?.path || "",
                        id_user: newUser.id
                        // Email tidak perlu disimpan di tabel Siswa, cukup di tabel User saja
                    }
                });
            });

            res.status(201).json({ message: "Registrasi siswa berhasil", data: result });

        } catch (error: any) {
            // if (req.file) fs.unlinkSync(req.file.path);
            
            if (error.message === "NIS_TAKEN") return res.status(409).json({ message: "NIS sudah terdaftar" });
            if (error.message === "EMAIL_TAKEN") return res.status(409).json({ message: "Email sudah digunakan" }); // <--- Error Message
            
            res.status(500).json({ message: "Gagal registrasi siswa", error: error.message });
        }
    },

    // ===========================
    // REGISTER STAFF (Updated for Email Login)
    // ===========================
    registerStaff: async (req: Request, res: Response) => {
        const { error, value } = validatorSchema.registerStaff.validate(req.body, { stripUnknown: true });
        if (error) {
            // if (req.file) fs.unlinkSync(req.file.path);
            return res.status(400).json({ message: error.details[0]?.message });
        }

        try {
            const result = await prisma.$transaction(async (tx) => {
                // 1. Cek apakah Email sudah terdaftar di tabel USER
                const emailCheck = await tx.user.findUnique({ where: { email: value.email } });
                if (emailCheck) throw new Error("EMAIL_TAKEN");

                // 2. Cek Stan
                const stanCheck = await tx.stan.findUnique({ where: { id: Number(value.id_stan) } });
                if (!stanCheck) throw new Error("STAN_NOT_FOUND");

                // 3. Buat Akun User (Simpan Email di sini)
                const newUser = await tx.user.create({
                    data: {
                        username: value.nama_staff, // Username bisa diisi nama staff sebagai default
                        email: value.email,         // <--- KUNCI LOGIN
                        password: await bcrypt.hash(value.password, 10),
                        role: 'staff_kantin',
                        is_active: true
                    }
                });

                // 4. Buat Profil Staff
                return await tx.staff_kantin.create({
                    data: {
                        nama_staff: value.nama_staff,
                        alamat: value.alamat,
                        telp: value.telp,
                        foto: req.file?.path || "",
                        id_stan: Number(value.id_stan),
                        id_user: newUser.id
                        // Tidak perlu simpan email lagi di sini, hindari duplikasi data
                    }
                });
            });

            res.status(201).json({ message: "Registrasi staff berhasil", data: result });

        } catch (error: any) {
            // if (req.file) fs.unlinkSync(req.file.path);
            if (error.message === "EMAIL_TAKEN") return res.status(409).json({ message: "Email sudah digunakan" });
            // ... error handling lain
            res.status(500).json({ message: "Gagal registrasi", error: error.message });
        }
    },

    // ===========================
    // LOGIN SISWA (Via NIS)
    // ===========================
    loginSiswa: async (req: Request, res: Response) => {
        // 1. Validasi Input
        const { error, value } = validatorSchema.loginSiswaSchema.validate(req.body);
        if (error) return res.status(400).json({ message: error.details[0]?.message });

        try {
            // 2. Cari Siswa berdasarkan NIS & Include User-nya
            const siswa = await prisma.siswa.findUnique({
                where: { nis: value.nis },
                include: { user: true }
            });

            // 3. Cek apakah siswa ada & akun user aktif
            if (!siswa || !siswa.user || !siswa.user.is_active) {
                return res.status(401).json({ message: "NIS tidak ditemukan atau akun nonaktif" });
            }

            // 4. Cek Password
            const isPasswordValid = await bcrypt.compare(value.password, siswa.user.password);
            if (!isPasswordValid) {
                return res.status(401).json({ message: "Password salah" });
            }

            // 5. Generate Token (Payload Khusus Siswa)
            const duration = value.rememberMe ? '30d' : '1d'
            const secret = JWT_SECRET as string
            const token = jwt.sign({
                id: siswa.user.id,        // ID dari tabel User
                role: siswa.user.role,    // Role: 'siswa'
                siswaId: siswa.id,        // ID dari tabel Siswa (Penting untuk transaksi)
                nis: siswa.nis,
                nama: siswa.nama_siswa
            }, secret, { expiresIn: duration });

            return res.json({
                message: "Login siswa berhasil",
                token,
                user: {
                    id: siswa.id,
                    nama: siswa.nama_siswa,
                    role: 'siswa'
                }
            });

        } catch (error) {
            return res.status(500).json({ message: "Internal server error" });
        }
    },

    // ===========================
    // LOGIN STAFF (Updated for Email Login)
    // ===========================
    loginStaff: async (req: Request, res: Response) => {
        // 1. Validasi Input (Email & Password)
        const { error, value } = validatorSchema.loginStaffSchema.validate(req.body);
        if (error) return res.status(400).json({ message: error.details[0]?.message });

        try {
            // 2. Cari User berdasarkan EMAIL
            const user = await prisma.user.findUnique({
                where: { email: value.email } // <--- Cari pakai Email
            });

            // Cek user, aktif, dan role (Security check)
            if (!user || !user.is_active || !['admin', 'staff_kantin'].includes(user.role)) {
                return res.status(401).json({ message: "Email tidak ditemukan atau akses ditolak" });
            }

            // 3. Cek Password
            const isPasswordValid = await bcrypt.compare(value.password, user.password);
            if (!isPasswordValid) {
                return res.status(401).json({ message: "Password salah" });
            }

            // 4. Siapkan Payload Token
            let tokenPayload: any = {
                id: user.id,
                role: user.role,
                email: user.email // Ganti username jadi email di payload
            };

            // Ambil Info Stan jika dia Staff
            if (user.role === 'staff_kantin') {
                const staffData = await prisma.staff_kantin.findFirst({
                    where: { id_user: user.id },
                    include: { stan: true }
                });

                if (staffData) {
                    tokenPayload.staffId = staffData.id;
                    tokenPayload.stanId = staffData.id_stan;
                    tokenPayload.nama_stan = staffData.stan.nama_stan;
                }
            }

            // 5. Generate Token
            const secret = JWT_SECRET as string
            const duration = value.rememberMe ? '30d' : '1d'
            const token = jwt.sign(tokenPayload, secret, { expiresIn: duration });

            return res.json({
                message: "Login berhasil",
                token,
                user: {
                    id: user.id,
                    email: user.email,
                    role: user.role,
                    ...(user.role === 'staff_kantin' && { stanId: tokenPayload.stanId })
                }
            });

        } catch (error) {
            res.status(500).json({ message: "Internal server error" });
        }
    }
};