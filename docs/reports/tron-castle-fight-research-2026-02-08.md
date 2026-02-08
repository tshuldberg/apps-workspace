Perfect! Now I have comprehensive knowledge of the application. Let me create a detailed feature requirements document.

---

# Neon Castle Clash - Comprehensive Feature Requirements Document

## 1. App Overview

**Neon Castle Clash** is a browser-based real-time strategy (RTS) game with a Tron-inspired aesthetic. Two opposing sides (human player vs. AI in single-player, or two human players in multiplayer) build production and defensive structures that spawn automated combat units. Units march toward a center combat lane and engage in tactical battles. The game ends only when a castle (the central fortress of one side) is destroyed.

### Core Loop
1. Player earns gold from unit kills and passive income generation
2. Player spends gold on production buildings (which spawn units) and defense towers
3. Buildings automatically spawn units on timers
4. Units auto-engage enemies based on priority targeting rules
5. Defeated units award gold and kill credits to the killer
6. Victory condition: destroy the enemy castle

**Estimated Match Length:** ~5 minutes of gameplay

---

## 2. Tech Stack

| Component | Technology |
|-----------|-----------|
| **Frontend** | Vanilla HTML5, CSS3, JavaScript ES6+ |
| **Rendering** | Canvas 2D API |
| **Multiplayer** | Node.js 16+, WebSocket (ws library v8.18.1) |
| **Build System** | None (no build step required) |
| **Package Manager** | npm 6+ |
| **Testing** | None currently |
| **Linting** | None currently |

### Key Libraries
- **ws**: WebSocket server library for authoritative multiplayer mode

### Assets & Fonts
- **Fonts**: Orbitron, Exo 2, Bank Gothic (system fallback to sans-serif)
- **Colors**: Custom CSS variables (--cyan, --blue, --orange, --red, --text, --bg-0, --bg-1, --card)
- **Visual Theme**: Neon grid background with glow effects, cyan for player, orange for enemy

---

## 3. Architecture

### Single-File Engine Design
The entire game logic (1862 lines) resides in `game.js` with no classes or module imports. This design prioritizes simplicity and rapid prototyping.

### State Management
All mutable game state is contained in a single `state` object:

```javascript
state = {
  units: [],                 // Array of all active units
  buildings: [],            // Array of all placed buildings
  castles: [],             // Array of castles (player + enemy)
  effects: [],             // Array of visual effects (arrows, lightning)
  resources: {             // Gold for each side
    player: 520,
    enemy: 520
  },
  kills: {                 // Kill counts for score
    player: 0,
    enemy: 0
  },
  buffs: {                 // Active buff timers
    player: { attackSurge: 0, regenField: 0 },
    enemy: { attackSurge: 0, regenField: 0 }
  },
  timers: {                // AI scheduling timers
    aiBuild: 0,
    aiPower: 0,
    aiStartDelay: 2.8
  },
  selectedBuildingType: null,   // Currently selected building for placement
  inspectedBuildingId: null,    // Clicked building for inspector panel
  mouse: { x: 0, y: 0, inside: false },  // Mouse position
  winner: null,            // "player" or "enemy" when match ends
  idCounter: 0,           // Entity ID counter
  lastTime: 0             // Last frame timestamp for delta-time
}
```

### Entity System
All game entities (units, buildings, castles) are plain JavaScript objects with:
- `entityType`: "unit", "building", or "castle"
- `side`: "player" or "enemy"
- `hp`, `maxHp`: Health system
- `x`, `y`: 2D position in canvas space
- `radius`: Collision/visual radius
- Additional role-specific properties (dmg, range, cooldown, etc.)

### Configuration-Driven Design
All balance parameters (unit stats, building costs, timers, game constants) are defined in top-level objects:
- `UNIT_DEFS`: 5 unit type definitions with stats
- `BUILDING_DEFS`: 6 building type definitions with costs and behavior
- `POWERUPS`: 3 special ability definitions
- `UNIT_COLORS`, `BUILDING_COLORS`: Visual color palettes per side
- `GAME`: Core game constants (canvas layout, AI timing, economy parameters)

This design allows balance tweaking without code changes.

---

## 4. Features List

### 4.1 Unit Types (5 Total)
1. **Archer** - Ranged, low HP, fast attack
2. **Fighter** - Melee frontline, high HP, moderate damage
3. **Sorcerer** - Ranged with mana system, chain lightning spell
4. **Siege Hunter** - Anti-siege specialist, high damage to other siege units
5. **Siege Breaker** - Anti-building specialist, massive bonus vs. structures

### 4.2 Building Types (6 Total)
1. **Archer Hut** - Produces archers, most affordable
2. **Fighter Hall** - Produces fighters, durable production
3. **Sorcerer Spire** - Produces sorcerers, expensive but unique
4. **Siege Workshop** - Produces siege hunters, high cost
5. **Demolisher Foundry** - Produces siege breakers, highest cost
6. **Defense Tower** - Defensive structure, contains a loaded archer unit, attacks directly

### 4.3 Powerups (3 Total)
1. **Attack Surge** - Multiplies damage by 1.3x for 10 seconds (costs 320 gold)
2. **Regen Field** - Heals all units and buildings at 6 HP/sec (units) and 4.5 HP/sec (buildings/castles) for 9 seconds (costs 260 gold)
3. **EMP Pulse** - Eliminates all enemy units, keeps buildings, sets opponent gold to 0 (costs 1500 gold, uses entire economy cap)

