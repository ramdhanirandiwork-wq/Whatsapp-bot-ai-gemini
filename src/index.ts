import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  jidDecode
} from "@whiskeysockets/baileys";
import pino from "pino";
import { GoogleGenerativeAI } from "@google/generative-ai";
import express from "express";
import "dotenv/config";

// --- KONFIGURASI WEB SERVER (Agar tidak kena suspend/sleep di Render) ---
const app = express();
const port = process.env.PORT || 3000;
app.get("/", (req, res) => res.send("Bot Gemini Aktif 24 Jam!"));
app.listen(port, () => console.log(`🌐 Server berjalan di port ${port}`));

// --- KONFIGURASI GEMINI ---
const genAI = new GoogleGenerativeAI(process.env.API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("auth");
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: "silent" }),
    printQRInTerminal: false, // Kita pakai Pairing Code
    browser: ["Ubuntu", "Chrome", "20.0.04"], // Biar terbaca sebagai perangkat Desktop
  });

  // --- LOGIKA PAIRING CODE ---
  if (!state.creds.registered) {
    const phoneNumber = process.env.WA_NUMBER;
    if (!phoneNumber) {
      console.error("❌ ERROR: WA_NUMBER tidak ditemukan di .env!");
      process.exit(1);
    }

    setTimeout(async () => {
      try {
        console.log("🔥 Mengambil Pairing Code untuk:", phoneNumber);
        const code = await sock.requestPairingCode(phoneNumber);
        console.log("\n===============================");
        console.log("✅ PAIRING CODE ANDA:", code);
        console.log("===============================\n");
        console.log("⚠️ Masukkan kode di atas ke WhatsApp (Tautkan Perangkat > Tautkan dengan nomor telepon)");
      } catch (e) {
        console.error("❌ Gagal mengambil pairing code", e);
      }
    }, 3000); // Jeda 3 detik agar socket benar-benar siap
  }

  sock.ev.on("creds.update", saveCreds);

  // --- HANDLER PESAN ---
  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return; // Abaikan jika pesan dari bot sendiri

    const sender = msg.key.remoteJid;
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text;

    if (!text) return;
    console.log(`📩 Dari: ${sender} | Pesan: ${text}`);

    // Tampilkan status "Sedang mengetik..." di WhatsApp
    await sock.sendPresenceUpdate("composing", sender);

    try {
      const result = await model.generateContent(text);
      const response = await result.response;
      const replyText = response.text();

      await sock.sendMessage(sender, { text: replyText }, { quoted: msg });
    } catch (err) {
      console.error("❌ Error AI:", err);
      await sock.sendMessage(sender, { text: "Aduh, otak saya lagi konslet sebentar.. 😅" });
    }
  });

  // --- HANDLER KONEKSI ---
  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "close") {
      const statusCode = (lastDisconnect?.error)?.output?.statusCode;
      console.log("❌ Koneksi terputus. Status:", statusCode);

      // Logika Reconnect yang lebih pintar
      if (statusCode === 428) {
        console.log("🔄 Precondition Required (428). Mencoba reconnect otomatis...");
        setTimeout(() => startBot(), 5000);
      } else if (statusCode !== DisconnectReason.loggedOut) {
        console.log("🔄 Reconnecting...");
        startBot();
      } else {
        console.log("🚫 Sesi berakhir (Logout). Hapus folder /auth dan scan ulang.");
      }
    }

    if (connection === "open") {
      console.log("\n🚀 BOT TERHUBUNG DENGAN SUKSES!");
    }
  });
}

// Jalankan bot
startBot().catch((err) => console.error("Fatal Error:", err));
