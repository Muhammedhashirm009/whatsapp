import { proto } from "@whiskeysockets/baileys";
import { BufferJSON, initAuthCreds } from "@whiskeysockets/baileys";
import type { AuthenticationCreds, AuthenticationState, SignalDataTypeMap } from "@whiskeysockets/baileys";
import { storage } from "./storage";

export async function useDBAuthState(): Promise<{
  state: AuthenticationState;
  saveCreds: () => Promise<void>;
  clearState: () => Promise<void>;
}> {
  const writeData = async (key: string, data: any) => {
    const serialized = JSON.stringify(data, BufferJSON.replacer);
    await storage.setAuthData(key, serialized);
  };

  const readData = async (key: string): Promise<any | null> => {
    try {
      const data = await storage.getAuthData(key);
      if (!data) return null;
      return JSON.parse(data, BufferJSON.reviver);
    } catch {
      return null;
    }
  };

  const removeData = async (key: string) => {
    await storage.deleteAuthData(key);
  };

  const creds: AuthenticationCreds = (await readData("creds")) || initAuthCreds();

  const state: AuthenticationState = {
    creds,
    keys: {
      get: async <T extends keyof SignalDataTypeMap>(type: T, ids: string[]) => {
        const data: { [id: string]: SignalDataTypeMap[T] } = {};
        await Promise.all(
          ids.map(async (id) => {
            const key = `${type}-${id}`;
            const value = await readData(key);
            if (value) {
              if (type === "app-state-sync-key") {
                data[id] = proto.Message.AppStateSyncKeyData.fromObject(value) as any;
              } else {
                data[id] = value;
              }
            }
          })
        );
        return data;
      },
      set: async (data: any) => {
        const tasks: Promise<void>[] = [];
        for (const category in data) {
          for (const id in data[category]) {
            const key = `${category}-${id}`;
            const value = data[category][id];
            if (value) {
              tasks.push(writeData(key, value));
            } else {
              tasks.push(removeData(key));
            }
          }
        }
        await Promise.all(tasks);
      },
    },
  };

  const saveCreds = async () => {
    await writeData("creds", state.creds);
  };

  const clearState = async () => {
    await storage.clearAllAuthData();
  };

  return { state, saveCreds, clearState };
}
