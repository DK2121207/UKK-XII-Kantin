import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME as string,
    api_key: process.env.CLOUDINARY_API_KEY as string,
    api_secret: process.env.CLOUDINARY_API_SECRET as string
});

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: async (req, file) => {
        // Tentukan folder berdasarkan "fieldname" (key di form-data)
        let folderName = 'kantin-sekolah/others'; // Default folder

        if (file.fieldname === 'foto_menu') {
            folderName = 'kantin-sekolah/menu';
        } else if (file.fieldname === 'foto_siswa') {
            folderName = 'kantin-sekolah/siswa';
        } else if (file.fieldname === 'foto_staff') {
            folderName = 'kantin-sekolah/staff';
        }

        return {
            folder: folderName, // <--- Folder dinamis
            allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
            public_id: file.originalname.split('.')[0] + "-" + Date.now(),
        };
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }
});

export { upload };