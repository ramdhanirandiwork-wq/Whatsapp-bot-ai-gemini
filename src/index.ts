import express from "express";
import makeWASocket, {
  useMultiFileAuthState,
  fetchLatestBaileysVersion
} from "@whiskeysockets/baileys";

const app = express();
const PORT = process.env.PORT || 3000;

// 🔥 anti render timeout
app.get("/", (req, res) => {
  res.status(200).send("🤖 Bot WhatsApp Aktif!");
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
    printQRInTerminal: false
  });

  // simpan session
  sock.ev.on("creds.update", saveCreds);

  // koneksi
  sock.ev.on("connection.update", async (update) => {
    const { connection } = update;

    if (connection === "close") {
      console.log("❌ Koneksi terputus, reconnect...");
      setTimeout(startBot, 5000);
    }

    if (connection === "open") {
      console.log("✅ BOT TERHUBUNG!");

      // kirim notif ke nomor kamu
      await sock.sendMessage("6283109862325@s.whatsapp.net", {
        text: "✅ Bot WhatsApp berhasil aktif 🚀"
      });
    }
  });

  // 🔥 FIX pairing delay (anti error 428)
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
      console.log("❌ Pairing gagal, retry 5 detik...");
      setTimeout(startBot, 5000);
    }
  }, 5000);
}

startBot();