### 4.4 Game Systems
- **Gold Economy**: Kill rewards + passive income with catch-up scaling, hard cap of 1500 gold
- **Unit Production**: Buildings spawn units on timers (3.5–10.8 seconds)
- **Combat Resolution**: Damage, death, kill credits, gold awards
- **Building Inspector**: Click any building to see stats (HP, production type, unit stats)
- **UI State Management**: Responsive panels for Build, Power, Inspect sections
- **Responsive Layout**: Compact mode at ≤1200px width with popup control panels

### 4.5 Canvas Layout
- **Canvas Size**: 2400×800 pixels (supports scaling via CSS)
- **Combat Lane**: y=200 (center horizontal band where battles occur)
- **Player Build Zone**: Bottom-left (x: 48–1028, y: 236–780)
- **Enemy Build Zone**: Bottom-right (x: 1372–2352, y: 236–780)
- **Player Castle**: x=1128, y=130
- **Enemy Castle**: x=1272, y=130
- **Dashed Lane Line**: Visual indicator of combat lane

---

## 5. Game Mechanics

### 5.1 Unit Types & Roles

#### Archer (Role: "ranged")
- **HP**: 70
- **Damage**: 14
- **Range**: 125 pixels
- **Attack Cooldown**: 1.1 seconds
- **Speed**: 42 pixels/second
- **Kill Value**: 1 point
- **Gold Value**: 36 gold
- **Visual**: Cyan/Orange triangle pointing in direction of movement
- **Special**: Creates arrow projectile effect on attack

#### Fighter (Role: "frontline")
- **HP**: 240
- **Damage**: 26
- **Range**: 28 pixels (melee)
- **Attack Cooldown**: 0.95 seconds
- **Speed**: 34 pixels/second
- **Kill Value**: 1 point
- **Gold Value**: 66 gold
- **Visual**: Cyan/Orange rotated square
- **Special**: None; pure frontline role

#### Sorcerer (Role: "sorcerer")
- **HP**: 86
- **Damage**: 32
- **Range**: 178 pixels
- **Attack Cooldown**: 0.62 seconds
- **Speed**: 30 pixels/second
- **Kill Value**: 2 points
- **Gold Value**: 100 gold
- **Mana Pool**: 140 (starts with 45)
- **Mana Regen**: 6 mana/second
- **Spell Cost**: 78 mana
- **Chain Count**: 3 jumps
- **Chain Range**: 108 pixels
- **Spell Scaling**: First hit 100% dmg, subsequent hits 45–82% (declining)
- **Mana Restore**: Gains 20 mana per additional kill from single spell
- **Visual**: Cyan/Orange diamond with mystical symbols; blue mana bar below
- **Special**: Chain lightning spell instead of normal attacks (when mana available)

#### Siege Hunter (Role: "siege_hunter")
- **HP**: 340
- **Damage**: 46
- **Range**: 290 pixels
- **Attack Cooldown**: 1.7 seconds
- **Speed**: 22 pixels/second
- **Kill Value**: 3 points
- **Gold Value**: 138 gold
- **Siege Bonus**: 2.45× damage multiplier vs. other siege units
- **Visual**: Cyan/Orange rectangle with extended arm
- **Special**: Targets other siege units first for tactical depth

#### Siege Breaker (Role: "siege_breaker")
- **HP**: 390
- **Damage**: 40
- **Range**: 295 pixels
- **Attack Cooldown**: 1.9 seconds
- **Speed**: 20 pixels/second
- **Kill Value**: 3 points
- **Gold Value**: 142 gold
- **Building Bonus**: 3.35× damage vs. buildings/castles
- **Non-Siege Penalty**: 0.72× damage vs. non-siege units
- **Visual**: Cyan/Orange shield-like polygon
- **Special**: Anti-structure role; penalized against non-siege units

### 5.2 Building Types & Production

#### Archer Hut
- **Cost**: 180 gold
- **HP**: 470
- **Radius**: 28 pixels
- **Production**: Archers every 3.5 seconds
- **Gold Value**: 74 gold (when destroyed)
- **Color**: Cyan (player) / Orange (enemy)
- **Visual**: Triangle with horizontal base

#### Fighter Hall
- **Cost**: 240 gold
- **HP**: 860
- **Radius**: 32 pixels
- **Production**: Fighters every 4.4 seconds
- **Gold Value**: 102 gold
- **Visual**: Rectangle with central tower

#### Sorcerer Spire
- **Cost**: 360 gold
- **HP**: 620
- **Radius**: 30 pixels
- **Production**: Sorcerers every 7.6 seconds
- **Gold Value**: 132 gold
- **Visual**: Triangle with mystical circle

#### Siege Workshop
- **Cost**: 420 gold
- **HP**: 980
- **Radius**: 34 pixels
- **Production**: Siege Hunters every 9.8 seconds
- **Gold Value**: 152 gold
- **Visual**: Octagon shape

#### Demolisher Foundry
- **Cost**: 450 gold
- **HP**: 1080
- **Radius**: 35 pixels
- **Production**: Siege Breakers every 10.8 seconds
- **Gold Value**: 160 gold
- **Visual**: Rectangle with extended chimney

#### Defense Tower
- **Cost**: 290 gold
- **HP**: 1300 (most durable structure)
- **Radius**: 24 pixels
- **Attack Damage**: 38
- **Attack Range**: 260 pixels
- **Attack Cooldown**: 0.55 seconds
- **Gold Value**: 128 gold
- **Loaded Archer**: Contains 1 archer unit (awarded on tower destruction)
- **Visual**: Tall rectangle with battlement top and loaded archer indicator

### 5.3 Powerups & Economy

#### Attack Surge
- **Cost**: 320 gold
- **Duration**: 10 seconds
- **Effect**: All units (and towers) gain 1.3× damage multiplier
- **Stacking**: Cannot stack; resets timer if already active
- **Visual**: Displayed in HUD buff row

