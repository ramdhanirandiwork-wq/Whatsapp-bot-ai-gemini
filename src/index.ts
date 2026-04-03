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

// --- 1. FIX PORT & SERVER (Mencegah Restart Loop) ---
const app = express();
const PORT = parseInt(process.env.PORT || "10000", 10); // Konversi string ke number agar tidak error build

app.get('/', (req, res) => {
    res.status(200).send('BOT_ACTIVE');
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 Server aktif di port ${PORT}`);
});

// --- 2. KONFIGURASI AI ---
const genAI = new GoogleGenerativeAI(process.env.API_KEY || "");
const model = genAI.getGenerativeModel({ 
    model: "gemini-1.5-flash",
    systemInstruction: `You are the "STOCK OPNAME TERMINAL LAMA" Exclusive Inventory Assistant.
1. ZERO CONVERSATION: Only code blocks for results.
2. INITIAL TRIGGER: "STOCK LAPORAN KAYAME FOOD\nSilakan input Laporan Hari ini:"
3. LOGIC: Date Tomorrow. Numbered Checklist.`,
});

async function startBot() {
    // Gunakan folder 'auth_success' agar tidak bentrok dengan sesi gagal sebelumnya
    const { state, saveCreds } = await useMultiFileAuthState("auth_success");
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
        connectTimeoutMs: 60000,
    });

    // --- LOGIKA PAIRING ---
    if (!sock.authState.creds.registered) {
        const phoneNumber = process.env.WA_NUMBER; // Pastikan di Render: 6281399941143
        
        console.log(`🕒 Menunggu 15 detik untuk memunculkan kode pairing...`);
        
        setTimeout(async () => {
            try {
                if (!sock.authState.creds.registered) {
                    const code = await sock.requestPairingCode(phoneNumber!);
                    console.log(`\n========================================`);
                    console.log(`🔥 KODE PAIRING ANDA: ${code}`);
                    console.log(`========================================\n`);
                }
            } catch (err) {
                console.log("❌ Limit WhatsApp. Tunggu 30 menit.");
            }
        }, 15000);
    }

    sock.ev.on("creds.update", saveCreds);

    // --- HANDLER PESAN ---
    sock.ev.on("messages.upsert", async ({ messages }) => {
        const msg: WAMessage = messages[0];
        if (!msg.message || msg.key.fromMe) return;
        const jid = msg.key.remoteJid!;
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text;
        
        if (text?.toLowerCase() === "p" || text?.toLowerCase() === "cek stok") {
            await sock.sendMessage(jid, { text: "STOCK LAPORAN KAYAME FOOD\nSilakan input Laporan Hari ini:" });
            return;
        }

        try {
            await sock.sendPresenceUpdate("composing", jid);
            const result = await model.generateContent(text!);
            await sock.sendMessage(jid, { text: result.response.text() }, { quoted: msg });
        } catch (e) {
            console.log("AI Error");
        }
    });

    // --- HANDLER KONEKSI ---
    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "close") {
            const statusCode = (lastDisconnect?.error as any)?.output?.statusCode || (lastDisconnect?.error as any)?.statusCode;
            console.log(`📡 Terputus (Status: ${statusCode})`);
            if (statusCode !== DisconnectReason.loggedOut) {
                setTimeout(() => startBot(), 10000);
            }
        } else if (connection === "open") {
            console.log("✅ BOT BERHASIL TERHUBUNG!");
        }
    });
}

startBot();
