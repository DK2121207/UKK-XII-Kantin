import dotenv from 'dotenv';
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || '';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '';
const JWT_EXPIRES_IN_OPT = process.env.JWT_EXPIRES_IN_OPT || '';

if (JWT_SECRET === '' || JWT_EXPIRES_IN === '' || JWT_EXPIRES_IN_OPT === '') {
    // Aplikasi berhenti di sini jika kunci rahasia tidak ada
    throw new Error("FATAL ERROR: env is not defined.");
}

export { JWT_SECRET, JWT_EXPIRES_IN, JWT_EXPIRES_IN_OPT };