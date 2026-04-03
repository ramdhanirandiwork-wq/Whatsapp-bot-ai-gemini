import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState
} from "@whiskeysockets/baileys";
import pino from "pino";
import { GoogleGenerativeAI } from "@google/generative-ai";
import 'dotenv/config';

const genAI = new GoogleGenerativeAI(process.env.API_KEY!);

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("auth");

  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: "silent" }),
  });

  // ✅ PAIRING CODE
  if (process.env.PAIRING_CODE === "true") {
    const code = await sock.requestPairingCode(process.env.WA_NUMBER!);
    console.log("PAIRING CODE:", code);
  }

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message) return;

    const sender = msg.key.remoteJid!;
    const text =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text;

    if (!text) return;

    console.log("Message:", text);

    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
    });

    const result = await model.generateContent(text);
    const response = await result.response;
    const reply = response.text();

    await sock.sendMessage(sender, { text: reply });
  });

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "close") {
      const shouldReconnect =
        (lastDisconnect?.error as any)?.output?.statusCode !==
        DisconnectReason.loggedOut;

      if (shouldReconnect) startBot();
    }

    if (connection === "open") {
      console.log("Bot connected!");
    }
  });
}

startBot();
