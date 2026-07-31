# Group Gym Preferences Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-group gym preference configuration (`/setgyms`) and a preference-based poll command (`/climbwhere2`) using Vercel KV for persistence.

**Architecture:** Two new handler flows backed by a KV storage layer. `/setgyms` uses grammY's callback query system to drive a multi-step inline button flow (brand selection → location selection per brand). `/climbwhere2` reads saved preferences and delegates to existing poll-splitting logic. Gym grouping logic derived from `gyms.json`.

**Tech Stack:** TypeScript, grammY, Vercel KV (`@vercel/kv`), vitest

## Global Constraints

- TypeScript strict mode, ESM imports
- grammY as the Telegram framework
- vitest for tests
- Telegram inline keyboard button text max: 64 bytes UTF-8
- Telegram poll options max: 10 per poll
- All new files go in `src/`, tests in `tests/`

---

### Task 1: Add Vercel KV dependency and storage module

**Files:**
- Create: `src/kv.ts`
- Create: `tests/kv.test.ts`
- Modify: `package.json` (add `@vercel/kv` dependency)

**Interfaces:**
- Consumes: nothing
- Produces:
  - `getGroupGyms(chatId: number): Promise<string[] | null>` — returns saved gym list or null
  - `setGroupGyms(chatId: number, gyms: string[]): Promise<void>` — saves gym list
  - `getSetgymsState(chatId: number): Promise<SetgymsState | null>` — returns in-progress flow state
  - `setSetgymsState(chatId: number, state: SetgymsState): Promise<void>` — saves flow state with TTL
  - `deleteSetgymsState(chatId: number): Promise<void>` — clears flow state
  - `SetgymsState` interface: `{ step: "brands" | "locations"; selectedBrands: string[]; selectedGyms: string[]; currentBrandIndex: number }`

- [ ] **Step 1: Install @vercel/kv**

```bash
npm install @vercel/kv
```

- [ ] **Step 2: Write the failing tests**

Create `tests/kv.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@vercel/kv", () => ({
  kv: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
  },
}));

import { kv } from "@vercel/kv";
import {
  getGroupGyms,
  setGroupGyms,
  getSetgymsState,
  setSetgymsState,
  deleteSetgymsState,
} from "../src/kv.js";

const mockedKv = vi.mocked(kv);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getGroupGyms", () => {
  it("returns gym list when key exists", async () => {
    mockedKv.get.mockResolvedValue(["Gym A", "Gym B"]);
    const result = await getGroupGyms(123);
    expect(mockedKv.get).toHaveBeenCalledWith("gyms:123");
    expect(result).toEqual(["Gym A", "Gym B"]);
  });

  it("returns null when key does not exist", async () => {
    mockedKv.get.mockResolvedValue(null);
    const result = await getGroupGyms(123);
    expect(result).toBeNull();
  });
});

describe("setGroupGyms", () => {
  it("saves gym list under correct key", async () => {
    await setGroupGyms(123, ["Gym A"]);
    expect(mockedKv.set).toHaveBeenCalledWith("gyms:123", ["Gym A"]);
  });
});

describe("getSetgymsState", () => {
  it("returns state when key exists", async () => {
    const state = { step: "brands", selectedBrands: [], selectedGyms: [], currentBrandIndex: 0 };
    mockedKv.get.mockResolvedValue(state);
    const result = await getSetgymsState(456);
    expect(mockedKv.get).toHaveBeenCalledWith("setgyms:456");
    expect(result).toEqual(state);
  });
});

describe("setSetgymsState", () => {
  it("saves state with 10 minute TTL", async () => {
    const state = { step: "brands" as const, selectedBrands: [], selectedGyms: [], currentBrandIndex: 0 };
    await setSetgymsState(456, state);
    expect(mockedKv.set).toHaveBeenCalledWith("setgyms:456", state, { ex: 600 });
  });
});

describe("deleteSetgymsState", () => {
  it("deletes state key", async () => {
    await deleteSetgymsState(456);
    expect(mockedKv.del).toHaveBeenCalledWith("setgyms:456");
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
npx vitest run tests/kv.test.ts
```

Expected: FAIL — module `../src/kv.js` does not exist.

- [ ] **Step 4: Implement the storage module**

Create `src/kv.ts`:

```typescript
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
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx vitest run tests/kv.test.ts
```

