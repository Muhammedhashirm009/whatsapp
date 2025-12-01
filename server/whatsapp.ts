import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  type WASocket,
  type ConnectionState,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import { storage } from "./storage";
import type { Server as SocketIOServer } from "socket.io";
import pino from "pino";
import fs from "fs/promises";
import path from "path";

const logger = pino({ level: "silent" });

export class WhatsAppService {
  private sock: WASocket | null = null;
  private io: SocketIOServer | null = null;
  private isInitialized = false;
  private qrCode: string | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private isReconnecting = false;
  private isIntentionalDisconnect = false;
  private connectionAttempts = 0;
  private maxConnectionAttempts = 5;

  async initialize(io: SocketIOServer) {
    if (this.isInitialized) {
      console.log("WhatsApp service already initialized");
      return;
    }

    console.log("Initializing Baileys WhatsApp service...");
    this.io = io;
    this.isInitialized = true;

    try {
      await this.connectToWhatsApp();
    } catch (error) {
      console.error("Failed to initialize WhatsApp service:", error);
      throw error;
    }
  }

  private async connectToWhatsApp() {
    try {
      this.isReconnecting = false;
      this.isIntentionalDisconnect = false;
      
      // Clean up existing socket if any
      if (this.sock) {
        try {
          this.sock.ev.removeAllListeners("creds.update");
          this.sock.ev.removeAllListeners("connection.update");
          this.sock.ev.removeAllListeners("messages.upsert");
          this.sock.end(undefined);
        } catch (e) {
          // Ignore cleanup errors
        }
        this.sock = null;
      }
      
      // Disable Puppeteer to prevent browser launch attempts on Koyeb
      process.env.PUPPETEER_SKIP_CHROMIUM_DOWNLOAD = "true";
      process.env.PUPPETEER_SKIP_DOWNLOAD = "true";
      
      const { state, saveCreds } = await useMultiFileAuthState("./.sessions/baileys");
      const { version } = await fetchLatestBaileysVersion();

      this.sock = makeWASocket({
        version,
        logger,
        printQRInTerminal: false,
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, logger),
        },
        generateHighQualityLinkPreview: true,
        markOnlineOnConnect: false,
        syncFullHistory: false,
        browser: ["WhatsApp Bot", "Chrome", "1.0"],
      });

      this.sock.ev.on("creds.update", saveCreds);
      this.sock.ev.on("connection.update", async (update) => {
        await this.handleConnectionUpdate(update).catch(err => {
          console.error("Error in connection update handler:", err);
        });
      });
      this.sock.ev.on("messages.upsert", async ({ messages }) => {
        await this.handleIncomingMessages(messages).catch(err => {
          console.error("Error handling incoming messages:", err);
        });
      });

