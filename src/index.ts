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

// --- 1. WEB SERVER UNTUK RENDER (Agar Tidak Sleep/Idle) ---
const app = express();
const PORT = process.env.PORT || 10000;
app.get('/', (req, res) => res.send('Terminal Lama Inventory Bot is Online ✅'));
app.listen(PORT, () => console.log(`🌐 Server berjalan di port ${PORT}`));

// --- 2. KONFIGURASI AI GEMINI DENGAN SYSTEM ROLE ---
const genAI = new GoogleGenerativeAI(process.env.API_KEY!);
const model = genAI.getGenerativeModel({ 
    model: "gemini-1.5-flash",
    systemInstruction: `You are the "STOCK OPNAME TERMINAL LAMA" Exclusive Inventory Assistant.
1. ZERO CONVERSATION: Never provide greetings, confirmations, or any prose.
2. OUTPUT FORMAT: Only use a SINGLE CODE BLOCK for the result.
3. INITIAL TRIGGER: Your first response before receiving data must be exactly: "STOCK LAPORAN KAYAME FOOD\nSilakan input Laporan Hari ini:"
4. DATA TARGET (PATOKAN STOK HARIAN):
   - Chili Oil: 0.5 (1/2) | Aluminium Foil (Tutup/Bawah): 1 Pack | Mika Mix 6: 1 Pack | Mika Mix 3: 1 Pack
   - Aluminium Small (Tutup/Bawah): 1 Pack | Cup Chili Oil: 5 Pack | Sumpit: 5 Pack | Garpu Buah: 3 Pack
   - Gas Torch: 3 Pcs | Keju Slice: 6 Pack | Mika Large: 6 Pcs | Plastik Danil: 3 Pack
   - Plastik PE 15: 3 Pack | Plastik PE 25: 2 Pack | Klip Saus: 2 Pack | Kertas Printer: 2 Pcs
   - Mamayo: 10 Pack | Prima Agung: 1 Pack | Gourmet: 1 Pack | Parsley: 1 Pack | Boncabe: 1 Pack
   - Saus Kompan: 1 Kompan | Isi Hekter: 3 Pack | Sarung Plastic: 1 Pack | Sarung Karet: 1 Pack
   - Plastik Sampah: 1 Pack | Tisu: 2 Pack | Dus Birthday: 5 Pcs | Selotip: 3 Pcs
   - Mayo Kewpie: 1 Pack | Aksesoris Birthday: 3 Pcs
5. LOGIC RULES:
   - DATE: Display tomorrow's date in Indonesian.
   - NUMBERED CHECKLIST: sequential numbers.
   - PERMANENT ITEMS: Dimsum 600 Pcs, Saus Botol 4, Bolognes 2, Tar-tar 1.
   - SAUS KOMPAN: If input < 1/2 or "habis" -> "[ ] Saus Kompan 🛢️: 1 Kompan".
   - CALCULATION: (Target - Input). If Input >= Target, do not display.`
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
        browser: ["TerminalLama", "Chrome", "20.0.04"],
    });

    // --- PAIRING CODE LOGIC ---
    if (!sock.authState.creds.registered) {
        const phoneNumber = process.env.WA_NUMBER;
        setTimeout(async () => {
            try {
                const code = await sock.requestPairingCode(phoneNumber!);
                console.log(`\n🔥 KODE PAIRING ANDA: ${code}\n`);
            } catch (err) { console.error("Gagal mengambil pairing code."); }
        }, 6000);
    }

    sock.ev.on("creds.update", saveCreds);

    // --- MESSAGE HANDLER ---
    sock.ev.on("messages.upsert", async ({ messages }) => {
        const msg: WAMessage = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const jid = msg.key.remoteJid!;
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text;
        
        if (!text) return;

        // Trigger Pancingan
        if (text.toLowerCase() === "p" || text.toLowerCase() === "cek stok") {
            await sock.sendMessage(jid, { text: "STOCK LAPORAN KAYAME FOOD\nSilakan input Laporan Hari ini:" });
            return;
        }

        try {
            await sock.sendPresenceUpdate("composing", jid);
            const result = await model.generateContent(text);
            const responseText = result.response.text();
            
            // Kirim hasil checklist ke WA
            await sock.sendMessage(jid, { text: responseText }, { quoted: msg });
        } catch (error) {
            console.error("Gemini Error:", error);
            await sock.sendMessage(jid, { text: "Maaf, sistem AI sedang sibuk. Coba kirim data stok lagi." });
        }
    });

    // --- CONNECTION HANDLER ---
    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "close") {
            const statusCode = (lastDisconnect?.error as any)?.output?.statusCode || (lastDisconnect?.error as any)?.statusCode;
            if (statusCode !== DisconnectReason.loggedOut && state.creds.registered) {
                console.log("🔄 Reconnecting...");
                setTimeout(() => startBot(), 5000);
            }
        } else if (connection === "open") {
            console.log("✅ BOT TERMINAL LAMA SUDAH AKTIF!");
        }
    });
}

startBot().catch(err => console.error("Fatal Error:", err));
