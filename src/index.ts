import express from "express";
import makeWASocket, {
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
  makeCacheableSignalKeyStore
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import pino from "pino";

const app = express();
const PORT = process.env.PORT || 3000;

// Anti Render Timeout
app.get("/", (req, res) => {
  res.status(200).send("🤖 Bot Terminal Lama Aktif!");
});

app.listen(PORT, () => {
  console.log(`🌐 Server running on port ${PORT}`);
});

// ================= BOT CORE =================

// Variabel untuk menyimpan instance socket agar tidak terjadi double running
let sock: any = null;

async function startBot() {
  console.log("🚀 Memulai bot...");

  // Logger diturunkan levelnya agar log Render tidak penuh
  const logger = pino({ level: "silent" });
  const { state, saveCreds } = await useMultiFileAuthState("session");
  const { version } = await fetchLatestBaileysVersion();

  // Inisialisasi Socket
  sock = makeWASocket({
    version,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    printQRInTerminal: false,
    browser: ["Terminal Lama", "Chrome", "1.0.0"],
    syncFullHistory: false,
    logger
  });

  // Simpan session secara otomatis
  sock.ev.on("creds.update", saveCreds);

  // Penanganan Koneksi
  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "connecting") {
      console.log("⏳ Menghubungkan ke WhatsApp...");
    }

    if (connection === "open") {
      console.log("✅ BOT TERHUBUNG!");
      
      // Kirim notifikasi aktif
      await sock.sendMessage("6283109862325@s.whatsapp.net", {
        text: "✅ Asisten Inventaris Terminal Lama berhasil aktif 🚀"
      });
    }

    if (connection === "close") {
      const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      console.log(`❌ Koneksi terputus (Reason: ${statusCode}). Reconnect: ${shouldReconnect}`);

      if (shouldReconnect) {
        // Jeda 10 detik sebelum restart untuk menghindari spamming di Render
        setTimeout(startBot, 10000);
      } else {
        console.log("⚠️ Sesi Logout. Silakan hapus folder 'session' dan pairing ulang.");
      }
    }
  });

  // Logika Pairing Code
  if (!sock.authState.creds.registered) {
    console.log("🔥 Menyiapkan permintaan Pairing Code...");
    
    // Jeda agar socket benar-benar siap sebelum minta code
    setTimeout(async () => {
      try {
        const phoneNumber = "6281399941143";
        const code = await sock.requestPairingCode(phoneNumber);
        
        console.log("\n" + "=".repeat(40));
        console.log(`📱 NOMOR HP: ${phoneNumber}`);
        console.log(`🔑 KODE PAIRING: ${code}`);
        console.log("=".repeat(40) + "\n");
      } catch (err) {
        console.log("❌ Gagal mendapatkan Pairing Code. Coba lagi dalam 10 detik...");
        // Jangan panggil startBot() di sini agar tidak looping socket
      }
    }, 10000); 
  }

  // Handler Pesan (Tempatkan logika Gemini Kayame Food di sini)
  sock.ev.on("messages.upsert", async (m: any) => {
    const msg = m.messages[0];
    if (!msg.message || msg.key.fromMe) return;
    
    // Debug pesan masuk
    // console.log(`📩 Pesan dari ${msg.key.remoteJid}: ${msg.message.conversation}`);
  });

  return sock;
}

// Jalankan pertama kali
startBot();
