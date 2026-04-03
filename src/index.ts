import makeWASocket, { 
    DisconnectReason, 
    useMultiFileAuthState, 
    fetchLatestBaileysVersion, 
    makeCacheableSignalKeyStore,
    WAMessage
} from "@whiskeysockets/baileys";
import pino from "pino";
import express from "express";
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import "dotenv/config";

// --- 1. WEB SERVER ---
const app = express();
const PORT = Number(process.env.PORT) || 10000;
app.get('/', (req, res) => res.send('Terminal Lama Bot Status: Running ✅'));
app.listen(PORT, '0.0.0.0', () => console.log(`🌐 Server di port ${PORT}`));

// --- 2. CONFIG GEMINI ---
const genAI = new GoogleGenerativeAI(process.env.API_KEY || "");
const model = genAI.getGenerativeModel({ 
    model: "gemini-1.5-flash",
    systemInstruction: `You are the "STOCK OPNAME TERMINAL LAMA" Exclusive Inventory Assistant...`, // Persingkat di sini agar tidak berat
});

async function startBot() {
    console.log("🛠️ Memulai koneksi...");
    const { state, saveCreds } = await useMultiFileAuthState("auth");
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
        },
        printQRInTerminal: false,
        logger: pino({ level: "silent" }),
        browser: ["TerminalLama", "Chrome", "20.0.04"],
    });

    // PAIRING LOGIC: Jeda 15 detik saja (Standar)
    if (!sock.authState.creds.registered) {
        const phoneNumber = process.env.WA_NUMBER;
        console.log(`🕒 Menunggu 15 detik untuk memunculkan kode untuk nomor: ${phoneNumber}`);
        
        setTimeout(async () => {
            try {
                const code = await sock.requestPairingCode(phoneNumber!);
                console.log(`\n🔥 KODE PAIRING ANDA: ${code}\n`);
            } catch (err) {
                console.log("❌ WHATSAPP MENOLAK: Nomor Anda mungkin sedang kena limit/spam block. Tunggu 1 jam.");
            }
        }, 15000);
    }

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "close") {
            const statusCode = (lastDisconnect?.error as any)?.output?.statusCode || (lastDisconnect?.error as any)?.statusCode;
            console.log(`📡 Koneksi Terputus: Status ${statusCode}`);
            if (statusCode !== DisconnectReason.loggedOut) {
                setTimeout(() => startBot(), 10000);
            }
        } else if (connection === "open") {
            console.log("✅ BOT BERHASIL CONNECT!");
        }
    });
}

startBot();