      console.log("Baileys WhatsApp client initialized");
    } catch (error) {
      console.error("Error connecting to WhatsApp:", error);
      this.scheduleReconnect(5000);
    }
  }

  private async handleConnectionUpdate(update: Partial<ConnectionState>) {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log("QR code received");
      this.qrCode = qr;
      this.connectionAttempts = 0;
      
      await storage.updateSession({
        qrCode: qr,
        isConnected: false,
      });
      this.io?.emit("qr", { qr });
    }

    if (connection === "close") {
      const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
      const isLoggedOut = statusCode === DisconnectReason.loggedOut;
      const isRestartRequired = statusCode === DisconnectReason.restartRequired;
      const isConnectionLost = statusCode === DisconnectReason.connectionLost;
      const isConnectionClosed = statusCode === DisconnectReason.connectionClosed;
      const isTimedOut = statusCode === DisconnectReason.timedOut;
      
      console.log(`Connection closed. Status code: ${statusCode}, Reason: ${this.getDisconnectReasonName(statusCode)}`);
      
      // Don't reconnect if intentionally disconnected
      if (this.isIntentionalDisconnect) {
        console.log("Intentional disconnect, not reconnecting");
        return;
      }
      
      await storage.updateSession({
        isConnected: false,
        phoneNumber: null,
        qrCode: null,
      });
      
      this.io?.emit("disconnected", { 
        reason: isLoggedOut ? "Logged out" : "Connection closed",
        requiresAuth: isLoggedOut
      });

      const isConnectionReplaced = statusCode === DisconnectReason.connectionReplaced;
      
      if (isLoggedOut) {
        console.log("Clearing session and generating fresh QR code...");
        await this.clearAuthState();
        this.connectionAttempts = 0;
        this.scheduleReconnect(3000);
      } else if (isConnectionReplaced) {
        console.log("Connection replaced by another session. NOT reconnecting to avoid connection loop.");
        console.log("Stop other WhatsApp sessions (other instances, WhatsApp Web, etc.) and manually reconnect.");
        this.io?.emit("error", { 
          message: "Another WhatsApp session took over. Close other sessions and reconnect manually.",
          requiresManualReconnect: true
        });
      } else if (isRestartRequired || isConnectionLost || isConnectionClosed || isTimedOut) {
        this.connectionAttempts++;
        if (this.connectionAttempts <= this.maxConnectionAttempts) {
          const delay = Math.min(3000 * this.connectionAttempts, 30000);
          console.log(`Recoverable disconnect, attempt ${this.connectionAttempts}/${this.maxConnectionAttempts}`);
          this.scheduleReconnect(delay);
        } else {
          console.log("Max reconnection attempts reached, waiting for manual intervention");
          this.io?.emit("error", { message: "Connection failed after multiple attempts" });
        }
      } else if (statusCode) {
        this.connectionAttempts++;
        if (this.connectionAttempts <= this.maxConnectionAttempts) {
          const delay = Math.min(5000 * this.connectionAttempts, 60000);
          this.scheduleReconnect(delay);
        }
      }
    } else if (connection === "open") {
      console.log("WhatsApp connected successfully");
      this.qrCode = null;
      this.connectionAttempts = 0;
      
      const phoneNumber = this.sock?.user?.id?.split(":")[0] || null;
      
      await storage.updateSession({
        phoneNumber,
        isConnected: true,
        qrCode: null,
        lastConnected: new Date(),
      });
      
      this.io?.emit("ready");
      await this.loadContacts();
    }
  }
  
  private getDisconnectReasonName(code: number | undefined): string {
    if (!code) return "unknown";
    switch (code) {
      case DisconnectReason.connectionClosed: return "connectionClosed";
      case DisconnectReason.connectionLost: return "connectionLost";
      case DisconnectReason.connectionReplaced: return "connectionReplaced";
      case DisconnectReason.timedOut: return "timedOut";
      case DisconnectReason.loggedOut: return "loggedOut";
      case DisconnectReason.badSession: return "badSession";
      case DisconnectReason.restartRequired: return "restartRequired";
      case DisconnectReason.multideviceMismatch: return "multideviceMismatch";
      default: return `unknown(${code})`;
    }
  }

  private async handleIncomingMessages(messages: any[]) {
    for (const msg of messages) {
      if (!msg.message) continue;
      if (msg.key.fromMe) continue;

      try {
        const chatId = msg.key.remoteJid || "";
        const from = chatId;
        const body = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
        const contactName = msg.pushName || null;

        await storage.createOrUpdateContact({
          id: chatId,
          name: contactName,
          number: chatId.split("@")[0],
          pushname: contactName,
          isGroup: chatId.includes("@g.us"),
        });

        await storage.createMessage({
          chatId,
          from,
          to: this.sock?.user?.id || "",
          body,
          timestamp: new Date(msg.messageTimestamp * 1000),
          isFromMe: false,
        });

        this.io?.emit("message", {
          chatId,
          from,
          body,
        });
      } catch (error) {
        console.error("Error processing message:", error);
      }
    }
  }

  private async clearAuthState() {
    try {
      const sessionPath = path.join(process.cwd(), ".sessions", "baileys");
      const exists = await fs.access(sessionPath).then(() => true).catch(() => false);
      
      if (exists) {
        await fs.rm(sessionPath, { recursive: true, force: true });
        console.log("Auth state cleared successfully");
      }
    } catch (error) {
      console.error("Error clearing auth state:", error);
    }
  }

  private scheduleReconnect(delay: number) {
    if (this.isReconnecting) {
      console.log("Reconnect already scheduled, skipping...");
      return;
    }

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    this.isReconnecting = true;
    this.reconnectTimeout = setTimeout(() => {
      void this.connectToWhatsApp().catch(err => {
        console.error("Reconnect attempt failed:", err);
        this.scheduleReconnect(10000);
      });
    }, delay);

    console.log(`Reconnect scheduled in ${delay}ms`);
  }

  async reconnect() {
    console.log("Manual reconnect requested");
    try {
      this.isIntentionalDisconnect = false;
      this.isReconnecting = false;
      this.connectionAttempts = 0;
      
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = null;
      }
      
      await this.clearAuthState();
      this.isInitialized = true;
      await this.connectToWhatsApp();
    } catch (error) {
      console.error("Error in manual reconnect:", error);
      throw error;
    }
  }

  private async loadContacts() {
    try {
      if (!this.sock) return;

      const chats = await this.sock.groupFetchAllParticipating();
      
      for (const [chatId, chat] of Object.entries(chats)) {
        try {
          await storage.createOrUpdateContact({
            id: chatId,
            name: chat.subject || null,
            number: chatId.split("@")[0],
            pushname: chat.subject || null,
            isGroup: chatId.includes("@g.us"),
          });
        } catch (error) {
          console.error("Error loading contact:", error);
        }
      }
      
      console.log(`Loaded ${Object.keys(chats).length} contacts`);
    } catch (error) {
      console.error("Error loading contacts:", error);
    }
  }

  async sendMessage(to: string, message: string) {
    if (!this.sock) {
      throw new Error("WhatsApp client not initialized");
    }

    const session = await storage.getSession();
    if (!session?.isConnected) {
      throw new Error("WhatsApp is not connected");
    }

    let chatId = to;
    if (!to.includes("@")) {
      chatId = `${to}@s.whatsapp.net`;
    }

    try {
      const result = await this.sock.sendMessage(chatId, { text: message });
      
      const contact = await storage.getContact(chatId);
      if (!contact) {
        await storage.createOrUpdateContact({
          id: chatId,
          name: null,
          number: to,
          pushname: null,
          isGroup: chatId.includes("@g.us"),
        });
      }

      const savedMessage = await storage.createMessage({
        chatId,
        from: this.sock.user?.id || chatId,
        to: chatId,
        body: message,
        timestamp: new Date(),
        isFromMe: true,
      });

      return savedMessage;
    } catch (error: any) {
      console.error("Error sending message:", error);
      throw new Error(error.message || "Failed to send message");
    }
  }

  async disconnect() {
    try {
      this.isIntentionalDisconnect = true;
      
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = null;
      }

      this.isReconnecting = false;
      this.connectionAttempts = 0;

      if (this.sock) {
        try {
          this.sock.ev.removeAllListeners("creds.update");
          this.sock.ev.removeAllListeners("connection.update");
          this.sock.ev.removeAllListeners("messages.upsert");
          await this.sock.logout();
        } catch (e) {
          console.error("Error during logout:", e);
        }
        this.sock = null;
      }

      await (storage as any).deleteSession();

      this.isInitialized = false;
      console.log("WhatsApp disconnected successfully and session deleted from database");
    } catch (error) {
      console.error("Error disconnecting:", error);
      throw error;
    }
  }

  getClient() {
    return this.sock;
  }
}

export const whatsappService = new WhatsAppService();
