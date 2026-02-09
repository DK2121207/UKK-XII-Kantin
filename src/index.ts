import dotenv from 'dotenv';
dotenv.config()
import express, { Request, Response, Express } from "express"
import cors from 'cors';
import helmet from "helmet";
import compression from 'compression'

import authRoute from './routes/auth.route';
import stanRoute from './routes/stan.route';
import siswaRoute from './routes/siswa.route';
import staffRoute from './routes/staff.route';
import menuRoute from './routes/menu.route';
import diskonRoute from './routes/diskon.route';
import transaksiRoute from './routes/transaksi.route';


const app: Express = express()
const PORT = process.env.APP_PORT || 1207

app.use(helmet())
app.use(compression())
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({extended:true}))

// app.use('/uploads', e.static(path.join(__dirname, '../uploads')));

app.get('/', (req: Request, res: Response) => {
    res.send({
        message: 'Selamat datang di API Kantin Sekolah',
        status: 'Server Ready 🚀',
        timestamp: new Date()
    });
})

app.use('/api/auth', authRoute);
app.use('/api/stan', stanRoute);
app.use('/api/siswa', siswaRoute);
app.use('/api/staff', staffRoute);
app.use('/api/menu', menuRoute);
app.use('/api/diskon', diskonRoute);
app.use('/api/transaksi', transaksiRoute);

app.use((req: Request, res: Response) => {
    res.status(404).json({
        message: 'Route tidak ditemukan!',
        path: req.originalUrl
    });
});

// Vercel membutuhkan export default app
// Kita hanya menjalankan app.listen jika TIDAK di environment Vercel
if (!process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log(`
        🚀 Server listening on port: ${PORT} 🚀
        `);
    });
}

// Export default app agar Vercel bisa menjalankannya sebagai Serverless Function
export default app;