#### Regen Field
- **Cost**: 260 gold
- **Duration**: 9 seconds
- **Unit Healing**: 6 HP/second
- **Building Healing**: 4.5 HP/second (applies to towers, production buildings, and castle)
- **Stacking**: Cannot stack; resets timer if already active
- **Visual**: Displayed in HUD buff row

#### EMP Pulse
- **Cost**: 1500 gold (entire economy cap)
- **Effect**:
  - Clears all enemy units from the board
  - **Does NOT destroy buildings or castles**
  - Sets opponent's gold to 0
  - Clears all visual effects
- **Stacking**: Can only be used when enough gold is available
- **Timing**: Useful as endgame reset button or to counter army snowball

### 5.4 Economy System

#### Gold Sources
1. **Kill Rewards**: Each defeated unit/building/castle grants gold equal to its `goldValue`
2. **Passive Income**: 4 gold/second baseline for both sides
3. **Kill Deficit Catch-Up**: Side behind on kills gains additional income
   - Formula: min(7 gold/sec, killDeficit × 0.55 gold/sec per kill behind)
4. **Total Income Cap**: 4 + 7 = 11 gold/second maximum

#### Gold Cap & Spending
- **Hard Cap**: 1500 gold maximum per side
- **Placement**: Costs are deducted immediately when building is placed
- **EMP Cost**: 1500 gold (forces choice: save for economy vs. use as tactical reset)

#### Cost Analysis (Gold Efficiency)
| Structure | Cost | Gold Value | Efficiency |
|-----------|------|-----------|------------|
| Archer Hut | 180 | 74 | 41% |
| Fighter Hall | 240 | 102 | 42.5% |
| Sorcerer Spire | 360 | 132 | 36.7% |
| Siege Workshop | 420 | 152 | 36.2% |
| Demolisher Foundry | 450 | 160 | 35.6% |
| Defense Tower | 290 | 128 | 44.1% |

### 5.5 Targeting & Prioritization

Units use a priority-based targeting system: priority 0 is highest, priority 4+ is ignored.

#### Siege Hunter Priority
- Priority 0: Other siege units (hunts for tactical control)
- Priority 1: Regular units
- Priority 2: Buildings

#### Siege Breaker Priority
- Priority 0: Buildings and castles (anti-structure role)
- Priority 1: Other siege units
- Priority 2: Regular units

#### Sorcerer Priority
- Priority 0: Units only (ignores buildings)
- Priority 4+: Never targets buildings

#### Archer, Fighter, and Defense Tower Priority
- Priority 0: Units
- Priority 1: Buildings
- Castle prioritized by default if no units/buildings in range

**Tiebreaker**: If priorities are equal, nearest target by distance wins.

### 5.6 Sorcerer Chain Lightning Spell

When a sorcerer has ≥78 mana:
1. **Target Selection**: Attacks primary target with 100% damage
2. **Chain Jump**: Finds nearest unchained enemy within 108 pixels
3. **Scaling Damage**: Jump 2+ deal 45–82% of base damage (decays per hop)
4. **Kill Bonus**: If multiple enemies die from single spell, sorcerer gains 20 mana per extra kill
5. **Mana Cost**: 78 mana consumed
6. **Visual Effect**: Lightning chain with jitter between impact points

### 5.7 Combat Resolution

**Per Frame Update**:
1. Update all unit positions and attack timers
2. Update building spawn timers
3. Resolve all attacks (damage, effect creation)
4. Apply buffs and regen
5. Detect deaths and award gold/kills
6. Check for castle destruction (win condition)

**Damage Calculation**:
```
finalDamage = baseDamage × role_bonus × attackSurge_multiplier
```

---

## 6. Multiplayer: WebSocket Server Architecture

### Server Design
- **Authoritative Server**: All game logic runs on server; clients send input only
- **Port**: 8080 (configurable via `PORT` env var)
- **Tick Rate**: 50ms per simulation tick (20 ticks/second)
- **Static File Serving**: HTTP server also serves `online.html`, `online-game.js`, `styles.css`

### Room System
- **Room Code**: 4–8 character alphanumeric code
- **Player Limit**: 2 players per room (player / enemy)
- **Side Assignment**: First player to join gets "player" side; second gets "enemy"
- **Auto-Matching**: Players manually create/join rooms; no automatic matchmaking

### Message Protocol (WebSocket)

#### Client → Server
```javascript
{
  type: "create-room" | "join-room" | "leave-room" | "build" | "powerup" | "inspect" | "restart-match"
  roomCode: "XXXX" (if applicable),
  side: "player" | "enemy" (if applicable),
  // Build action
  buildingType: "archerHut" | etc.,
  x: number,
  y: number,
  // Powerup action
  powerupKey: "attackSurge" | "regenField" | "emp"
}
```

#### Server → Client
```javascript
{
  type: "state-update" | "joined" | "left" | "error"
  state: { /* full game state snapshot */ },
  message: "string error or status",
  side: "player" | "enemy"
}
```

### Synchronization
- Server sends complete state updates at each tick to both connected clients
- Clients are **read-only** during gameplay; all mutations run on server
- Latency-resilient: Client renders latest server state immediately upon receipt

### Match Flow
1. Player A opens `online.html`, clicks "Create Room"
2. Server generates room code and stores room object
3. Player A shares code with Player B
4. Player B joins room with code
5. Server assigns sides (A = "player", B = "enemy")
6. Both clients notified of joined state
7. Server begins tick loop; sends state updates to both clients
8. Clients accept input (build clicks, powerup buttons) and send to server
9. Server validates input, applies changes, updates state
10. On castle destruction, server sets winner and broadcasts to clients
11. Clients show victory screen; restart button sends message to reset match

