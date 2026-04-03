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

// --- 1. SETTING OWNER & SERVER ---
const OWNER_NUMBER = "6283109862325@s.whatsapp.net"; 
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => res.send('Bot Status: Online ✅'));
app.listen(PORT, () => console.log(`🌐 Server running on port ${PORT}`));

// --- 2. KONFIGURASI GEMINI ---
const genAI = new GoogleGenerativeAI(process.env.API_KEY!);
const model = genAI.getGenerativeModel({ 
    model: "gemini-1.5-flash",
    systemInstruction: `You are the "STOCK OPNAME TERMINAL LAMA" Assistant.
1. Respond ONLY with code blocks for reports.
2. Initial Trigger ("p" or "cek stok"): "STOCK LAPORAN KAYAME FOOD\nSilakan input Laporan Hari ini:"
3. Inventory Data: Chili Oil, Aluminium Foil, Mika, Cup, Sumpit, Gas, Keju, Plastik, Mamayo, dll.
4. Permanent Data: Dimsum 600, Saus Botol 4, Bolognes 2, Tar-tar 1.`
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
        browser: ["Ubuntu", "Chrome", "20.0.04"],
    });

    // --- 3. LOGIKA PAIRING ---
    if (!sock.authState.creds.registered) {
        const phoneNumber = process.env.WA_NUMBER;
        if (phoneNumber) {
            console.log(`⏳ Menyiapkan koneksi untuk nomor: ${phoneNumber}...`);
            setTimeout(async () => {
                try {
                    let code = await sock.requestPairingCode(phoneNumber);
                    console.log("\n========================================");
                    console.log(`🔥 CONNECT TO HP NO: ${phoneNumber}`);
                    console.log(`🔥 KODE PAIRING ANDA: ${code}`);
                    console.log("========================================\n");
                } catch (err) {
                    console.error("❌ Gagal pairing.");
                }
            }, 10000);
        }
    }

    sock.ev.on("creds.update", saveCreds);

    // --- 4. HANDLER PESAN ---
    sock.ev.on("messages.upsert", async ({ messages }) => {
        const msg: WAMessage = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const jid = msg.key.remoteJid!;
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text;
        if (!text) return;

        try {
            if (text.toLowerCase() === "p" || text.toLowerCase() === "cek stok") {
                await sock.sendMessage(jid, { text: "STOCK LAPORAN KAYAME FOOD\nSilakan input Laporan Hari ini:" });
                return;
            }

            await sock.sendPresenceUpdate("composing", jid);
            const result = await model.generateContent(text);
            await sock.sendMessage(jid, { text: result.response.text() }, { quoted: msg });

        } catch (error: any) {
            console.error("❌ Error:", error);
            await sock.sendMessage(OWNER_NUMBER, { text: `⚠️ *ERROR:* ${error.message}` });
        }
    });

    // --- 5. HANDLER KONEKSI ---
    sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "close") {
            const statusCode = (lastDisconnect?.error as any)?.output?.statusCode || (lastDisconnect?.error as any)?.statusCode;
            if (statusCode !== DisconnectReason.loggedOut) {
                setTimeout(() => startBot(), 5000);
            }
        } else if (connection === "open") {
            console.log("✅ BOT TERHUBUNG!");
            await sock.sendMessage(OWNER_NUMBER, { text: "🚀 *LAPORAN:* Bot sudah AKTIF kembali." });
        }
    });
}

startBot().catch(err => console.error("Fatal:", err));
