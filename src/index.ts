import makeWASocket, { 
    DisconnectReason, 
    useMultiFileAuthState, 
    fetchLatestBaileysVersion, 
    makeCacheableSignalKeyStore,
    WAMessage
} from "@whiskeysockets/baileys";
import pino from "pino";
import express from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import "dotenv/config";

const app = express();
const PORT = Number(process.env.PORT) || 10000;

// Respon instan agar Render tidak me-restart bot
app.get('/', (req, res) => res.status(200).send('BOT_READY'));

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 Server berjalan stabil di port ${PORT}`);
});

async function startBot() {
    // Gunakan folder auth yang berbeda untuk nomor baru agar bersih
    const { state, saveCreds } = await useMultiFileAuthState("auth_nomor_baru");
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
        },
        printQRInTerminal: false,
        logger: pino({ level: "silent" }),
        browser: ["TerminalLama", "Chrome", "1.0.0"],
        // Tambahkan ini agar koneksi tidak mudah putus saat pairing
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 0,
    });

    if (!sock.authState.creds.registered) {
        const phoneNumber = process.env.WA_NUMBER;
        
        // Jeda 15 detik saja agar tidak keduluan restart Render
        setTimeout(async () => {
            try {
                if (!sock.authState.creds.registered) {
                    const code = await sock.requestPairingCode(phoneNumber!);
                    console.log(`\n========================================`);
                    console.log(`🔥 KODE PAIRING AKTIF: ${code}`);
                    console.log(`========================================\n`);
                }
            } catch (err) {
                console.log("❌ Limit WhatsApp detect. Tunggu 15 menit.");
            }
        }, 15000);
    }

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "close") {
            const statusCode = (lastDisconnect?.error as any)?.output?.statusCode || (lastDisconnect?.error as any)?.statusCode;
            console.log(`📡 Koneksi Terputus (Status: ${statusCode}). Reconnecting...`);
            if (statusCode !== DisconnectReason.loggedOut) {
                setTimeout(() => startBot(), 5000);
            }
        } else if (connection === "open") {
            console.log("✅ BERHASIL TERHUBUNG!");
        }
    });
}

startBot();
