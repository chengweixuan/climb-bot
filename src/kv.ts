import { kv } from "@vercel/kv";

export interface SetgymsState {
  step: "brands" | "locations";
  selectedBrands: string[];
  selectedGyms: string[];
  currentBrandIndex: number;
}

export interface AddgymState {
  step: "brands" | "locations";
  selectedBrands: string[];
  selectedGyms: string[];
  currentBrandIndex: number;
  existingGyms: string[];
}

export interface RemovegymState {
  selectedGyms: string[];
  existingGyms: string[];
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

export async function getAddgymState(chatId: number): Promise<AddgymState | null> {
  return kv.get<AddgymState>(`addgym:${chatId}`);
}

export async function setAddgymState(chatId: number, state: AddgymState): Promise<void> {
  await kv.set(`addgym:${chatId}`, state, { ex: FLOW_TTL_SECONDS });
}

export async function deleteAddgymState(chatId: number): Promise<void> {
  await kv.del(`addgym:${chatId}`);
}

export async function getRemovegymState(chatId: number): Promise<RemovegymState | null> {
  return kv.get<RemovegymState>(`removegym:${chatId}`);
}

export async function setRemovegymState(chatId: number, state: RemovegymState): Promise<void> {
  await kv.set(`removegym:${chatId}`, state, { ex: FLOW_TTL_SECONDS });
}

export async function deleteRemovegymState(chatId: number): Promise<void> {
  await kv.del(`removegym:${chatId}`);
}
