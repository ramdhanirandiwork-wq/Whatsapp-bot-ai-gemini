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

// --- SERVER UNTUK RENDER ---
const app = express();
const PORT = parseInt(process.env.PORT || "10000", 10); 

// Render akan mengecek ke sini setiap menit
app.get('/', (req, res) => {
    res.status(200).send('TERMINAL_LAMA_READY');
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 Server aktif di port ${PORT}`);
});

// --- KONFIGURASI AI ---
const genAI = new GoogleGenerativeAI(process.env.API_KEY || "");
const model = genAI.getGenerativeModel({ 
    model: "gemini-1.5-flash",
    systemInstruction: `You are the "STOCK OPNAME TERMINAL LAMA" Exclusive Inventory Assistant.
1. ZERO CONVERSATION: Only code blocks for results.
2. INITIAL TRIGGER: "STOCK LAPORAN KAYAME FOOD\nSilakan input Laporan Hari ini:"
3. DATA TARGET: Chili Oil: 0.5 | Aluminium Foil: 1 Pack | Mika Mix 6: 1 Pack | Mika Mix 3: 1 Pack | Aluminium Small: 1 Pack | Cup Chili Oil: 5 Pack | Sumpit: 5 Pack | Garpu Buah: 3 Pack | Gas Torch: 3 Pcs | Keju Slice: 6 Pack | Mika Large: 6 Pcs | Plastik Danil: 3 Pack | Plastik PE 15: 3 Pack | Plastik PE 25: 2 Pack | Klip Saus: 2 Pack | Kertas Printer: 2 Pcs | Mamayo: 10 Pack | Prima Agung: 1 Pack | Gourmet: 1 Pack | Parsley: 1 Pack | Boncabe: 1 Pack | Saus Kompan: 1 Kompan | Isi Hekter: 3 Pack | Sarung Plastic: 1 Pack | Sarung Karet: 1 Pack | Plastik Sampah: 1 Pack | Tisu: 2 Pack | Dus Birthday: 5 Pcs | Selotip: 3 Pcs | Mayo Kewpie: 1 Pack | Aksesoris Birthday: 3 Pcs
4. LOGIC: Date Tomorrow. Numbered Checklist. Permanent: Dimsum 600, Saus Botol 4, Bolognes 2, Tar-tar 1.`,
});

async function startBot() {
    // Pakai folder sesi 'auth_final' agar bersih
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
        browser: ["TerminalLama", "Safari", "1.0.0"],
        connectTimeoutMs: 60000,
    });

    if (!sock.authState.creds.registered) {
        const phoneNumber = "6281399941143"; 
        
        console.log(`🕒 Menyiapkan pairing nomor: ${phoneNumber}`);
        
        setTimeout(async () => {
            try {
                if (!sock.authState.creds.registered) {
                    const code = await sock.requestPairingCode(phoneNumber);
                    console.log(`\n========================================`);
                    console.log(`🔥 KODE PAIRING: ${code}`);
                    console.log(`========================================\n`);
                }
            } catch (err) {
                console.log("❌ WhatsApp Limit. Tunggu 1 jam sebelum coba lagi.");
            }
        }, 15000); 
    }

    sock.ev.on("creds.update", saveCreds);

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
            console.log("✅ BOT TERHUBUNG!");
        }
    });
}

startBot();