---

## 7. Single-Player AI Behavior

### AI Strategy
The enemy AI does not execute complex plans; instead it:
1. Randomly selects building types weighted by adaptive heuristics
2. Places buildings in random valid locations within its zone
3. Triggers powerups based on army composition and match state
4. Adapts building choices to counter player strategies

### AI Build Selection (Weighted Random)

**Base Weights** (favors early cheap production):
- Archer Hut: 3.0
- Fighter Hall: 2.9
- Sorcerer Spire: 1.9
- Siege Workshop: 1.5
- Demolisher Foundry: 1.5
- Defense Tower: 2.0

**Early Game Adjustment** (< 2 buildings):
- Archer Hut: +1.9 (rush early units)
- Fighter Hall: +2.1 (tank production)
- Defense Tower: −1.2 (less priority on defense early)

**No Buildings Adjustment**:
- Defense Tower: max(0.4, current − 1.2) (minimal early defense)

**Counter Logic** (adaptively adjusts to player army):
- If player has 2+ more archers than fighters: Sorcerer Spire +2.5
- If player has ≥2 siege units: Siege Workshop +2.3
- If enemy < 3 buildings: Defense Tower +1.0
- If player has 2+ more buildings: Demolisher Foundry +2.4

**Build Interval**: Every 2.1 seconds
**Placement**: Random location within enemy build zone (48 attempts per build cycle)
**Start Delay**: 2.8 seconds before first build attempt

### AI Powerup Logic

**Attack Surge**:
- Triggers when ≥6 enemy units alive AND no current surge active AND random(0–1) < 0.4
- Cost threshold: 320 gold available

**Regen Field**:
- Triggers when ≥1 unit is wounded (< 65% max HP) AND no current regen active AND random(0–1) < 0.5
- Cost threshold: 260 gold available

**EMP Pulse**:
- Triggers when 12+ player units alive AND ≤4 enemy units alive AND random(0–1) < 0.55
- Cost threshold: 1500 gold available
- Strategic: Used as desperation measure when outnumbered

**Powerup Interval**: Every 2.6 seconds

### Difficulty Notes
- AI is not unbeatable; human players can out-macro the AI and manage better production
- AI does not use long-term planning or psychology
- AI may block its own buildings with bad placement but will retry

---

## 8. UI/UX Design

### HUD (Head-Up Display)
Located at top of screen:
- **Title**: "Neon Castle Clash"
- **Helper Text**: Link to online mode (single-player) or back to single-player (online)
- **Stats Grid** (6 columns):
  - Player Gold / Enemy Gold
  - Player Kills / Enemy Kills
  - Player Buildings / Enemy Buildings
- **Buff Row** (2 columns):
  - Player Buffs / Enemy Buffs (displays "None" or active buff name + duration)

### Canvas Overlay Elements
- **Top Center**: Objective text with both castles' current HP
- **Combat Lane Indicator**: Dashed line at y=200 showing combat zone
- **Build Zone Borders**: Cyan outline for player zone (left), orange outline for enemy zone (right)
- **Zone Labels**: "Player Build Zone" (left), "Enemy Build Zone" (right)
- **Building Inspector Ring**: Dashed green circle around inspected building
- **Placement Ghost**: Dashed circle at mouse position showing valid (green) or invalid (red) placement
- **Win Screen**: Large centered black panel with victory text and side color border

### Responsive Design
**Desktop (> 1200px)**:
- 2-column control grid (Build | Power on left, full width)
- HUD fully visible at top
- All panels inline

**Mobile / Narrow (≤ 1200px)**:
- Quick action bar at top with 4 buttons: Build, Power, Inspect
- Clicking button opens corresponding popup panel over canvas
- Backdrop overlay (semi-transparent dark) behind popup
- Panels close via backdrop click or close button
- Canvas remains fully visible throughout

### Visual Effects

#### Arrow Projectile
- Rendered as line with arrowhead
- Origin: Archer unit position
- Destination: Target position
- Color: Cyan (player) / Orange (enemy)
- Glow: Shadow blur 9px
- Lifetime: 0.24 seconds
- Progress-based tail fade-in

#### Lightning Chain
- Rendered as jittered path connecting cast source to all chain targets
- Color: Cyan (player) / Orange (enemy)
- Glow: Shadow blur 16px
- Lifetime: 0.2 seconds
- Jitter: ±4px per point (except source)

#### Background Animation
- Animated grid lines scrolling at constant speed
- Cyan vertical/horizontal grid (very low opacity: 0.11)
- Grid spacing: 38 pixels
- Speed: 34 pixels/second horizontal shift
- Vertical center line: Slightly brighter (0.08 opacity)

### Drawing Order (Z-Index, Top to Bottom)
1. Background grid (animated)
2. Build zone borders and labels
3. Castles with glow
4. Buildings with glow
5. Units with glow and HP bars
6. Visual effects (arrows, lightning)
7. Placement ghost (dashed circle at mouse)
8. Overlay (objective text, win screen)

---

## 9. Key Commands & Running the Game

### Single-Player Mode

**Option A: Direct File**
```bash
cd /Users/trey/Desktop/Apps/tron-castle-fight
open index.html
```

**Option B: Local HTTP Server**
```bash
cd /Users/trey/Desktop/Apps/tron-castle-fight
python3 -m http.server 5500
# Then open http://localhost:5500/index.html
```

### Multiplayer Mode (Authoritative Server)

