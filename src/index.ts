import express from "express";
import makeWASocket, {
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
  makeCacheableSignalKeyStore
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import pino from "pino";
import fs from "fs";

// 🔥 FIX QR TANPA ERROR TYPES
const QRCode = require("qrcode");

const app = express();
const PORT = process.env.PORT || 3000;

// ================= SERVER =================
app.get("/", (req, res) => {
  res.send("🤖 Bot Terminal Lama Aktif!");
});

// ================= QR WEB =================
let currentQR: string | null = null;

app.get("/qr", async (req, res) => {
  try {
    if (!currentQR) {
      return res.send(`
        <html>
          <body style="text-align:center;font-family:sans-serif">
            <h2>✅ Sudah Terhubung</h2>
            <p>QR tidak tersedia</p>
          </body>
        </html>
      `);
    }

    const qrImage = await QRCode.toDataURL(currentQR, {
      width: 400,
      margin: 2
    });

    res.send(`
      <html>
        <head>
          <title>QR WhatsApp</title>
          <meta http-equiv="refresh" content="3">
        </head>
        <body style="
          display:flex;
          justify-content:center;
          align-items:center;
          height:100vh;
          background:#111;
          color:white;
          font-family:sans-serif;
          flex-direction:column;
        ">
          <h2>📱 Scan QR WhatsApp</h2>

          <div style="
            background:white;
            padding:20px;
            border-radius:20px;
          ">
            <img src="${qrImage}" />
          </div>

          <p style="margin-top:10px;font-size:14px;opacity:0.7">
            Auto refresh 3 detik
          </p>
        </body>
      </html>
    `);
  } catch {
    res.send("❌ Gagal generate QR");
  }
});

app.listen(PORT, () => {
  console.log(`🌐 Server running on port ${PORT}`);
});

// ================= AUTO DELETE SESSION =================
if (fs.existsSync("./session")) {
  fs.rmSync("./session", { recursive: true, force: true });
  console.log("🧹 Session lama dihapus");
}

// ================= BOT =================
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
    printQRInTerminal: false,
    browser: ["Terminal Lama", "Chrome", "1.0.0"],
    logger
  });

  sock.ev.on("creds.update", saveCreds);

  // ================= CONNECTION =================
  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      currentQR = qr;
      console.log("📱 QR tersedia di /qr");
    }

    if (connection === "connecting") {
      console.log("⏳ Menghubungkan...");
    }

    if (connection === "open") {
      console.log("✅ BOT TERHUBUNG!");

      const user = sock.user;
      if (user) {
        console.log(`📱 Connected: ${user.id.split(":")[0]}`);
      } else {
        console.log("⚠️ Belum terkoneksi ke device");
      }

      // notif ke nomor kamu
      await sock.sendMessage("628310982325@s.whatsapp.net", {
        text: "✅ Bot ON & LIVE 🚀"
      });

      currentQR = null;
    }

    if (connection === "close") {
      const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      console.log(`❌ Disconnect (${statusCode})`);

      if (shouldReconnect) {
        console.log("🔄 Reconnect 10 detik...");
        setTimeout(startBot, 10000);
      } else {
        console.log("⚠️ Logout, scan ulang QR");
      }
    }
  });

  // ================= SYSTEM REPORT =================
  function getTomorrowDate() {
    const hari = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return `📅 ${hari[d.getDay()]}, ${d.toLocaleDateString("id-ID")}`;
  }

  function generateReport(text: string) {
    if (!text) {
      return "STOCK LAPORAN KAYAME FOOD\nSilakan input Laporan Hari ini:";
    }

    return `
\`\`\`
${getTomorrowDate()}
*DAFTAR CHECKLIST YANG HARUS DI BAWA TERMINAL LAMA*
______________________________
1. [ ] Dimsum: 600 Pcs
2. [ ] Saus Botol 🧴: 4 Botol
3. [ ] Bolognes 🍅: 2 Kantong
4. [ ] Tar-tar 🥣: 1 Kantong
5. [ ] Saus Kompan 🛢️: 1 Kompan

6. [ ] Chili Oil: 0.5 Pack
7. [ ] Parsley: 1 Pack

*INFO STOK DI LAPAK TERMINAL LAMA*
__________________________________________
• Input: ${text}
\`\`\`
`;
  }

  // ================= MESSAGE =================
  sock.ev.on("messages.upsert", async (m: any) => {
    const msg = m.messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const from = msg.key.remoteJid;
    const text =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text;

    const response = generateReport(text);

    await sock.sendMessage(from, { text: response });
  });
}

startBot();
