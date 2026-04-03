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

const app = express();
const PORT = Number(process.env.PORT) || 10000;

// Render butuh ini agar tidak restart terus (Health Check)
app.get('/', (req, res) => {
    res.status(200).send('BOT ACTIVE');
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 Server aktif di port ${PORT}`);
});

async function startBot() {
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
        browser: ["TerminalLama", "Desktop", "1.0.0"],
    });

    if (!sock.authState.creds.registered) {
        const phoneNumber = process.env.WA_NUMBER;
        // Jeda agak lama agar stabil
        setTimeout(async () => {
            try {
                const code = await sock.requestPairingCode(phoneNumber!);
                console.log(`\n🔥 KODE PAIRING ANDA: ${code}\n`);
            } catch (err) {
                console.log("❌ Gagal request code (Spam Limit)");
            }
        }, 20000); 
    }

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "close") {
            const shouldReconnect = (lastDisconnect?.error as any)?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) setTimeout(() => startBot(), 10000);
        } else if (connection === "open") {
            console.log("✅ KONEKSI BERHASIL!");
        }
    });
}

startBot();