Expected: all 5 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/kv.ts tests/kv.test.ts package.json package-lock.json
git commit -m "feat: add Vercel KV storage module for group gym preferences"
```

---

### Task 2: Gym grouping logic

**Files:**
- Create: `src/gym-groups.ts`
- Create: `tests/gym-groups.test.ts`

**Interfaces:**
- Consumes: `gyms.json` (read at runtime via `loadAllGymOptions` pattern)
- Produces:
  - `GymGroup` interface: `{ brand: string; gyms: string[] }`
  - `loadGymGroups(): GymGroup[]` — returns brands with their locations, plus an "Other" group for singles
  - `BRAND_PATTERNS: Record<string, string>` — maps brand prefix to display name

- [ ] **Step 1: Write the failing tests**

Create `tests/gym-groups.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { loadGymGroups, GymGroup } from "../src/gym-groups.js";

describe("loadGymGroups", () => {
  it("returns known multi-location brands", () => {
    const groups = loadGymGroups();
    const brandNames = groups.map((g) => g.brand);
    expect(brandNames).toContain("Boulder Movement");
    expect(brandNames).toContain("Boulder Planet");
    expect(brandNames).toContain("Boulder Plus");
    expect(brandNames).toContain("BFF Climb");
    expect(brandNames).toContain("Climb Central");
    expect(brandNames).toContain("Fit Bloc");
    expect(brandNames).toContain("Other");
  });

  it("groups Boulder Movement locations correctly", () => {
    const groups = loadGymGroups();
    const bm = groups.find((g) => g.brand === "Boulder Movement")!;
    expect(bm.gyms).toContain("Boulder Movement (Bugis+)");
    expect(bm.gyms).toContain("Boulder Movement (Downtown)");
    expect(bm.gyms).toContain("Boulder Movement (Rochor)");
    expect(bm.gyms).toContain("Boulder Movement (Tai Seng)");
  });

  it("groups Climb Central locations correctly", () => {
    const groups = loadGymGroups();
    const cc = groups.find((g) => g.brand === "Climb Central")!;
    expect(cc.gyms).toContain("Climb Central (Kallang Wave Mall)");
    expect(cc.gyms).toContain("Climb Central Funan");
    expect(cc.gyms).toContain("Climb Central Novena");
    expect(cc.gyms).toContain("Climb Central SAFRA Choa Chu Kang");
  });

  it("puts single-location gyms in Other", () => {
    const groups = loadGymGroups();
    const other = groups.find((g) => g.brand === "Other")!;
    expect(other.gyms).toContain("Ark Bloc");
    expect(other.gyms).toContain("Climba");
    expect(other.gyms).toContain("Z-Vertigo Boulder Gym");
  });

  it("does not put multi-location gyms in Other", () => {
    const groups = loadGymGroups();
    const other = groups.find((g) => g.brand === "Other")!;
    expect(other.gyms).not.toContain("Boulder Movement (Bugis+)");
    expect(other.gyms).not.toContain("Fit Bloc (Kent Ridge)");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/gym-groups.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement gym grouping**

Create `src/gym-groups.ts`:

```typescript
import { loadAllGymOptions } from "./config.js";

export interface GymGroup {
  brand: string;
  gyms: string[];
}

const BRAND_PREFIXES: Record<string, string> = {
  "Boulder Movement": "Boulder Movement",
  "Boulder Planet": "Boulder Planet",
  "Boulder Plus": "Boulder Plus",
  "BFF Climb": "BFF Climb",
  "Climb Central": "Climb Central",
  "Fit Bloc": "Fit Bloc",
};

export function loadGymGroups(): GymGroup[] {
  const allGyms = loadAllGymOptions();
  const grouped = new Map<string, string[]>();

  for (const prefix of Object.keys(BRAND_PREFIXES)) {
    grouped.set(prefix, []);
  }

  const others: string[] = [];

  for (const gym of allGyms) {
    let matched = false;
    for (const prefix of Object.keys(BRAND_PREFIXES)) {
      if (gym.startsWith(prefix)) {
        grouped.get(prefix)!.push(gym);
        matched = true;
        break;
      }
    }
    if (!matched) {
      others.push(gym);
    }
  }

  const groups: GymGroup[] = [];
  for (const [brand, gyms] of grouped) {
    if (gyms.length > 0) {
      groups.push({ brand, gyms });
    }
  }
  groups.push({ brand: "Other", gyms: others });

  return groups;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/gym-groups.test.ts
```

Expected: all 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/gym-groups.ts tests/gym-groups.test.ts
git commit -m "feat: add gym grouping logic for brand-based selection"
```

---

### Task 3: `/setgyms` command handler — brand selection step

**Files:**
- Create: `src/setgyms-handler.ts`
- Create: `tests/setgyms-handler.test.ts`

**Interfaces:**
- Consumes:
  - `loadGymGroups(): GymGroup[]` from `src/gym-groups.ts`
  - `setSetgymsState(chatId, state): Promise<void>` from `src/kv.ts`
  - `getSetgymsState(chatId): Promise<SetgymsState | null>` from `src/kv.ts`
- Produces:
  - `handleSetgyms(ctx: CommandContext<Context>): Promise<void>` — entry point, sends brand selection message
  - `handleSetgymsCallback(ctx: Context): Promise<void>` — handles all callback queries for the flow

- [ ] **Step 1: Write the failing tests for brand selection entry**

Create `tests/setgyms-handler.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/kv.js", () => ({
  getSetgymsState: vi.fn(),
  setSetgymsState: vi.fn(),
  deleteSetgymsState: vi.fn(),
  setGroupGyms: vi.fn(),
}));

vi.mock("../src/gym-groups.js", () => ({
  loadGymGroups: vi.fn(() => [
    { brand: "Boulder Movement", gyms: ["Boulder Movement (Bugis+)", "Boulder Movement (Tai Seng)"] },
    { brand: "Fit Bloc", gyms: ["Fit Bloc (Kent Ridge)", "Fit Bloc (Telok Ayer)"] },
    { brand: "Other", gyms: ["Ark Bloc", "Climba"] },
  ]),
}));

import { getSetgymsState, setSetgymsState, deleteSetgymsState, setGroupGyms } from "../src/kv.js";
import { handleSetgyms, handleSetgymsCallback } from "../src/setgyms-handler.js";

const mockedGetState = vi.mocked(getSetgymsState);
const mockedSetState = vi.mocked(setSetgymsState);
const mockedDeleteState = vi.mocked(deleteSetgymsState);
const mockedSetGroupGyms = vi.mocked(setGroupGyms);

function createCommandCtx() {
  return {
    chat: { id: 789 },
    reply: vi.fn(),
  } as any;
}

function createCallbackCtx(data: string) {
  return {
    chat: { id: 789 },
    callbackQuery: { data },
    answerCallbackQuery: vi.fn(),
    editMessageText: vi.fn(),
    editMessageReplyMarkup: vi.fn(),
    reply: vi.fn(),
    api: { editMessageReplyMarkup: vi.fn() },
  } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("handleSetgyms", () => {
  it("sends brand selection message with inline keyboard", async () => {
    const ctx = createCommandCtx();
    await handleSetgyms(ctx);

    expect(ctx.reply).toHaveBeenCalledTimes(1);
    const call = ctx.reply.mock.calls[0];
    expect(call[0]).toContain("Select gym brands");

    const keyboard = call[1].reply_markup.inline_keyboard;
    const buttonTexts = keyboard.flat().map((b: any) => b.text);
    expect(buttonTexts).toContain("☐ Boulder Movement");
    expect(buttonTexts).toContain("☐ Fit Bloc");
    expect(buttonTexts).toContain("☐ Other");
    expect(buttonTexts).toContain("Next →");
  });

  it("initializes setgyms state in KV", async () => {
    const ctx = createCommandCtx();
    await handleSetgyms(ctx);

    expect(mockedSetState).toHaveBeenCalledWith(789, {
      step: "brands",
      selectedBrands: [],
      selectedGyms: [],
      currentBrandIndex: 0,
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/setgyms-handler.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement brand selection entry**

Create `src/setgyms-handler.ts`:

```typescript
import { CommandContext, Context } from "grammy";
import { loadGymGroups } from "./gym-groups.js";
import {
  getSetgymsState,
  setSetgymsState,
  deleteSetgymsState,
  setGroupGyms,
  SetgymsState,
} from "./kv.js";

export async function handleSetgyms(ctx: CommandContext<Context>): Promise<void> {
  const chatId = ctx.chat.id;
  const groups = loadGymGroups();

  const state: SetgymsState = {
    step: "brands",
    selectedBrands: [],
    selectedGyms: [],
    currentBrandIndex: 0,
  };
  await setSetgymsState(chatId, state);

  const keyboard = buildBrandKeyboard(groups, state.selectedBrands);
  await ctx.reply("Select gym brands your group frequents:", {
    reply_markup: { inline_keyboard: keyboard },
  });
}

export async function handleSetgymsCallback(ctx: Context): Promise<void> {
  await ctx.answerCallbackQuery();

  const chatId = ctx.chat!.id;
  const data = ctx.callbackQuery?.data ?? "";
  const state = await getSetgymsState(chatId);

  if (!state) {
    await ctx.editMessageText("Session expired. Use /setgyms to start again.");
    return;
  }

  if (data.startsWith("setgyms:brand:")) {
    await handleBrandToggle(ctx, chatId, data, state);
  } else if (data === "setgyms:next") {
    await handleBrandNext(ctx, chatId, state);
  } else if (data.startsWith("setgyms:gym:")) {
    await handleGymToggle(ctx, chatId, data, state);
  } else if (data === "setgyms:done") {
    await handleLocationDone(ctx, chatId, state);
  }
}

async function handleBrandToggle(
  ctx: Context,
  chatId: number,
  data: string,
  state: SetgymsState
): Promise<void> {
  const brand = data.replace("setgyms:brand:", "");

  if (state.selectedBrands.includes(brand)) {
    state.selectedBrands = state.selectedBrands.filter((b) => b !== brand);
  } else {
    state.selectedBrands.push(brand);
  }

  await setSetgymsState(chatId, state);

  const groups = loadGymGroups();
  const keyboard = buildBrandKeyboard(groups, state.selectedBrands);
  await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: keyboard } });
}

async function handleBrandNext(
  ctx: Context,
  chatId: number,
  state: SetgymsState
): Promise<void> {
  if (state.selectedBrands.length === 0) {
    await ctx.answerCallbackQuery({ text: "Select at least one brand." });
    return;
  }

  state.step = "locations";
  state.currentBrandIndex = 0;
  await setSetgymsState(chatId, state);

  await sendLocationMessage(ctx, chatId, state);
}

async function handleGymToggle(
  ctx: Context,
  chatId: number,
  data: string,
  state: SetgymsState
): Promise<void> {
  const gym = data.replace("setgyms:gym:", "");

  if (state.selectedGyms.includes(gym)) {
    state.selectedGyms = state.selectedGyms.filter((g) => g !== gym);
  } else {
    state.selectedGyms.push(gym);
  }

  await setSetgymsState(chatId, state);

  const groups = loadGymGroups();
  const brand = state.selectedBrands[state.currentBrandIndex];
  const group = groups.find((g) => g.brand === brand)!;
  const keyboard = buildLocationKeyboard(group.gyms, state.selectedGyms);
  await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: keyboard } });
}

async function handleLocationDone(
  ctx: Context,
  chatId: number,
  state: SetgymsState
): Promise<void> {
  state.currentBrandIndex++;

  if (state.currentBrandIndex < state.selectedBrands.length) {
    await setSetgymsState(chatId, state);
    await sendLocationMessage(ctx, chatId, state);
  } else {
    await deleteSetgymsState(chatId);

    if (state.selectedGyms.length === 0) {
      await ctx.editMessageText("No gyms selected. Use /setgyms to try again.");
      return;
    }

    await setGroupGyms(chatId, state.selectedGyms);
    const gymList = state.selectedGyms.join(", ");
    await ctx.editMessageText(`Saved! Your group's gyms:\n${gymList}`);
  }
}

async function sendLocationMessage(
  ctx: Context,
  chatId: number,
  state: SetgymsState
): Promise<void> {
  const groups = loadGymGroups();
  const brand = state.selectedBrands[state.currentBrandIndex];
  const group = groups.find((g) => g.brand === brand)!;
  const keyboard = buildLocationKeyboard(group.gyms, state.selectedGyms);

  await ctx.editMessageText(`Select locations for ${brand}:`, {
    reply_markup: { inline_keyboard: keyboard },
  });
}

function buildBrandKeyboard(
  groups: { brand: string }[],
  selected: string[]
): { text: string; callback_data: string }[][] {
  const rows = groups.map((g) => {
    const icon = selected.includes(g.brand) ? "☑" : "☐";
    return [{ text: `${icon} ${g.brand}`, callback_data: `setgyms:brand:${g.brand}` }];
  });
  rows.push([{ text: "Next →", callback_data: "setgyms:next" }]);
  return rows;
}

function buildLocationKeyboard(
  gyms: string[],
  selected: string[]
): { text: string; callback_data: string }[][] {
  const rows = gyms.map((gym) => {
    const icon = selected.includes(gym) ? "☑" : "☐";
    return [{ text: `${icon} ${gym}`, callback_data: `setgyms:gym:${gym}` }];
  });
  rows.push([{ text: "Done ✓", callback_data: "setgyms:done" }]);
  return rows;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/setgyms-handler.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Add tests for callback interactions**

Append to `tests/setgyms-handler.test.ts`:

```typescript
describe("handleSetgymsCallback — brand toggle", () => {
  it("adds brand to selectedBrands on toggle", async () => {
    mockedGetState.mockResolvedValue({
      step: "brands",
      selectedBrands: [],
      selectedGyms: [],
      currentBrandIndex: 0,
    });

    const ctx = createCallbackCtx("setgyms:brand:Boulder Movement");
    await handleSetgymsCallback(ctx);

    expect(mockedSetState).toHaveBeenCalledWith(789, expect.objectContaining({
      selectedBrands: ["Boulder Movement"],
    }));
    expect(ctx.editMessageReplyMarkup).toHaveBeenCalled();
  });

  it("removes brand from selectedBrands on second toggle", async () => {
    mockedGetState.mockResolvedValue({
      step: "brands",
      selectedBrands: ["Boulder Movement"],
      selectedGyms: [],
      currentBrandIndex: 0,
    });

    const ctx = createCallbackCtx("setgyms:brand:Boulder Movement");
    await handleSetgymsCallback(ctx);

    expect(mockedSetState).toHaveBeenCalledWith(789, expect.objectContaining({
      selectedBrands: [],
    }));
  });
});

describe("handleSetgymsCallback — next", () => {
  it("transitions to locations step", async () => {
    mockedGetState.mockResolvedValue({
      step: "brands",
      selectedBrands: ["Fit Bloc"],
      selectedGyms: [],
      currentBrandIndex: 0,
    });

    const ctx = createCallbackCtx("setgyms:next");
    await handleSetgymsCallback(ctx);

    expect(mockedSetState).toHaveBeenCalledWith(789, expect.objectContaining({
      step: "locations",
      currentBrandIndex: 0,
    }));
    expect(ctx.editMessageText).toHaveBeenCalledWith(
      "Select locations for Fit Bloc:",
      expect.any(Object)
    );
  });
});

describe("handleSetgymsCallback — gym toggle", () => {
  it("adds gym to selectedGyms", async () => {
    mockedGetState.mockResolvedValue({
      step: "locations",
      selectedBrands: ["Fit Bloc"],
      selectedGyms: [],
      currentBrandIndex: 0,
    });

    const ctx = createCallbackCtx("setgyms:gym:Fit Bloc (Kent Ridge)");
    await handleSetgymsCallback(ctx);

    expect(mockedSetState).toHaveBeenCalledWith(789, expect.objectContaining({
      selectedGyms: ["Fit Bloc (Kent Ridge)"],
    }));
  });
});

describe("handleSetgymsCallback — done", () => {
  it("moves to next brand when more brands remain", async () => {
    mockedGetState.mockResolvedValue({
      step: "locations",
      selectedBrands: ["Boulder Movement", "Other"],
      selectedGyms: ["Boulder Movement (Bugis+)"],
      currentBrandIndex: 0,
    });

    const ctx = createCallbackCtx("setgyms:done");
    await handleSetgymsCallback(ctx);

    expect(mockedSetState).toHaveBeenCalledWith(789, expect.objectContaining({
      currentBrandIndex: 1,
    }));
    expect(ctx.editMessageText).toHaveBeenCalledWith(
      "Select locations for Other:",
      expect.any(Object)
    );
  });

  it("saves gyms and shows confirmation on final done", async () => {
    mockedGetState.mockResolvedValue({
      step: "locations",
      selectedBrands: ["Fit Bloc"],
      selectedGyms: ["Fit Bloc (Kent Ridge)", "Fit Bloc (Telok Ayer)"],
      currentBrandIndex: 0,
    });

    const ctx = createCallbackCtx("setgyms:done");
    await handleSetgymsCallback(ctx);

    expect(mockedDeleteState).toHaveBeenCalledWith(789);
    expect(mockedSetGroupGyms).toHaveBeenCalledWith(789, ["Fit Bloc (Kent Ridge)", "Fit Bloc (Telok Ayer)"]);
    expect(ctx.editMessageText).toHaveBeenCalledWith(
      expect.stringContaining("Saved!")
    );
  });

  it("handles expired session gracefully", async () => {
    mockedGetState.mockResolvedValue(null);
    const ctx = createCallbackCtx("setgyms:done");
    await handleSetgymsCallback(ctx);
    expect(ctx.editMessageText).toHaveBeenCalledWith(expect.stringContaining("expired"));
  });
});
```

- [ ] **Step 6: Run all tests**

```bash
npx vitest run tests/setgyms-handler.test.ts
```

Expected: all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/setgyms-handler.ts tests/setgyms-handler.test.ts
git commit -m "feat: add /setgyms handler with multi-step brand and location selection"
```

---

### Task 4: `/climbwhere2` command handler

**Files:**
- Create: `src/climbwhere2-handler.ts`
- Create: `tests/climbwhere2-handler.test.ts`

**Interfaces:**
- Consumes:
  - `getGroupGyms(chatId: number): Promise<string[] | null>` from `src/kv.ts`
  - `loadAllGymOptions(): string[]` from `src/config.ts`
  - `splitPollOptions(options: string[]): string[][]` from `src/handlers.ts`
  - `buildPollQuestion(question, index, total): string` from `src/handlers.ts`
- Produces:
  - `handleClimbwhere2(ctx: CommandContext<Context>): Promise<void>`

- [ ] **Step 1: Write the failing tests**

Create `tests/climbwhere2-handler.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/kv.js", () => ({
  getGroupGyms: vi.fn(),
}));

vi.mock("../src/config.js", () => ({
  loadAllGymOptions: vi.fn(() => [
    "Boulder Movement (Bugis+)",
    "Boulder Movement (Tai Seng)",
    "Fit Bloc (Kent Ridge)",
    "Climba",
  ]),
}));

import { getGroupGyms } from "../src/kv.js";
import { handleClimbwhere2 } from "../src/climbwhere2-handler.js";

const mockedGetGroupGyms = vi.mocked(getGroupGyms);

function createCtx() {
  return {
    chat: { id: 123 },
    reply: vi.fn(),
    api: { sendPoll: vi.fn() },
  } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("handleClimbwhere2", () => {
  it("replies with setup prompt when no preferences saved", async () => {
    mockedGetGroupGyms.mockResolvedValue(null);
    const ctx = createCtx();
    await handleClimbwhere2(ctx);

    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining("/setgyms")
    );
    expect(ctx.api.sendPoll).not.toHaveBeenCalled();
  });

  it("sends poll with saved gyms", async () => {
    mockedGetGroupGyms.mockResolvedValue(["Fit Bloc (Kent Ridge)", "Climba"]);
    const ctx = createCtx();
    await handleClimbwhere2(ctx);

    expect(ctx.api.sendPoll).toHaveBeenCalledWith(
      123,
      "Where are we climbing this week?",
      ["Fit Bloc (Kent Ridge)", "Climba"],
      expect.objectContaining({ is_anonymous: false, allows_multiple_answers: false })
    );
  });

  it("filters out gyms no longer in gyms.json", async () => {
    mockedGetGroupGyms.mockResolvedValue(["Fit Bloc (Kent Ridge)", "Nonexistent Gym"]);
    const ctx = createCtx();
    await handleClimbwhere2(ctx);

    expect(ctx.api.sendPoll).toHaveBeenCalledWith(
      123,
      expect.any(String),
      ["Fit Bloc (Kent Ridge)"],
      expect.any(Object)
    );
  });

  it("treats all-filtered-out as no preferences", async () => {
    mockedGetGroupGyms.mockResolvedValue(["Nonexistent Gym"]);
    const ctx = createCtx();
    await handleClimbwhere2(ctx);

    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining("/setgyms"));
    expect(ctx.api.sendPoll).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/climbwhere2-handler.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the handler**

Create `src/climbwhere2-handler.ts`:

```typescript
import { CommandContext, Context } from "grammy";
import { getGroupGyms } from "./kv.js";
import { loadAllGymOptions } from "./config.js";
import { splitPollOptions, buildPollQuestion } from "./handlers.js";

const POLL_QUESTION = "Where are we climbing this week?";

export async function handleClimbwhere2(ctx: CommandContext<Context>): Promise<void> {
  const chatId = ctx.chat.id;
  const saved = await getGroupGyms(chatId);

  if (!saved) {
    await ctx.reply("No gyms configured yet — use /setgyms to pick your group's gyms first.");
    return;
  }

  const allGyms = new Set(loadAllGymOptions());
  const validGyms = saved.filter((gym) => allGyms.has(gym));

  if (validGyms.length === 0) {
    await ctx.reply("No gyms configured yet — use /setgyms to pick your group's gyms first.");
    return;
  }

  const groups = splitPollOptions(validGyms);
  for (let i = 0; i < groups.length; i++) {
    await ctx.api.sendPoll(
      chatId,
      buildPollQuestion(POLL_QUESTION, i + 1, groups.length),
      groups[i],
      { is_anonymous: false, allows_multiple_answers: false }
    );
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/climbwhere2-handler.test.ts
```

Expected: all 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/climbwhere2-handler.ts tests/climbwhere2-handler.test.ts
git commit -m "feat: add /climbwhere2 handler using group gym preferences"
```

---

### Task 5: Register commands in bot and verify end-to-end

**Files:**
- Modify: `src/bot.ts` (register new commands and callback handler)
- Modify: `src/handlers.ts:18-26` (update INFO_TEXT)

**Interfaces:**
- Consumes:
  - `handleSetgyms(ctx)` from `src/setgyms-handler.ts`
  - `handleSetgymsCallback(ctx)` from `src/setgyms-handler.ts`
  - `handleClimbwhere2(ctx)` from `src/climbwhere2-handler.ts`
- Produces: working bot with new commands registered

- [ ] **Step 1: Register commands in bot.ts**

Modify `src/bot.ts`:

```typescript
import { Bot } from "grammy";
import {
  handleChatid,
  handleClimbwhen,
  handleClimbwhenCallback,
  handleClimbwhere,
  handleGyms,
  handleInfo,
  handleInspire,
} from "./handlers.js";
import { handleSetgyms, handleSetgymsCallback } from "./setgyms-handler.js";
import { handleClimbwhere2 } from "./climbwhere2-handler.js";

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) throw new Error("Missing TELEGRAM_BOT_TOKEN environment variable");

export const bot = new Bot(token);

bot.command("start", handleInfo);
bot.command("info", handleInfo);
bot.command("chatid", handleChatid);
bot.command("gyms", handleGyms);
bot.command("climbwhere", handleClimbwhere);
bot.command("climbwhere2", handleClimbwhere2);
bot.command("climbwhen", handleClimbwhen);
bot.command("setgyms", handleSetgyms);
bot.command("inspire", handleInspire);

bot.callbackQuery(/^climbwhen:/, handleClimbwhenCallback);
bot.callbackQuery(/^setgyms:/, handleSetgymsCallback);
```

- [ ] **Step 2: Update INFO_TEXT in handlers.ts**

Update the `INFO_TEXT` constant in `src/handlers.ts`:

```typescript
const INFO_TEXT = `I help this group coordinate climbing plans.

Commands:
/info - show this help message
/chatid - show this chat ID
/gyms - list all known gyms
/setgyms - choose which gyms your group frequents
/climbwhere - vote on where to climb (all gyms)
/climbwhere2 - vote on where to climb (group's gyms)
/climbwhen - vote on which days people are free
/inspire - receive questionable climbing wisdom`;
```

- [ ] **Step 3: Run full test suite and type check**

```bash
npx vitest run
npx tsc --noEmit
```

Expected: all tests PASS, no type errors.

- [ ] **Step 4: Commit**

```bash
git add src/bot.ts src/handlers.ts
git commit -m "feat: register /setgyms and /climbwhere2 commands"
```

---

### Task 6: Environment setup documentation

**Files:**
- Modify: `CLAUDE.md` (add KV environment variables)

**Interfaces:**
- Consumes: nothing
- Produces: updated documentation

- [ ] **Step 1: Add KV env vars to CLAUDE.md**

Add to the Configuration section of `CLAUDE.md`:

```markdown
- `KV_REST_API_URL` — Vercel KV endpoint (set automatically by Vercel KV integration)
- `KV_REST_API_TOKEN` — Vercel KV auth token (set automatically by Vercel KV integration)
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add Vercel KV environment variables to configuration"
```
