import { kv } from "@vercel/kv";

export interface SetgymsState {
  step: "brands" | "locations";
  selectedBrands: string[];
  selectedGyms: string[];
  currentBrandIndex: number;
}

const FLOW_TTL_SECONDS = 600;

export async function getGroupGyms(chatId: number): Promise<string[] | null> {
  return kv.get<string[]>(`gyms:${chatId}`);
}

export async function setGroupGyms(chatId: number, gyms: string[]): Promise<void> {
  await kv.set(`gyms:${chatId}`, gyms);
}

export async function getSetgymsState(chatId: number): Promise<SetgymsState | null> {
  return kv.get<SetgymsState>(`setgyms:${chatId}`);
}

export async function setSetgymsState(chatId: number, state: SetgymsState): Promise<void> {
  await kv.set(`setgyms:${chatId}`, state, { ex: FLOW_TTL_SECONDS });
}

export async function deleteSetgymsState(chatId: number): Promise<void> {
  await kv.del(`setgyms:${chatId}`);
}
