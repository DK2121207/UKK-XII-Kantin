import { Request, Response, NextFunction } from 'express';
import Joi, { object, Schema } from "joi";
import { Jenis, Role, Status } from '../generated/prisma/enums'



export const validatorSchema = {

    userSchema: Joi.object({
        username: Joi.string().alphanum().max(100).required(),
        password: Joi.string().min(5).max(100).required(),
        role: Joi.string().valid(...Object.values(Role)).required()
    }),

    diskonSchema: Joi.object({
        nama_diskon: Joi.string().max(100).required(),
        persentase_diskon: Joi.number().min(1).max(100).required(), // 1% - 100%
        tanggal_awal: Joi.date().required(),
        tanggal_akhir: Joi.date().min(Joi.ref('tanggal_awal')).required() // Akhir tidak boleh sebelum Awal
    }),

    transaksiSchema: Joi.object({
        id_stan: Joi.number().required(),
        id_siswa: Joi.number().required(),
        status: Joi.string().valid(...Object.values(Status)).default(Status.belum_dikonfirm).required(),
    }),

    siswaSchema: Joi.object({
        nis: Joi.string().max(255).required(),
        nama_siswa: Joi.string().max(100).required(),
        alamat: Joi.string().required(),
        telp: Joi.string().max(20).required(),
        foto: Joi.string().max(255).required(),
    }).keys({
        password: Joi.string().min(5).max(100).required(),
    }),
    updateSiswaSchema: Joi.object({
        nis: Joi.string().max(255).required(),
        nama_siswa: Joi.string().max(100).required(),
        alamat: Joi.string().required(),
        telp: Joi.string().max(20).required(),
        foto: Joi.string().max(255).required(),
    }).keys({
        password: Joi.string().min(5).max(100).required(),
    }),

    menuSchema: Joi.object({
        nama_makanan: Joi.string().max(100).required(),
        harga: Joi.number().required(),
        jenis: Joi.string().valid(...Object.values(Jenis)).required(),
        deskripsi: Joi.string().required(),
        id_stan: Joi.number().optional(),
    }),

    stanSchema: Joi.object({
        nama_stan: Joi.string().max(100).required(),
    }),

    menu_diskonSchema: Joi.object({
        id_menu: Joi.number().required(),
        id_diskon: Joi.number().required(),
    }),

    // detail_transaksiSchema: Joi.object({
    //     id_transaksi: Joi.number(),
    //     id_menu: Joi.number(),
    //     qty: Joi.number(),
    //     harga_beli: Joi.number(),
    // }),
    registerSiswa: Joi.object({
        nis: Joi.string().required(),
        nama_siswa: Joi.string().required(),
        email: Joi.string().email().required(),
        alamat: Joi.string().required(),
        telp: Joi.string().required(),
        password: Joi.string().min(6).required(),
        // Foto ditangani multer, tidak perlu validasi string di sini
    }),

    // REGISTRASI STAFF (Wajib ID Stan)
    registerStaff: Joi.object({
        nama_staff: Joi.string().required(),
        email: Joi.string().email().required(),
        alamat: Joi.string().required(),
        telp: Joi.string().required(),
        id_stan: Joi.number().required(), // Penempatan kerja
        password: Joi.string().min(6).required()
    }),
    loginSiswaSchema: Joi.object({
        nis: Joi.string().max(255).required(),
        password: Joi.string().max(100).required(),
        rememberMe: Joi.boolean().optional()
    }),
    loginStaffSchema: Joi.object({
        email: Joi.string().email().required(),
        password: Joi.string().max(100).required(),
        rememberMe: Joi.boolean().optional()
    }),
    addMenuToDiskonSchema: Joi.object({
        id_diskon: Joi.number().required(),
        menu_ids: Joi.array().items(Joi.number()).min(1).required() // Array ID Menu [1, 2, 5]
    }),
    checkoutSchema: Joi.object({
        id_stan: Joi.number().required(),
        items: Joi.array().items(
            Joi.object({
                id_menu: Joi.number().required(),
                qty: Joi.number().min(1).required()
            })
        ).min(1).required()
    }),
}

export const validateResource = (schema: Schema) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const { error, value } = schema.validate(req.body, {
            stripUnknown: true,
            abortEarly: false // Menampilkan semua error sekaligus jika ada banyak
        });

        if (error) {
            return res.status(400).json({
                message: 'Validasi gagal',
                errors: error.details.map(detail => detail.message)
            });
        }

        // Timpa req.body dengan hasil validasi yang sudah bersih & ada nilai default
        req.body = value;
        next();
    };
};