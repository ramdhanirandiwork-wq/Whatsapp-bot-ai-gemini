import makeWASocket, { 
    DisconnectReason, 
    useMultiFileAuthState, 
    fetchLatestBaileysVersion, 
    makeCacheableSignalKeyStore 
} from "@whiskeysockets/baileys";
import pino from "pino";
import express from "express";
import "dotenv/config";

const app = express();
const PORT = 10000;

// Agar Render tidak me-restart bot
app.get('/', (req, res) => res.status(200).send('BOT_READY'));
app.listen(PORT, '0.0.0.0', () => console.log(`🌐 Server di port ${PORT}`));

async function startBot() {
    // Pakai folder baru agar sesi benar-benar bersih
    const { state, saveCreds } = await useMultiFileAuthState("auth_final");
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
    });

    if (!sock.authState.creds.registered) {
        const phoneNumber = process.env.WA_NUMBER;
        // Jeda singkat saja agar tidak keduluan restart Render
        setTimeout(async () => {
            try {
                const code = await sock.requestPairingCode(phoneNumber!);
                console.log(`\n🔥 KODE PAIRING: ${code}\n`);
            } catch (err) {
                console.log("❌ Gagal request kode.");
            }
        }, 5000); 
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
            console.log("✅ BERHASIL TERHUBUNG!");
        }
    });
}

startBot();
