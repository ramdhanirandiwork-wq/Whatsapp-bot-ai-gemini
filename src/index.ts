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

// --- 1. WEB SERVER (WAJIB UNTUK RENDER) ---
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Bot Status: Online ✅'));
app.listen(PORT, () => console.log(`🌐 Server running on port ${PORT}`));

// --- 2. KONFIGURASI GEMINI ---
const genAI = new GoogleGenerativeAI(process.env.API_KEY!);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

async function startBot() {
    // Menggunakan folder 'auth' untuk menyimpan session
    const { state, saveCreds } = await useMultiFileAuthState("auth");
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: {
            creds: state.creds,
            // Cache untuk mempercepat koneksi dan mengurangi error 428
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
        },
        printQRInTerminal: false, // Kita gunakan Pairing Code
        logger: pino({ level: "silent" }),
        // Identitas browser agar tidak dianggap spam
        browser: ["Ubuntu", "Chrome", "20.0.04"],
    });

    // --- 3. LOGIKA PAIRING CODE ---
    if (!sock.authState.creds.registered) {
        const phoneNumber = process.env.WA_NUMBER;
        if (!phoneNumber) {
            console.error("❌ ERROR: Isi WA_NUMBER di Environment Variables Render!");
            return;
        }

        // Delay 6 detik agar koneksi socket stabil sebelum minta kode
        setTimeout(async () => {
            try {
                let code = await sock.requestPairingCode(phoneNumber);
                code = code?.match(/.{1,4}/g)?.join("-") || code;
                console.log("\n========================================");
                console.log(`🔥 KODE PAIRING ANDA: ${code}`);
                console.log("========================================\n");
                console.log("⚠️ Masukkan kode ini di WhatsApp: Perangkat Tertaut > Tautkan Nomor.");
            } catch (err) {
                console.error("❌ Gagal mendapatkan kode pairing. Coba Restart.");
            }
        }, 6000);
    }

    // Simpan kredensial setiap ada perubahan
    sock.ev.on("creds.update", saveCreds);

    // --- 4. HANDLER PESAN (AI) ---
    sock.ev.on("messages.upsert", async ({ messages }) => {
        const msg: WAMessage = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const jid = msg.key.remoteJid!;
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text;
        
        if (!text) return;
        console.log(`📩 Pesan masuk: ${text}`);

        try {
            // Berikan efek "Typing..."
            await sock.sendPresenceUpdate("composing", jid);

            const result = await model.generateContent(text);
            const responseText = result.response.text();

            await sock.sendMessage(jid, { text: responseText }, { quoted: msg });
        } catch (error) {
            console.error("❌ Gemini Error:", error);
            await sock.sendMessage(jid, { text: "Maaf, sistem sedang sibuk. Coba lagi nanti ya! 🙏" });
        }
    });

    // --- 5. HANDLER KONEKSI (ANTI-LOOP) ---
    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === "close") {
            const error = (lastDisconnect?.error as any);
            const statusCode = error?.output?.statusCode || error?.statusCode;

            console.log(`❌ Koneksi Terputus (Status: ${statusCode})`);

            // Jangan reconnect otomatis jika:
            // 1. Sedang proses pairing (biar tidak double code)
            // 2. User logout sengaja
            if (statusCode === DisconnectReason.loggedOut || !state.creds.registered) {
                console.log("⛔ Reconnect dibatalkan (Menunggu pairing/Logout).");
                return;
            }

            // Reconnect hanya jika sudah pernah login sebelumnya
            console.log("🔄 Mencoba menyambung ulang dalam 5 detik...");
            setTimeout(() => startBot(), 5000);
        } else if (connection === "open") {
            console.log("✅ BOT BERHASIL TERHUBUNG KE WHATSAPP!");
        }
    });
}

// Jalankan bot
startBot().catch(err => console.error("Fatal Error:", err));
