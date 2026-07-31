# Group Gym Preferences

Per-group gym preference configuration so each Telegram chat can choose which gyms appear in their weekly climbing poll.

## Commands

### `/setgyms` — Configure group gym preferences

Multi-step inline button flow:

**Step 1: Brand selection**

Bot sends a message with 7 toggleable inline buttons:

- Boulder Movement
- Boulder Planet
- Boulder Plus
- BFF Climb
- Climb Central
- Fit Bloc
- Other

Each button toggles between `☐ Brand` and `☑ Brand`. A "Next →" button is shown to proceed.

**Step 2: Location selection**

For each selected brand (including "Other"), bot sends a follow-up message showing individual locations as toggleable buttons:

| Brand | Locations |
|-------|-----------|
| Boulder Movement | Bugis+, Downtown, Rochor, Tai Seng |
| Boulder Planet | Sembawang, Tai Seng |
| Boulder Plus | Aperia, Chevrons |
| BFF Climb | Bendemeer, Tampines Hub, Tampines Yoha |
| Climb Central | Kallang Wave Mall, Funan, Novena, SAFRA Choa Chu Kang |
| Fit Bloc | Depot Heights, Kent Ridge, Telok Ayer |
| Other | Ark Bloc, ClimbUp (i12 Katong), Climba, Ground Up Climbing, Kinetics Climbing, Lighthouse (Pasir Panjang), Outpost Climbing, OYEYO Boulder Home, Upwall Climbing Downtown East, Z-Vertigo Boulder Gym |

Each location message has a "Done ✓" button. The bot processes selected brands sequentially — after the user taps "Done ✓" on one brand's locations, the next brand's location message is sent. After the final brand's "Done ✓", the full selection is persisted.

**Confirmation:** Bot sends a summary message listing all selected gyms (e.g. "Saved! Your group's gyms: Boulder Movement (Bugis+), Fit Bloc (Kent Ridge), Climba").

### `/climbwhere2` — Poll using group preferences

- Reads saved gym preferences from Vercel KV for the current chat ID
- If no preferences are set: replies "No gyms configured yet — use /setgyms to pick your group's gyms first."
- If preferences exist: sends one or more Telegram polls (split at 10 options, same logic as existing `handleClimbwhere`)

## Storage

**Vercel KV (Upstash Redis)**

- Key: `gyms:<chatId>` (e.g. `gyms:-1001234567890`)
- Value: JSON-serialized string array of gym names (e.g. `["Boulder Movement (Bugis+)", "Fit Bloc (Kent Ridge)"]`)
- No TTL — preferences persist indefinitely

## Data Model

Gym groupings are derived from `gyms.json`. A mapping structure defines which brand each gym belongs to:

```typescript
interface GymGroup {
  brand: string;
  gyms: string[]; // full gym names from gyms.json
}
```

The "Other" group contains all gyms that don't belong to a multi-location brand.

## Interaction State

The `/setgyms` flow requires tracking in-progress selections across multiple callback queries. State is stored in Vercel KV with a short TTL:

- Key: `setgyms:<chatId>` 
- Value: JSON object tracking current step, selected brands, and selected gyms so far
- TTL: 10 minutes (auto-expires if user abandons the flow)

## Permissions

- Anyone in the group can run `/setgyms` — no admin restriction
- Running `/setgyms` overwrites the previous configuration entirely

## Edge Cases

- If `gyms.json` changes (gyms added/removed), existing saved preferences remain valid. Gyms that no longer exist in `gyms.json` are silently filtered out at poll time.
- If all saved gyms are filtered out (all removed from `gyms.json`), behaves as if no preferences are set.
- Multiple users running `/setgyms` simultaneously: last write wins (acceptable for this use case).

## Future Work

- Replace `/climbwhere` with `/climbwhere2` once validated
- Remove `poll_gyms.json` as it becomes unnecessary