**Step 1: Install Dependencies**
```bash
cd /Users/trey/Desktop/Apps/tron-castle-fight
npm install
```

**Step 2: Start Server**
```bash
npm run start
# Server listens on port 8080
# Serves static files + WebSocket
```

**Step 3: Open Clients**
- Host (same machine): [http://localhost:8080/online.html](http://localhost:8080/online.html)
- Friend (same network): [http://<YOUR-LOCAL-IP>:8080/online.html](http://<YOUR-LOCAL-IP>:8080/online.html)

### Remote Play (Via Tunnel)

**Using Cloudflare Tunnel** (free, easy):
```bash
cloudflared tunnel --url http://localhost:8080
# Outputs: https://xxxx-xxxx-xxxx-xxxx.trycloudflare.com
# Share this URL with friend: https://xxxx-xxxx-xxxx-xxxx.trycloudflare.com/online.html
```

**Using ngrok** (free tier):
```bash
ngrok http 8080
# Outputs: https://xxxx-ngrok-free.app
# Share this URL with friend: https://xxxx-ngrok-free.app/online.html
```

---

## 10. Testing Approach

**Current State**: No automated tests configured.

**Manual Testing Checklist** (from README):
1. ✓ Place buildings in your own zone only
2. ✓ Confirm buildings cannot overlap
3. ✓ Click a building and verify inspector shows stats
4. ✓ Confirm castle destruction ends the match
5. ✓ Confirm gold never exceeds 1500
6. ✓ Trigger EMP and verify all units disappear, buildings remain, opponent gold = 0
7. ✓ In online mode, verify both players see synchronized state
8. ✓ At narrow widths (≤1200px), verify quick controls open popup panels and map stays visible

**Balance Testing**:
- Play 5–10 minute matches to tune unit stats, building costs, AI decision weights
- Record match outcomes to identify dominant strategies
- Adjust via `UNIT_DEFS`, `BUILDING_DEFS`, `POWERUPS`, `GAME` constants

---

## 11. Governance & Project Management

### PROJECT_LOG.md Structure
Every meaningful work session updates the log with structured entries:

```md
### Entry NNNN
- Timestamp: YYYY-MM-DDTHH:MM-08:00
- Title: Short descriptive title
- Request Summary: What was requested
- Why: Rationale for the change
- Actions:
  - Bullet list of code changes
- Files Changed:
  - /absolute/path/file1
  - /absolute/path/file2
- Validation:
  - Manual test or command result
- Commit: <hash> or pending
- Next Steps:
  - Follow-up work or known issues
```

### Historical Entries (As of 2026-02-07)

| Entry | Date | Summary |
|-------|------|---------|
| 0001 | 2026-02-07 13:00 | Core game expansion: buildings, units, combat, powerups |
| 0002 | 2026-02-07 13:45 | Castle destruction victory, gold cap, EMP system |
| 0003 | 2026-02-07 14:05 | Multiplayer WebSocket server + online mode |
| 0004 | 2026-02-07 14:15 | UI compaction & board scaling for visibility |
| 0005 | 2026-02-07 14:20 | Project governance: AGENTS.md, PROJECT_LOG.md, skill workflow |
| 0006 | 2026-02-07 14:24 | Governance finalization + skill automation |
| 0007 | 2026-02-07 14:38 | Responsive design: half-window panels, mobile-first controls |
| 0008 | 2026-02-07 14:50 | Passive gold income + kill-deficit catch-up economy |

### AGENTS.md Rules
- Maintain `PROJECT_LOG.md` continuously
- Add entry for every meaningful session (behavior/architecture/balance/network/docs change)
- Never delete historical entries (correct with new entries if needed)
- Keep entries factual and linkable to commits
- Use `project-log-updater` skill to automate entry creation

---

## 12. Current State & Feature Completeness

### Implemented Features
- ✅ 5 unit types with role-based targeting
- ✅ 6 building types (5 production + 1 defense)
- ✅ 3 powerups (Attack Surge, Regen Field, EMP Pulse)
- ✅ Castle destruction victory condition
- ✅ Gold economy with passive income + kill-deficit catch-up
- ✅ Single-player AI (weighted random building, adaptive powerup logic)
- ✅ Authoritative multiplayer WebSocket server
- ✅ Responsive UI with popup panels for mobile
- ✅ Building inspector (click to view stats)
- ✅ Sorcerer chain lightning with mana system
- ✅ Siege unit specialization (hunter vs. breaker)
- ✅ Defense tower with loaded archer

### Known Limitations / Future Opportunities
1. **No spectator mode**: Only 2-player matches
2. **No replay system**: Matches not recorded for analysis
3. **No ELO/ranking**: Multiplayer has no MMR or skill tracking
4. **Limited AI personality**: AI is pseudo-random, not strategic
5. **No unit grouping**: Cannot select/command multiple units at once
6. **No fog of war**: Both sides see the entire map
7. **No sound effects**: Visual only
8. **No mobile touch support**: Tested only on desktop browsers

### Balance Status (As of Entry 0008)
- Early game: Passive income allows behind players to catch up
- Mid game: Siege units require tech investment but provide hard counters
- Late game: EMP serves as reset button or economy punish
- Match length target: ~5 minutes (realistic)
- AI difficulty: Moderate (beatable by skilled play)

---

## 13. Feature Requirements by System

### 13.1 Unit System

**Purpose**: Create tactical depth through diverse roles and specializations

**Unit Types**:
| Type | Role | Purpose | Counter |
|------|------|---------|---------|
| Archer | Ranged | Safe DPS from distance | None (basic unit) |
| Fighter | Melee | Frontline tank | Sorcerer chain |
| Sorcerer | Spell | AoE with mana | Siege hunter (hunts mages) |
| Siege Hunter | Anti-Siege | Counter other siege | Siege breaker/buildings |
| Siege Breaker | Anti-Building | Destroy enemy infrastructure | EMP pulse (clears units) |

**Mechanics**:
- Units auto-spawn from buildings on timer (3.5–10.8 seconds)
- Units march to center lane (y=200) and engage enemies
- Attack cooldown modified by Attack Surge powerup (1.3× multiplier)
- Range-based targeting with priority system
- Death → gold + kill credit → potential for comeback

**Balance Parameters**:
- HP: Ranges 70–390 (archer to siege breaker)
- Damage: Ranges 14–46 baseline (multipliers for specializations)
- Attack Speed: Ranges 0.55–1.7 seconds cooldown
- Speed: Ranges 20–42 pixels/second (faster = more agile, slower = more durable)
- Gold Value: Ranges 36–142 (reward for defeating them)

**Edge Cases**:
- Sorcerer with 0 mana: Falls back to normal attacks instead of chain spell
- Siege units vs. non-siege: Multipliers apply only to correct target type
- Defense tower: Unique "unit" loaded inside (archer) that awards gold on tower destruction
- Unit death to self: Does not award kill credit (no gold for killing own units)

### 13.2 Building System

**Purpose**: Create strategic depth through production capacity and defense

**Building Types**:
| Type | Cost | Role | Production |
|------|------|------|-----------|
| Archer Hut | 180 | Entry-level production | Archer every 3.5s |
| Fighter Hall | 240 | Tanky production | Fighter every 4.4s |
| Sorcerer Spire | 360 | Unique production | Sorcerer every 7.6s |
| Siege Workshop | 420 | Specialized production | Siege Hunter every 9.8s |
| Demolisher Foundry | 450 | High-cost production | Siege Breaker every 10.8s |
| Defense Tower | 290 | Defense + detection | Direct attacks, contains archer |

**Mechanics**:
- Place only in own build zone (spatial constraint)
- Cannot overlap (12px gap minimum)
- Cannot place too close to own castle (20px minimum distance)
- Max 20 buildings per side (soft cap to prevent spam)
- Buildings have HP and take damage from enemy units
- When destroyed, award gold to killer + kill credit
- Regen Field powerup heals buildings at 4.5 HP/second

**Placement Validation**:
- Zone boundary check (must be within colored zone)
- No overlap with existing buildings (collision)
- No stacking on own castle
- Gold check (must have enough)
- Building cap check (max 20)

**Balance Parameters**:
- Cost: Ranges 180–450 gold
- HP: Ranges 470–1300 (archer hut to defense tower)
- Gold Value: Ranges 74–160 (reward on destruction)
- Production Interval: Ranges 3.5–10.8 seconds (higher cost = slower production)

**Edge Cases**:
- Building destroyed while spawning: Unit still spawns before building dies
- EMP pulse: Clears units but **not buildings** (allows defensive plays)
- Defense tower without loaded archer: Tower attacks but gives no gold to killer for archer
- Tower targeting: Finds nearest enemy unit in range, not priority-based

### 13.3 Combat System

**Purpose**: Resolve unit vs. unit, unit vs. building, and unit vs. castle battles

**Targeting Priority**:
- Each unit role has a priority function for each target type
- Priority 0 = highest, Priority 4+ = ignored
- Tiebreaker by distance (nearest first)

**Damage Calculation**:
```
finalDamage = baseDamage
  × siegeBonus (if siege hunter vs. siege unit)
  × buildingBonus (if siege breaker vs. building/castle)
  × buildingPenalty (if siege breaker vs. non-siege)
  × attackSurge (if buff active)
```

**Death Resolution**:
1. Each frame, process all entities with hp ≤ 0
2. Award kill credit (1–3 points per unit)
3. Award gold to killer's side
4. Remove dead entity from game
5. Check for castle destruction → game end

**Defense Tower Attack**:
- Every 0.55 seconds (or 1.3× faster if Attack Surge active)
- Damage: 38 per hit
- Range: 260 pixels
- Target: Nearest enemy unit in range (not priority-based)
- Contains loaded archer: When tower destroyed, adds 1 archer kill credit + 36 gold to killer

**Sorcerer Chain Lightning**:
- Triggers when mana ≥ 78
- Damage: 100% to first target, scaling down for hops
- Chain range: 108 pixels from current target
- Hops: Up to 3 targets (3 jumps max)
- Scaling: Jump 2+ deal (0.82 − jump × 0.18) × damage, min 0.45×
- Bonus: +20 mana per extra kill from single spell

**Edge Cases**:
- Overkill damage: Excess damage is wasted (no carry-over)
- Simultaneous death: If both units kill each other, both awards apply
- No "kill stealing": Whoever deals last hit (unit still alive) gets credit
- Building destruction without killer: Enemy gets kill credit (by proximity/lastHitBy)

### 13.4 Economy System

**Purpose**: Balance resource scarcity vs. agency, reward kills, allow comebacks

**Gold Sources**:
1. **Kill Rewards**: Unit destroyed → +goldValue to killer's side
2. **Building Destruction**: Building destroyed → +goldValue to killer's side
3. **Castle Destruction**: Castle destroyed → +260 gold to killer (but match ends)
4. **Passive Income**: +4 gold/second to both sides (baseline)
5. **Kill-Deficit Catch-Up**: Side with fewer kills gains additional income
   - Formula: +min(7, killDeficit × 0.55) gold/second
   - Max total: 4 + 7 = 11 gold/second (when far behind)

**Spending**:
- Building placement: Immediate cost deduction
- Powerup activation: Immediate cost deduction
- No refunds or cancellations

**Gold Cap**:
- Hard cap: 1500 gold per side
- EMP Pulse costs exactly 1500 gold
- Passive income stops accumulating at cap

**Economy Flow**:
1. Early game: Both sides start with 520 gold (enough for 2–3 buildings)
2. First kills: Archers/fighters start dying → income kicks in
3. Mid game: Passive income + kills enable tech progression (siege units)
4. Late game: Catch-up mechanics prevent permanent snowball; EMP serves as reset button

**Balance Notes**:
- Early rush builds rely on initial 520 gold + first 2–3 kills
- Tech investment (siege buildings) requires surviving to mid-game
- EMP is last-resort desperation play, not spam option (1500 gold = entire economy)
- Catch-up income prevents hard lock-out for losing side

**Edge Cases**:
- Zero gold: Player cannot place buildings but still generates passive income
- Simultaneous kills: Both sides receive awards in same frame
- EMP blocks both sides: Used unit clears, but opponent also damaged (mutual reset)
- Powerup without kill rewards: Passive income enables powerup spam late-game

### 13.5 Multiplayer System

**Purpose**: Enable 1v1 online play with fair and synchronized gameplay

**Architecture**:
- **Server**: Authoritative, runs full game simulation every 50ms
- **Clients**: Render current state, send input only (build, powerup actions)
- **Latency**: Any network delay; server treats input as same-frame if received before next tick

**Room System**:
- Room code: 4–8 character string (e.g., "ABC123DE")
- Create room: Player A generates new room, server assigns code
- Join room: Player B enters code, server validates, assigns to room
- Leave room: Player disconnects, room closed if empty
- Match reset: Both players can request restart; server allows

**State Synchronization**:
- Server sends full state snapshot every tick (50ms)
- State includes: units, buildings, castles, effects, resources, kills, buffs, winner
- Client renders latest state immediately (no lag compensation)
- Client input queued and applied next server tick

**Fairness**:
- Both players' builds validated on server (no client-side prediction)
- Both players subject to same build zone constraints
- Gold cap enforced server-side
- Victory condition checked server-side

**Disconnect Handling**:
- If client disconnects mid-match: Server stops simulation, waits for reconnect (no timeout spec)
- If both players leave: Room is destroyed
- Rejoin: Player can rejoin with same room code if match still active

**Edge Cases**:
- Simultaneous builds: Server processes in order received; may conflict if both place at same spot
- Simultaneous powerups: Both process in order received; one may fail due to gold/cooldown
- Network stutter: Client renders stale state briefly; updates when server state arrives
- High latency: Gameplay feels responsive because server is authoritative (player doesn't wait for ack)

### 13.6 AI System

**Purpose**: Provide single-player experience with strategic challenge

**Building AI**:
- **Frequency**: Attempt build every 2.1 seconds (if affordable)
- **Type Selection**: Weighted random from affordable buildings
- **Placement**: Random valid location within enemy build zone (48 attempts max)
- **Start Delay**: 2.8 seconds before first build attempt

**Building Weights** (adaptively adjusted):

**Base Weights**:
```
archerHut: 3.0         (most common early)
fighterHall: 2.9       (similar, slight edge archer)
defenseTower: 2.0      (moderate defensive)
sorcererSpire: 1.9     (niche, counters archers)
siegeWorkshop: 1.5     (expensive, specialized)
demolisherFoundry: 1.5 (highest cost, endgame)
```

**Adaptive Adjustments**:
- Early game (< 2 buildings): Favor cheap production (+1.9 archer, +2.1 fighter, −1.2 tower)
- No buildings: Minimize tower weight (max 0.4)
- vs. Archer rush (player has 2+ more archers): +2.5 sorcerer spire weight
- vs. Siege rush (player has ≥2 siege): +2.3 siege workshop weight
- Limited defenses (enemy < 3 buildings): +1.0 tower weight
- Economy advantage (player has 2+ more buildings): +2.4 demolisher foundry weight

**Powerup AI**:
- **Attack Surge**: Trigger when ≥6 units alive, no current buff, random < 0.4
- **Regen Field**: Trigger when ≥1 wounded unit, no current buff, random < 0.5
- **EMP Pulse**: Trigger when 12+ player units vs. ≤4 enemy units, random < 0.55 (desperation)
- **Frequency**: Check every 2.6 seconds

**Difficulty Assessment**:
- **Beginner**: Beatable by turtle strategy (heavy defense + few units)
- **Intermediate**: Requires active production and micro-management
- **Hard**: Not implemented (would require strategic planning, psychology)

**Known Limitations**:
- No long-term strategy (only 2.1s lookahead)
- No psychology (e.g., doesn't punish excessive defense builds)
- Placement can be suboptimal (random, not optimal layout)
- Doesn't learn from player (weights are static)

### 13.7 UI/UX System

**Purpose**: Provide clear, responsive controls for both single-player and multiplayer

**Desktop Layout (> 1200px)**:
- Top: HUD with stats (6 columns)
- Middle: 2-column control grid (Build | Power on left, full width)
- Bottom: Canvas (2400×800)
- Building Inspector: Overlay on canvas when building clicked

**Mobile/Compact Layout (≤ 1200px)**:
- Top: HUD with stats (compact, 3×2 grid or scaled)
- Quick Action Bar: 4 buttons (Build, Power, Inspect, Room if online)
- Canvas: Full width, no side panels
- Control Panels: Popup overlays that appear on button click
- Backdrop: Semi-transparent dark overlay behind popups
- Close: Click backdrop or close button to dismiss

**Panel Behavior**:
- Only one panel open at a time (except room panel in online mode)
- Escape key closes current panel
- Canvas clicks dismissed panels (if not inspecting building)
- Mobile action bar visible only at ≤1200px

**Building Inspector**:
- Click building on canvas → highlights with dashed green ring
- Inspector shows:
  - Building name (e.g., "Archer Hut")
  - Owner (Player or Enemy)
  - Current HP / Max HP
  - Production info (if production building) or "None (defensive structure)"
  - Unit stats (if production): HP, DMG, Range, Attack Speed
  - Tower stats (if defense): Tower DMG, Tower Range, Tower Attack Speed

**Canvas Overlay Elements**:
- **Top Center**: Objective (destroy enemy castle) + both castle HP
- **Background**: Animated cyan/orange grid (very faint)
- **Zones**: Cyan border for player zone, orange border for enemy zone
- **Lane Indicator**: Dashed line at y=200 (center combat lane)
- **Placement Ghost**: Dashed circle at mouse (green = valid, red = invalid)
- **Win Screen**: Large centered panel with "PLAYER VICTORY" or "ENEMY VICTORY"

**Keyboard Shortcuts**:
- **Escape**: Clear building selection or close panel

**Mouse Interactions**:
- **Canvas Click**: Place selected building (if valid), or inspect clicked building
- **Canvas Hover**: Show placement preview (ghost circle)
- **Button Click**: Select building type for placement, activate powerup, open panel

### 13.8 Visual Design System

**Purpose**: Create cohesive Tron-inspired aesthetic with clear visual hierarchy

**Color Palette**:
```css
--cyan: #00f5ff        (player units/buildings)
--blue: #2ea6ff        (secondary highlights)
--orange: #ff9c29      (enemy units/buildings)
--red: #ff4f47         (error/invalid placement)
--text: #ddf6ff        (UI text)
--bg-0: #02040a        (dark background)
--bg-1: #07142b        (slightly lighter bg)
--card: rgba(4, 12, 28, 0.74)  (panel background)
```

**Typography**:
- Font family: Orbitron, Exo 2, Bank Gothic, sans-serif (fallback)
- Sizes: Clamp 0.58rem–1rem (responsive)
- Text transform: UPPERCASE for headings
- Letter spacing: 0.06–0.09em (tight, futuristic)

**Visual Effects**:
- **Glow**: Canvas shadow blur 9–16px on units, buildings, castles
- **Grid Animation**: 38px spacing, 34px/sec horizontal scroll
- **Jitter**: ±4px on lightning chain points
- **Alpha Blending**: 0.05–0.95 opacity for layers, effects fading

**UI Components**:
- **Cards**: Border 1px cyan, border-radius 11px, inset shadow
- **Buttons**: Rounded, bordered, hover state (brightness change)
- **Input Fields**: Cyan border, dark background, cyan text
- **Disabled State**: Reduced opacity, non-interactive

**Unit Shapes** (per unit type):
- **Archer**: Triangle pointing in direction
- **Fighter**: Rotated square (diamond)
- **Sorcerer**: Diamond with mystic symbols
- **Siege Hunter**: Rectangle with extended arm
- **Siege Breaker**: Shield-like polygon

**Building Shapes** (per building type):
- **Archer Hut**: Triangle with horizontal base
- **Fighter Hall**: Rectangle with central tower
- **Sorcerer Spire**: Triangle with mystical circle
- **Siege Workshop**: Octagon shape
- **Demolisher Foundry**: Rectangle with chimney
- **Defense Tower**: Tall rectangle with battlement and archer indicator

---

## 14. Known Issues & Limitations

1. **Placement Validation UX**: Ghost circle shows as invalid (red) if too close to castle; players often try multiple clicks before placing
2. **AI Pathfinding**: Units sometimes overlap or cluster inefficiently
3. **Network Latency**: High-latency matches (>200ms) may feel jittery due to state updates
4. **Mobile Support**: Touch controls not implemented; mouse-only (can use trackpad on mobile browser)
5. **EMP Balance**: May be too powerful as endgame reset (1500 gold entire economy)
6. **Siege Unit Cost**: High cost may gate them out of early game strategies
7. **Sorcerer Mana Regen**: Starts at 45/140 mana, may make spell unavailable early

---

## 15. Next Steps & Roadmap

**Short-term (Balance)**:
- Play-test 10+ matches to tune passive income rates
- Adjust siege unit costs if too gated or too dominant
- Test EMP powerup frequency in endgame scenarios

**Medium-term (Features)**:
- Add replay system (record all player actions, replay match)
- Add spectator mode (3rd player watching match)
- Add unit/building grouping (select multiple units with drag)
- Implement fog of war (hide enemy army composition)

**Long-term (Content)**:
- Add more unit types (15+) with deeper roles
- Add map variants (different zone layouts, terrain hazards)
- Add skill-based ranking system (ELO, MMR)
- Add leaderboards and match history
- Add sound effects and music

---

## Summary

Neon Castle Clash is a **lean, configuration-driven RTS game** optimized for fast feedback loops and easy balance tuning. The core gameplay loop is **simple and engaging**: build → spawn → fight → earn gold → repeat. The AI and multiplayer systems provide sufficient challenge and social features for casual play.

The architecture (single-file ~1900-line engine, plain object entities, top-level config constants) prioritizes **transparency and modifiability** over abstraction. Future developers can tweak any aspect by changing numbers in `UNIT_DEFS`, `BUILDING_DEFS`, `POWERUPS`, or `GAME`.

All work is tracked in `PROJECT_LOG.md` with structured entries linking to commits, ensuring continuity and institutional memory for future sessions.