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
import fs from "fs";

// --- 1. WEB SERVER (Agar Render tidak restart) ---
const app = express();
const PORT = Number(process.env.PORT) || 10000;

app.get('/', (req, res) => {
    res.status(200).send('BOT TERMINAL LAMA: ONLINE');
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 Server berjalan di port ${PORT}`);
});

// --- 2. KONFIGURASI AI ---
const genAI = new GoogleGenerativeAI(process.env.API_KEY || "");
const model = genAI.getGenerativeModel({ 
    model: "gemini-1.5-flash",
    systemInstruction: `You are the "STOCK OPNAME TERMINAL LAMA" Exclusive Inventory Assistant.
1. ZERO CONVERSATION: Never provide greetings, confirmations, or any prose.
2. OUTPUT FORMAT: Only use a SINGLE CODE BLOCK for the result.
3. INITIAL TRIGGER: Your first response before receiving data must be exactly: "STOCK LAPORAN KAYAME FOOD\nSilakan input Laporan Hari ini:"
4. DATA TARGET: Chili Oil: 0.5 | Aluminium Foil: 1 Pack | Mika Mix 6: 1 Pack | Mika Mix 3: 1 Pack | Aluminium Small: 1 Pack | Cup Chili Oil: 5 Pack | Sumpit: 5 Pack | Garpu Buah: 3 Pack | Gas Torch: 3 Pcs | Keju Slice: 6 Pack | Mika Large: 6 Pcs | Plastik Danil: 3 Pack | Plastik PE 15: 3 Pack | Plastik PE 25: 2 Pack | Klip Saus: 2 Pack | Kertas Printer: 2 Pcs | Mamayo: 10 Pack | Prima Agung: 1 Pack | Gourmet: 1 Pack | Parsley: 1 Pack | Boncabe: 1 Pack | Saus Kompan: 1 Kompan | Isi Hekter: 3 Pack | Sarung Plastic: 1 Pack | Sarung Karet: 1 Pack | Plastik Sampah: 1 Pack | Tisu: 2 Pack | Dus Birthday: 5 Pcs | Selotip: 3 Pcs | Mayo Kewpie: 1 Pack | Aksesoris Birthday: 3 Pcs
5. LOGIC: Date Tomorrow. Numbered Checklist. Permanent: Dimsum 600, Saus Botol 4, Bolognes 2, Tar-tar 1.`,
});

async function startBot() {
    console.log("🛠️ Menyiapkan koneksi untuk nomor baru...");
    
    // Menggunakan folder 'auth_baru' agar tidak bentrok dengan sesi nomor lama
    const { state, saveCreds } = await useMultiFileAuthState("auth_baru");
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
        },
        printQRInTerminal: false,
        logger: pino({ level: "silent" }),
        // Nama browser baru agar tidak terdeteksi sesi lama
        browser: ["TerminalLama_V2", "Safari", "1.0.0"],
    });

    // --- LOGIKA PAIRING ---
    if (!sock.authState.creds.registered) {
        const phoneNumber = process.env.WA_NUMBER; // Pastikan di Render sudah diganti ke 6281399941143
        
        console.log(`⏳ Menunggu 20 detik untuk generate kode pairing nomor: ${phoneNumber}`);
        
        setTimeout(async () => {
            try {
                const code = await sock.requestPairingCode(phoneNumber!);
                console.log(`\n========================================`);
                console.log(`🔥 KODE PAIRING NOMOR BARU: ${code}`);
                console.log(`========================================\n`);
            } catch (err) {
                console.log("❌ Gagal request kode. Pastikan WA_NUMBER benar (format 62).");
            }
        }, 20000);
    }

    sock.ev.on("creds.update", saveCreds);

    // Message Handler
    sock.ev.on("messages.upsert", async ({ messages }) => {
        const msg: WAMessage = messages[0];
        if (!msg.message || msg.key.fromMe) return;
        const jid = msg.key.remoteJid!;
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text;
        if (!text) return;

        if (text.toLowerCase() === "p" || text.toLowerCase() === "cek stok") {
            await sock.sendMessage(jid, { text: "STOCK LAPORAN KAYAME FOOD\nSilakan input Laporan Hari ini:" });
            return;
        }

        try {
            await sock.sendPresenceUpdate("composing", jid);
            const result = await model.generateContent(text);
            await sock.sendMessage(jid, { text: result.response.text() }, { quoted: msg });
        } catch (e) {
            console.log("AI Error");
        }
    });

    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "close") {
            const statusCode = (lastDisconnect?.error as any)?.output?.statusCode || (lastDisconnect?.error as any)?.statusCode;
            if (statusCode !== DisconnectReason.loggedOut) {
                setTimeout(() => startBot(), 10000);
            }
        } else if (connection === "open") {
            console.log("✅ NOMOR BARU BERHASIL TERHUBUNG!");
        }
    });
}

startBot();
