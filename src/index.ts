import express from "express";
import makeWASocket, {
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
  makeCacheableSignalKeyStore
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import pino from "pino";
import qrcode from "qrcode-terminal";

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

let sock: any = null;

async function startBot() {
  console.log("🚀 Memulai bot...");

  const logger = pino({ level: "silent" });
  const { state, saveCreds } = await useMultiFileAuthState("session");
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    printQRInTerminal: false, // kita pakai qrcode-terminal
    browser: ["Terminal Lama", "Chrome", "1.0.0"],
    syncFullHistory: false,
    logger
  });

  // Simpan session
  sock.ev.on("creds.update", saveCreds);

  // ================= CONNECTION HANDLER =================
  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    // QR CODE
    if (qr) {
      console.log("\n📱 Scan QR berikut di WhatsApp:\n");
      qrcode.generate(qr, { small: true });
    }

    if (connection === "connecting") {
      console.log("⏳ Menghubungkan ke WhatsApp...");
    }

    if (connection === "open") {
      console.log("✅ BOT TERHUBUNG!");

      // ================= DEVICE INFO =================
      try {
        const user = sock.user;

        if (user) {
          console.log("\n📡 STATUS DEVICE:");
          console.log(`👤 Nama: ${user.name || "-"}`);
          console.log(`📱 Nomor: ${user.id.split(":")[0]}`);

          // NOTE: Baileys tidak bisa ambil jumlah device real
          // Kita kasih simulasi info multi device
          console.log("📊 Status: Terhubung ke WhatsApp Multi-Device");

          console.log("\n✅ Device aktif & siap digunakan\n");
        } else {
          console.log("⚠️ Belum terkoneksi ke device manapun");
        }
      } catch (err) {
        console.log("⚠️ Gagal membaca info device");
      }

      // ================= NOTIF KE NOMOR KAMU =================
      try {
        await sock.sendMessage("628310982325@s.whatsapp.net", {
          text: "✅ Bot WhatsApp berhasil ON & LIVE 🚀\n\nStatus: Aktif dan siap digunakan!"
        });
      } catch (err) {
        console.log("❌ Gagal kirim notifikasi ke WhatsApp kamu");
      }
    }

    if (connection === "close") {
      const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      console.log(`❌ Koneksi terputus (Reason: ${statusCode})`);

      if (shouldReconnect) {
        console.log("🔄 Reconnecting dalam 10 detik...");
        setTimeout(startBot, 10000);
      } else {
        console.log("⚠️ Logout! Hapus folder 'session' lalu scan ulang QR.");
      }
    }
  });

  // ================= MESSAGE HANDLER =================
  sock.ev.on("messages.upsert", async (m: any) => {
    const msg = m.messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const from = msg.key.remoteJid;
    const text =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text;

    console.log(`📩 ${from} : ${text}`);

    // contoh respon
    if (text?.toLowerCase() === "ping") {
      await sock.sendMessage(from, { text: "pong 🏓" });
    }
  });

  return sock;
}

// Jalankan bot
startBot();
