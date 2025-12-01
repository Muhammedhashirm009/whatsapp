import { 
  type Message, 
  type InsertMessage,
  type Contact,
  type InsertContact,
  type WhatsAppSession,
  type InsertWhatsAppSession
} from "@shared/schema";
import { randomUUID } from "crypto";
import mysql from "mysql2/promise";

export interface IStorage {
  // Messages
  createMessage(message: InsertMessage): Promise<Message>;
  getMessages(chatId?: string, limit?: number): Promise<Message[]>;
  getAllMessages(): Promise<Message[]>;
  
  // Contacts
  createOrUpdateContact(contact: InsertContact): Promise<Contact>;
  getContacts(): Promise<Contact[]>;
  getContact(id: string): Promise<Contact | undefined>;
  
  // WhatsApp Session
  getSession(): Promise<WhatsAppSession | undefined>;
  updateSession(session: Partial<InsertWhatsAppSession>): Promise<WhatsAppSession>;
  createSession(session: InsertWhatsAppSession): Promise<WhatsAppSession>;
  deleteSession(): Promise<void>;
  
  // Baileys Auth State (for persistent sessions)
  getAuthData(key: string): Promise<string | null>;
  setAuthData(key: string, data: string): Promise<void>;
  deleteAuthData(key: string): Promise<void>;
  clearAllAuthData(): Promise<void>;
  getAllAuthKeys(): Promise<string[]>;
}

export class MySQLStorage implements IStorage {
  private pool: mysql.Pool;

