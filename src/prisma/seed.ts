import { prisma } from '../lib/prisma';
import bcrypt from 'bcryptjs';

async function main() {
    // 1. Definisikan Data Admin
    const adminEmail = 'admin@sekolah.id';
    const adminPassword = 'adminpassword123'; // Ganti dengan password yang kuat!
    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    // 2. Gunakan upsert (Update or Insert)
    // Jika admin sudah ada, tidak lakukan apa-apa. Jika belum, buat baru.
    const admin = await prisma.user.upsert({
        where: { email: adminEmail },
        update: {}, // Tidak ada yang diupdate jika sudah ada
        create: {
            username: 'Super Admin',
            email: adminEmail,
            password: hashedPassword,
            role: 'admin',
            is_active: true
        },
    });

    console.log(`✅ Admin user seeded: ${admin.email}`);

    // (Opsional) Kamu juga bisa sekalian buat data dummy Stan atau Menu di sini
}

main()
    .then(async () => {
        await prisma.$disconnect()
    })
    .catch(async (e) => {
        console.error(e)
        await prisma.$disconnect()
        process.exit(1)
    })