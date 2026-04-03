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

// --- 1. WEB SERVER ---
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Bot Status: Online ✅'));
app.listen(PORT, () => console.log(`🌐 Server running on port ${PORT}`));

// --- 2. KONFIGURASI GEMINI (Logika Jawaban Diperbaiki) ---
const genAI = new GoogleGenerativeAI(process.env.API_KEY!);
const model = genAI.getGenerativeModel({ 
    model: "gemini-1.5-flash",
    // Menambahkan instruksi agar AI tahu tugas spesifiknya
    systemInstruction: "You are the STOCK OPNAME assistant for Kayame Food. Respond with clear stock reports based on user input. If user says 'p' or 'cek stok', ask for today's report."
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

    // --- 3. LOGIKA PAIRING CODE (Log Nomor HP Ditambahkan) ---
    if (!sock.authState.creds.registered) {
        const phoneNumber = process.env.WA_NUMBER;
        if (!phoneNumber) {
            console.error("❌ ERROR: WA_NUMBER kosong di Environment Variables!");
            return;
        }

        // Penambahan Log Nomor HP yang sedang dikoneksikan
        console.log(`⏳ Menyiapkan koneksi untuk nomor: ${phoneNumber}...`);

        setTimeout(async () => {
            try {
                let code = await sock.requestPairingCode(phoneNumber);
                code = code?.match(/.{1,4}/g)?.join("-") || code;
                console.log("\n========================================");
                console.log(`🔥 CONNECT TO HP NO: ${phoneNumber}`); // Log No HP sesuai permintaan Anda
                console.log(`🔥 KODE PAIRING ANDA: ${code}`);
                console.log("========================================\n");
            } catch (err) {
                console.error("❌ Gagal generate kode. WhatsApp limit atau koneksi tidak stabil.");
            }
        }, 10000); // Jeda 10 detik agar sistem benar-benar siap
    }

    sock.ev.on("creds.update", saveCreds);

    // --- 4. HANDLER PESAN (Logika Aman) ---
    sock.ev.on("messages.upsert", async ({ messages }) => {
        const msg: WAMessage = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const jid = msg.key.remoteJid!;
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text;
        
        if (!text) return;
        console.log(`📩 Pesan masuk dari ${jid}: ${text}`);

        try {
            await sock.sendPresenceUpdate("composing", jid);

            // Logika sederhana: Jika 'p', jangan kirim ke AI, langsung balas template
            if (text.toLowerCase() === "p" || text.toLowerCase() === "cek stok") {
                await sock.sendMessage(jid, { text: "STOCK LAPORAN KAYAME FOOD\nSilakan input Laporan Hari ini:" });
                return;
            }

            // Selain itu, biarkan AI yang memproses
            const result = await model.generateContent(text);
            const responseText = result.response.text();

            if (responseText) {
                await sock.sendMessage(jid, { text: responseText }, { quoted: msg });
            }
        } catch (error) {
            console.error("❌ Gemini Error:", error);
        }
    });

    // --- 5. HANDLER KONEKSI ---
    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "close") {
            const statusCode = (lastDisconnect?.error as any)?.output?.statusCode || (lastDisconnect?.error as any)?.statusCode;
            console.log(`❌ Terputus (Status: ${statusCode})`);

            if (statusCode !== DisconnectReason.loggedOut) {
                console.log("🔄 Reconnecting...");
                setTimeout(() => startBot(), 5000);
            }
        } else if (connection === "open") {
            console.log("✅ BOT BERHASIL TERHUBUNG KE WHATSAPP!");
        }
    });
}

startBot().catch(err => console.error("Fatal Error:", err));
