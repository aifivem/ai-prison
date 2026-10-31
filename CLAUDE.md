# ai-prison

Jail sentences counted by the server: police (ai-police "Send to prison") or admins jail a player for some minutes, the items are taken at the gate and given back at release, prison work spots shorten the sentence, a canteen hands out meals, and leaving the prison area sends the player back with extra time and a police alert. Port of qb-prison's features, server-authoritative. Depends on ai-core (characters, metadata, inventory and dispatch layers, panel); no database.

## Decisions

- The server owns the clock: minutes left live in ai-core's character metadata under QB's key `injail` (QB scripts and the QB bridge see it), one tick a minute for the jailed players online; clients only show what the server sends (`EVENTS.state`). qb-prison let the client set the time; nothing here trusts a client value.
- Time served offline is optional (panel `countOffline`): the unload stores `ai:jailLeftAt`, the next load subtracts the minutes since.
- Items at the gate (panel `confiscate`): the inventory is copied into metadata `jailitems` (name, count, metadata) and cleared through lib `inventory`; release adds them back (a full inventory logs what did not fit). A second jailing while the list is still stored keeps the first list.
- Escapes are not a prison-break minigame: every 10 s the server tests each jailed player's server-side position against the panel area (`zone` widget, lib `polyFromCorners` / `zoneContains`); outside it the player goes back to a random cell with `escapePenalty` minutes added and, when on, a lib `dispatch` alert.
- Work spots and the canteen are lib `Points` shown only to jailed players (work spots kept per record by lib `RecordObjects`, the canteen re-placed on a settings change); work runs through lib `PendingActions` (token, 80% of the time) with a lib `progress` (scenario, movement and combat blocked); cooldowns are `KeyedCooldowns` by character id (a reconnect does not reset them).
- Other scripts jail through ai-core's prison layer (lib `prison.jail / release / timeLeft`, ai-core `resource/server/prison.ts`, adapters ai-prison and qb-prison), never ai-prison's exports. A script that writes `injail` itself (a QB police job through the bridge's `SetMetaData`) is honoured: the `metaChanged` event of that key starts or ends the sentence here.
- No NUI: the time left is a notification at entry, at every 10 minutes and in the last 5, and on the radial "Sentence" item (lib `radial`, shown only while jailed).
- Teleports wait until ai-core reports the character in the world (a sentence continuing after a login arrives during the spawn).

## Contracts

- Events and callbacks: `resource/common/prison.ts` (`state`, `move`, actions `workStart`, `workDone`, `canteen`).
- Server exports `JailPlayer(source, minutes, by?)`, `ReleasePlayer(source)`, `GetJailTime(source)` (ai-core's prison adapter calls them).
- Metadata keys `injail`, `jailitems`, `ai:jailLeftAt`. Admin commands `jail <id> <minutes>`, `unjail <id>`.
- Panel: `data/settings.json` and `data/tasks.json`, both `sync: "all"` (clients draw the points).

## Entry points

- Sentences, release, escapes: `resource/server/sentences.ts`; work, canteen, exports, commands: `resource/server/index.ts`; panel `server/schema.ts`.
- Client points, teleports, time notifications: `resource/client/index.ts`.
