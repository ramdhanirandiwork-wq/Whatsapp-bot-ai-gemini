import express from "express";
import makeWASocket, {
  useMultiFileAuthState,
  fetchLatestBaileysVersion
} from "@whiskeysockets/baileys";
import pino from "pino";

const app = express();
const PORT = process.env.PORT || 3000;

// 🔥 WAJIB: biar Render tidak timeout
app.get("/", (req, res) => {
  res.status(200).send("🤖 Bot WhatsApp Gemini Aktif!");
});

app.listen(PORT, () => {
  console.log(`🌐 Server running on port ${PORT}`);
});

// ================= BOT =================

async function startBot() {
  console.log("🚀 Memulai bot...");

  const { state, saveCreds } = await useMultiFileAuthState("session");

  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    logger: pino({ level: "silent" })
  });

  // simpan session
  sock.ev.on("creds.update", saveCreds);

  // status koneksi
  sock.ev.on("connection.update", async (update) => {
    const { connection } = update;

    if (connection === "close") {
      console.log("❌ Koneksi terputus, reconnect...");
      startBot();
    }

    if (connection === "open") {
      console.log("✅ BOT TERHUBUNG!");

      // kirim notif ke nomor kamu
      await sock.sendMessage("6283109862325@s.whatsapp.net", {
        text: "✅ Bot WhatsApp berhasil aktif 🚀"
      });
    }
  });

  // 🔥 FIX ERROR 428 (WAJIB DELAY)
  setTimeout(async () => {
    try {
      if (!sock.authState.creds.registered) {
        console.log("🔥 Ambil pairing code...");

        const code = await sock.requestPairingCode("6281399941143");

        console.log("\n========================================");
        console.log("🔥 CONNECT TO HP NO: 6281399941143");
        console.log("🔥 KODE PAIRING:", code);
        console.log("========================================\n");
      }
    } catch (err) {
      console.log("❌ Pairing gagal, retry...");
      setTimeout(startBot, 5000);
    }
  }, 5000);
}

startBot();
