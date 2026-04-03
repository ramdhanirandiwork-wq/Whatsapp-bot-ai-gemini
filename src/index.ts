process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

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

// ================== CONFIG ==================
const OWNER_NUMBER = "6283109862325@s.whatsapp.net";

// ================== EXPRESS (FIX RENDER PORT) ==================
const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.get("/", (req, res) => {
    res.status(200).send("Bot WhatsApp Gemini Online ✅");
});

app.listen(PORT, "0.0.0.0", () => {
    console.log(`🌐 Server running on port ${PORT}`);
});

// 🔥 KEEP ALIVE (ANTI SLEEP)
setInterval(() => {
    console.log("🟢 KEEP ALIVE...");
}, 25000);

// ================== GEMINI ==================
const genAI = new GoogleGenerativeAI(process.env.API_KEY!);
const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash"
});

// ================== START BOT ==================
async function startBot() {
    console.log("🚀 Memulai bot...");

    const { state, saveCreds } = await useMultiFileAuthState("auth");
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" }))
        },
        printQRInTerminal: false,
        logger: pino({ level: "silent" }),
        browser: ["Ubuntu", "Chrome", "20.0.0"]
    });

    // ================== PAIRING CEPAT ==================
    if (!sock.authState.creds.registered) {
        const phoneNumber = process.env.WA_NUMBER;

        if (phoneNumber) {
            try {
                console.log(`⚡ REQUEST PAIRING: ${phoneNumber}`);

                const code = await sock.requestPairingCode(phoneNumber);

                console.log("\n===============================");
                console.log(`🔥 PAIRING CODE: ${code}`);
                console.log("⚠️ MASUKKAN KE WHATSAPP (<=20 DETIK)");
                console.log("===============================\n");

            } catch (err) {
                console.error("❌ Pairing gagal:", err);
            }
        }
    }

    // ================== SAVE SESSION ==================
    sock.ev.on("creds.update", saveCreds);

    // ================== MESSAGE HANDLER ==================
    sock.ev.on("messages.upsert", async ({ messages }) => {
        const msg: WAMessage = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const jid = msg.key.remoteJid!;
        const text =
            msg.message.conversation ||
            msg.message.extendedTextMessage?.text;

        if (!text) return;

        try {
            // COMMAND
            if (text.toLowerCase() === "p" || text.toLowerCase() === "cek stok") {
                await sock.sendMessage(jid, {
                    text: "STOCK LAPORAN KAYAME FOOD\nSilakan input laporan hari ini:"
                });
                return;
            }

            await sock.sendPresenceUpdate("composing", jid);

            const result = await model.generateContent(text);
            const reply = result.response.text();

            await sock.sendMessage(jid, { text: reply }, { quoted: msg });

        } catch (err: any) {
            console.error("❌ Error:", err);

            await sock.sendMessage(OWNER_NUMBER, {
                text: `⚠️ ERROR BOT:\n${err.message}`
            });
        }
    });

    // ================== CONNECTION HANDLER ==================
    sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === "close") {
            const statusCode =
                (lastDisconnect?.error as any)?.output?.statusCode ||
                (lastDisconnect?.error as any)?.statusCode;

            console.log("❌ Disconnect:", statusCode);

            if (statusCode !== DisconnectReason.loggedOut) {
                console.log("🔄 Reconnecting...");
                setTimeout(() => startBot(), 3000);
            } else {
                console.log("⛔ Logout, perlu pairing ulang");
            }
        }

        if (connection === "open") {
            console.log("✅ BOT TERHUBUNG!");

            await sock.sendMessage(OWNER_NUMBER, {
                text: "🚀 Bot WhatsApp Gemini aktif & sudah connect!"
            });
        }
    });
}

// ================== RUN ==================
startBot().catch(err => console.error("FATAL ERROR:", err));
