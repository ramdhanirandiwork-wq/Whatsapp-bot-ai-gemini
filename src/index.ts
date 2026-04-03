import makeWASocket, { 
    DisconnectReason, 
    useMultiFileAuthState, 
    fetchLatestBaileysVersion, 
    makeCacheableSignalKeyStore 
} from "@whiskeysockets/baileys";
import pino from "pino";
import express from "express";
import "dotenv/config";

// --- FIX PORT DETECTION ---
const app = express();
const PORT = parseInt(process.env.PORT || "10000", 10); // Pastikan jadi angka

app.get('/', (req, res) => res.status(200).send('BOT_READY'));

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 Server berjalan stabil di port ${PORT}`);
});

async function startBot() {
    // Gunakan folder baru agar sesi benar-benar segar
    const { state, saveCreds } = await useMultiFileAuthState("auth_session_final");
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
        },
        printQRInTerminal: false,
        logger: pino({ level: "silent" }),
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        connectTimeoutMs: 60000,
    });

    if (!sock.authState.creds.registered) {
        const phoneNumber = process.env.WA_NUMBER;
        
        // Jeda 10 detik agar Render benar-atstabil
        setTimeout(async () => {
            try {
                const code = await sock.requestPairingCode(phoneNumber!);
                console.log(`\n========================================`);
                console.log(`🔥 KODE PAIRING: ${code}`);
                console.log(`========================================\n`);
            } catch (err) {
                console.log("❌ Gagal request kode. Tunggu 15 menit.");
            }
        }, 10000); 
    }

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "close") {
            const statusCode = (lastDisconnect?.error as any)?.output?.statusCode || (lastDisconnect?.error as any)?.statusCode;
            if (statusCode !== DisconnectReason.loggedOut) {
                setTimeout(() => startBot(), 5000);
            }
        } else if (connection === "open") {
            console.log("✅ BOT CONNECTED!");
        }
    });
}

startBot();
