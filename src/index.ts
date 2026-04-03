import makeWASocket, { 
    DisconnectReason, 
    useMultiFileAuthState, 
    fetchLatestBaileysVersion, 
    makeCacheableSignalKeyStore 
} from "@whiskeysockets/baileys";
import pino from "pino";
import express from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import "dotenv/config";

// 1. Web Server Minimal agar Render tidak mematikan aplikasi (Anti-Idle)
const app = express();
app.get('/', (req, res) => res.send('Bot is Running!'));
app.listen(process.env.PORT || 3000, () => console.log("Server Express Aktif"));

const genAI = new GoogleGenerativeAI(process.env.API_KEY!);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

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
        browser: ["Ubuntu", "Chrome", "20.0.04"],
    });

    // 2. Logic Pairing Code yang Stabil
    if (!sock.authState.creds.registered) {
        const phoneNumber = process.env.WA_NUMBER;
        if (!phoneNumber) {
            console.error("❌ WA_NUMBER tidak ada di .env!");
            return;
        }

        // Beri jeda 5 detik agar socket benar-benar stabil sebelum minta code
        setTimeout(async () => {
            try {
                let code = await sock.requestPairingCode(phoneNumber);
                code = code?.match(/.{1,4}/g)?.join("-") || code;
                console.log("\n========================================");
                console.log(`🔥 PAIRING CODE: ${code}`);
                console.log("========================================\n");
            } catch (err) {
                console.error("Gagal ambil pairing code, coba restart.");
            }
        }, 5000);
    }

    sock.ev.on("creds.update", saveCreds);

    // 3. Handler Pesan Gemini
    sock.ev.on("messages.upsert", async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const jid = msg.key.remoteJid!;
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text;
        if (!text) return;

        try {
            const result = await model.generateContent(text);
            await sock.sendMessage(jid, { text: result.response.text() }, { quoted: msg });
        } catch (e) {
            console.log("AI Error");
        }
    });

    // 4. Handler Koneksi (Anti-Reconnect Loop saat Pairing)
    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === "close") {
            const error = (lastDisconnect?.error as any);
            const statusCode = error?.output?.statusCode || error?.statusCode;

            console.log("❌ Koneksi terputus, status:", statusCode);

            // JANGAN RECONNECT jika sedang proses pairing atau jika logout
            if (statusCode === DisconnectReason.loggedOut || !state.creds.registered) {
                console.log("⛔ Reconnect dihentikan (Sedang pairing/Logout)");
                return;
            }

            // Reconnect untuk error lain (network/timeout)
            setTimeout(() => startBot(), 5000);
        } else if (connection === "open") {
            console.log("✅ BOT BERHASIL TERHUBUNG!");
        }
    });
}

startBot();
