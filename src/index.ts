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

// --- 1. WEB SERVER (ANTI-IDLE RENDER) ---
const app = express();
const PORT = process.env.PORT || 10000;
app.get('/', (req, res) => res.send('Terminal Lama Inventory Bot is Online ✅'));
app.listen(PORT, () => console.log(`🌐 Server running on port ${PORT}`));

// --- 2. KONFIGURASI GEMINI DENGAN SYSTEM INSTRUCTION ---
const genAI = new GoogleGenerativeAI(process.env.API_KEY!);
const model = genAI.getGenerativeModel({ 
    model: "gemini-1.5-flash",
    systemInstruction: `You are the "STOCK OPNAME TERMINAL LAMA" Exclusive Inventory Assistant.
1. ZERO CONVERSATION: Never provide greetings, confirmations, or any prose.
2. OUTPUT FORMAT: Only use a SINGLE CODE BLOCK for the result.
3. DATA TARGET (PATOKAN STOK HARIAN):
   - Chili Oil: 0.5 | Aluminium Foil: 1 Pack | Mika Mix 6: 1 Pack | Mika Mix 3: 1 Pack
   - Aluminium Small: 1 Pack | Cup Chili Oil: 5 Pack | Sumpit: 5 Pack | Garpu Buah: 3 Pack
   - Gas Torch: 3 Pcs | Keju Slice: 6 Pack | Mika Large: 6 Pcs | Plastik Danil: 3 Pack
   - Plastik PE 15: 3 Pack | Plastik PE 25: 2 Pack | Klip Saus: 2 Pack | Kertas Printer: 2 Pcs
   - Mamayo: 10 Pack | Prima Agung: 1 Pack | Gourmet: 1 Pack | Parsley: 1 Pack | Boncabe: 1 Pack
   - Saus Kompan: 1 Kompan | Isi Hekter: 3 Pack | Sarung Plastic: 1 Pack | Sarung Karet: 1 Pack
   - Plastik Sampah: 1 Pack | Tisu: 2 Pack | Dus Birthday: 5 Pcs | Selotip: 3 Pcs
   - Mayo Kewpie: 1 Pack | Aksesoris Birthday: 3 Pcs
4. LOGIC: Date is Tomorrow (Indonesian). Numbered checklist. Permanent items: Dimsum 600, Saus Botol 4, Bolognes 2, Tar-tar 1. 
5. Saus Kompan logic: If < 1/2 or "habis" -> "[ ] Saus Kompan 🛢️: 1 Kompan" + 1 empty line.
6. Calculation: (Target - Input). If Input >= Target, hide from checklist.`
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

    if (!sock.authState.creds.registered) {
        const phoneNumber = process.env.WA_NUMBER;
        setTimeout(async () => {
            try {
                const code = await sock.requestPairingCode(phoneNumber!);
                console.log(`🔥 KODE PAIRING: ${code}`);
            } catch (err) { console.error("Gagal pairing"); }
        }, 6000);
    }

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("messages.upsert", async ({ messages }) => {
        const msg: WAMessage = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const jid = msg.key.remoteJid!;
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text;
        
        if (!text) return;

        // Trigger Awal
        if (text.toLowerCase() === "cek stok" || text.toLowerCase() === "p") {
            await sock.sendMessage(jid, { text: "STOCK LAPORAN KAYAME FOOD\nSilakan input Laporan Hari ini:" });
            return;
        }

        try {
            await sock.sendPresenceUpdate("composing", jid);
            const result = await model.generateContent(text);
            const responseText = result.response.text();
            await sock.sendMessage(jid, { text: responseText }, { quoted: msg });
        } catch (error) {
            console.error(error);
            await sock.sendMessage(jid, { text: "Sistem sibuk, pastikan input data benar." });
        }
    });

    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "close") {
            const statusCode = (lastDisconnect?.error as any)?.output?.statusCode || (lastDisconnect?.error as any)?.statusCode;
            if (statusCode !== DisconnectReason.loggedOut && state.creds.registered) {
                setTimeout(() => startBot(), 5000);
            }
        } else if (connection === "open") {
            console.log("✅ BOT TERMINAL LAMA CONNECTED!");
        }
    });
}

startBot().catch(err => console.error(err));