  constructor() {
    this.pool = mysql.createPool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });
  }

  private async initializeTables() {
    const connection = await this.pool.getConnection();
    try {
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS messages (
          id VARCHAR(255) PRIMARY KEY,
          chatId TEXT NOT NULL,
          \`from\` TEXT NOT NULL,
          \`to\` TEXT NOT NULL,
          body LONGTEXT NOT NULL,
          timestamp DATETIME NOT NULL,
          isFromMe BOOLEAN NOT NULL DEFAULT FALSE,
          INDEX idx_chatId (chatId(255))
        )
      `);

      await connection.execute(`
        CREATE TABLE IF NOT EXISTS contacts (
          id VARCHAR(255) PRIMARY KEY,
          name TEXT,
          number TEXT NOT NULL,
          pushname TEXT,
          isGroup BOOLEAN NOT NULL DEFAULT FALSE
        )
      `);

      await connection.execute(`
        CREATE TABLE IF NOT EXISTS whatsapp_session (
          id VARCHAR(255) PRIMARY KEY,
          phoneNumber TEXT,
          isConnected BOOLEAN NOT NULL DEFAULT FALSE,
          qrCode LONGTEXT,
          lastConnected DATETIME
        )
      `);

      await connection.execute(`
        CREATE TABLE IF NOT EXISTS baileys_auth (
          \`key\` VARCHAR(255) PRIMARY KEY,
          data LONGTEXT NOT NULL,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `);

      console.log("Database tables initialized");
    } finally {
      connection.release();
    }
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const id = randomUUID();
    const connection = await this.pool.getConnection();
    try {
      const message: Message = {
        ...insertMessage,
        id,
        timestamp: insertMessage.timestamp || new Date(),
        isFromMe: insertMessage.isFromMe ?? false
      };

      await connection.execute(
        `INSERT INTO messages (id, chatId, \`from\`, \`to\`, body, timestamp, isFromMe) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [message.id, message.chatId, message.from, message.to, message.body, message.timestamp, message.isFromMe]
      );

      return message;
    } finally {
      connection.release();
    }
  }

  async getMessages(chatId?: string, limit: number = 100): Promise<Message[]> {
    const connection = await this.pool.getConnection();
    try {
      let query = "SELECT * FROM messages";
      let params: any[] = [];

      if (chatId) {
        query += " WHERE chatId = ?";
        params.push(chatId);
      }

      query += " ORDER BY timestamp DESC LIMIT ?";
      params.push(limit);

      const [rows] = await connection.execute(query, params);
      return (rows as any[]).map((row: any) => ({
        ...row,
        timestamp: new Date(row.timestamp),
        isFromMe: Boolean(row.isFromMe)
      }));
    } finally {
      connection.release();
    }
  }

  async getAllMessages(): Promise<Message[]> {
    const connection = await this.pool.getConnection();
    try {
      const [rows] = await connection.execute(
        "SELECT * FROM messages ORDER BY timestamp DESC"
      );
      return (rows as any[]).map((row: any) => ({
        ...row,
        timestamp: new Date(row.timestamp),
        isFromMe: Boolean(row.isFromMe)
      }));
    } finally {
      connection.release();
    }
  }

  async createOrUpdateContact(contact: InsertContact): Promise<Contact> {
    const connection = await this.pool.getConnection();
    try {
      await connection.execute(
        `INSERT INTO contacts (id, name, number, pushname, isGroup) 
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE 
         name = VALUES(name), 
         pushname = VALUES(pushname)`,
        [contact.id, contact.name || null, contact.number, contact.pushname || null, contact.isGroup]
      );

      return contact as Contact;
    } finally {
      connection.release();
    }
  }

  async getContacts(): Promise<Contact[]> {
    const connection = await this.pool.getConnection();
    try {
      const [rows] = await connection.execute(
        `SELECT * FROM contacts 
         ORDER BY COALESCE(name, pushname, number) ASC`
      );
      return (rows as any[]).map((row: any) => ({
        ...row,
        isGroup: Boolean(row.isGroup)
      }));
    } finally {
      connection.release();
    }
  }

  async getContact(id: string): Promise<Contact | undefined> {
    const connection = await this.pool.getConnection();
    try {
      const [rows] = await connection.execute(
        "SELECT * FROM contacts WHERE id = ?",
        [id]
      );
      if ((rows as any[]).length === 0) return undefined;
      const row = (rows as any[])[0];
      return {
        ...row,
        isGroup: Boolean(row.isGroup)
      };
    } finally {
      connection.release();
    }
  }

  async getSession(): Promise<WhatsAppSession | undefined> {
    const connection = await this.pool.getConnection();
    try {
      const [rows] = await connection.execute(
        "SELECT * FROM whatsapp_session LIMIT 1"
      );
      if ((rows as any[]).length === 0) return undefined;
      const row = (rows as any[])[0];
      return {
        ...row,
        isConnected: Boolean(row.isConnected),
        lastConnected: row.lastConnected ? new Date(row.lastConnected) : null
      };
    } finally {
      connection.release();
    }
  }

  async updateSession(sessionUpdate: Partial<InsertWhatsAppSession>): Promise<WhatsAppSession> {
    const connection = await this.pool.getConnection();
    try {
      const session = await this.getSession();
      
      if (!session) {
        return this.createSession(sessionUpdate as InsertWhatsAppSession);
      }

      const updatedSession = { ...session, ...sessionUpdate };
      
      await connection.execute(
        `UPDATE whatsapp_session 
         SET phoneNumber = ?, isConnected = ?, qrCode = ?, lastConnected = ?
         WHERE id = ?`,
        [
          updatedSession.phoneNumber || null,
          updatedSession.isConnected,
          updatedSession.qrCode || null,
          updatedSession.lastConnected || null,
          session.id
        ]
      );

      return updatedSession;
    } finally {
      connection.release();
    }
  }

  async createSession(insertSession: InsertWhatsAppSession): Promise<WhatsAppSession> {
    const connection = await this.pool.getConnection();
    try {
      const id = randomUUID();
      const session: WhatsAppSession = {
        id,
        phoneNumber: insertSession.phoneNumber ?? null,
        isConnected: insertSession.isConnected ?? false,
        qrCode: insertSession.qrCode ?? null,
        lastConnected: insertSession.lastConnected ?? null
      };

      await connection.execute(
        `INSERT INTO whatsapp_session (id, phoneNumber, isConnected, qrCode, lastConnected) 
         VALUES (?, ?, ?, ?, ?)`,
        [session.id, session.phoneNumber, session.isConnected, session.qrCode, session.lastConnected]
      );

      return session;
    } finally {
      connection.release();
    }
  }

  async deleteSession(): Promise<void> {
    const connection = await this.pool.getConnection();
    try {
      await connection.execute("DELETE FROM whatsapp_session");
      await connection.execute("DELETE FROM baileys_auth");
      console.log("WhatsApp session and auth data deleted from database");
    } finally {
      connection.release();
    }
  }

  async getAuthData(key: string): Promise<string | null> {
    const connection = await this.pool.getConnection();
    try {
      const [rows] = await connection.execute(
        "SELECT data FROM baileys_auth WHERE `key` = ?",
        [key]
      );
      if ((rows as any[]).length === 0) return null;
      return (rows as any[])[0].data;
    } finally {
      connection.release();
    }
  }

  async setAuthData(key: string, data: string): Promise<void> {
    const connection = await this.pool.getConnection();
    try {
      await connection.execute(
        `INSERT INTO baileys_auth (\`key\`, data) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE data = VALUES(data)`,
        [key, data]
      );
    } finally {
      connection.release();
    }
  }

  async deleteAuthData(key: string): Promise<void> {
    const connection = await this.pool.getConnection();
    try {
      await connection.execute(
        "DELETE FROM baileys_auth WHERE `key` = ?",
        [key]
      );
    } finally {
      connection.release();
    }
  }

  async clearAllAuthData(): Promise<void> {
    const connection = await this.pool.getConnection();
    try {
      await connection.execute("DELETE FROM baileys_auth");
      console.log("All auth data cleared from database");
    } finally {
      connection.release();
    }
  }

  async getAllAuthKeys(): Promise<string[]> {
    const connection = await this.pool.getConnection();
    try {
      const [rows] = await connection.execute("SELECT `key` FROM baileys_auth");
      return (rows as any[]).map((row: any) => row.key);
    } finally {
      connection.release();
    }
  }
}

export let storage: IStorage;

export async function initializeStorage() {
  storage = new MySQLStorage();
  await (storage as MySQLStorage)['initializeTables']();
}
