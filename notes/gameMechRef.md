# 🪳 Cockroach Janta Party (CJP) - Full Game Mechanics Reference

> **Document Scope:** Captures CURRENT implemented gameplay behavior in: `index.html`, `game.js`, `popups.js`, `audio.js`, `style.css`

---

## 📑 Table of Contents

### Core Systems
- [1. Core Loop & States](#1-core-loop--states)
- [2. Controls](#2-controls)
- [3. Player (Original Cockroach)](#3-player-original-cockroach)

### UI & Feedback
- [4. HUD (Top Left Panel)](#4-hud-top-left-panel)
- [9. Popup System](#9-popup-system-ui-hazard-layer)
- [10. Audio System](#10-audio-system)

### Hazard Systems
- [5. Hazard Systems](#5-hazard-systems)
  - [5.1 Bata Chappal](#51-bata-chappal)
  - [5.2 Baygon Cloud](#52-baygon-cloud)
  - [5.3 Torch Sweep](#53-torch-sweep)

### Progression & Collectibles
- [6. Power-Ups & Collectibles](#6-power-ups--collectibles)
  - [6.1 Crumb](#61-crumb)
  - [6.2 Shield (Grease Shield)](#62-shield-grease-shield)
  - [6.3 Speed (Speed Tantrum)](#63-speed-speed-tantrum)
  - [6.4 Ally Pickup](#64-ally-pickup)
- [7. Ally Roach System](#7-ally-roach-system)

### Game Logic
- [8. Damage Resolution Priority](#8-damage-resolution-priority)
- [11. Landing Page Mechanics](#11-landing-page-mechanics)
- [12. Persistence](#12-persistence)
- [13. Balance Summary](#13-notable-balance-summary-current)
- [14. Quick Reference Constants](#14-quick-reference-constants)

---

## 1. Core Loop & States

### State Flow Diagram

```
┌────────────────────────────────────────┐
│         INIT → LANDING                 │
│                  ↓                     │
│   (Click "Flip Light Switch")          │
│                  ↓                     │
│          PLAYING ←→ PAUSED             │
│                  ↓                     │
│              GAMEOVER                  │
│                  ↓                     │
│            (Restart loop)              │
└────────────────────────────────────────┘
```

### Gameplay Flow

| Phase | Behavior |
|-------|----------|
| **Landing** | Interactive bulb + light switch button visible |
| **Entering Game** | Click "Flip Light Switch" → dark gameplay begins |
| **PLAYING** | `requestAnimationFrame` loop updates game logic + draws canvas |
| **PAUSED** | Freeze/resume via pause menu overlay |
| **GAMEOVER** | Triggered when hearts = 0; restart available |

---

## 2. Controls

### Mode Selection
Control mode is selected from **Landing radio settings**:
- **Follow Touch/Cursor** (`mode = follow`)
- **Joystick** (`mode = joystick`)

> ℹ️ **Note:** No viewport auto-switching; mode is explicit.

### 2.1 Follow Mode

```
Desktop:
├─ Mouse position relative to screen center
├─ Defines movement direction & intensity
└─ Deadzone: ~30px from center

Mobile:
├─ Touch/pointer move
├─ Updates same follow target
└─ Same deadzone applies
```

### 2.2 Joystick Mode

```
Virtual Joystick:
├─ Works with touch and pointer/mouse drag
├─ Thumb displacement normalized to velocity vector
└─ Provides classic arcade-style control
```

---

## 3. Player (Original Cockroach)

### Base Stats

| Stat | Value |
|------|-------|
| **Radius** | 20px |
| **Base Max Speed** | 5 units/frame |
| **Starting Lives** | 3 ❤️ |
| **Max Lives Cap** | 5 ❤️ |

### Movement & Rotation

- **Acceleration/Deceleration:** Smooth, not instant
- **Rotation:** Interpolates toward target heading

### Damage & Invulnerability

```
Damage Event:
├─ Player loses 1 heart instantly
├─ Invulnerability window: 1.0s
└─ During shield/i-frame: further hits ignored
```

### Score & Multiplier System

```
Base Scoring:
├─ +1 score per second (baseline)
├─ Gains multiplied by active multiplier
├─ Multiplier starts at: 1.0x
│
├─ Gain Multiplier:
│  └─ Every 15s without damage: +0.5x
│
└─ Reset Multiplier:
   └─ On taking damage: reset to 1.0x
```

---

## 4. HUD (Top Left Panel)

### Status Counters

| Counter | Meaning |
|---------|---------|
| **CJP LEATHER TOLERANCE** | Current hearts remaining |
| **MULTIPLIER** | Active score multiplier (1.0x - 5.0x+) |
| **TOTAL SCORE** | Current session score |
| **LEATHER IMPACTS** | Cumulative chappal contact count |
| **CABINET COCKROACHES** | Allied roaches currently following player |
| **BEST CORRUPTION SCORE** | High score (persisted in localStorage) |

### Power-Up Bars

```
┌─ Shield Active ─────────────┐
│  GREASE SHIELD: [████░░░░]  │
└─────────────────────────────┘

┌─ Speed Boost Active ────────┐
│  SPEED TANTRUM: [██░░░░░░░] │
└─────────────────────────────┘
```

### Pause Button
- Integrated inside same HUD block (below hearts)
- Freezes gameplay and shows pause menu

---

## 5. Hazard Systems

All hazards live in `hazards[]` and update every frame.

### 5.1 Bata Chappal

**Type:** `chappal`

#### Spawn Pattern

```
Spawn Cadence:
  interval = max(1.8, 3.5 - survivalTime×0.02)
  
Per Cycle: 2 chappals spawned (increased pressure)

Origin Distribution:
  ├─ 20%: from FRONT of cockroach heading
  └─ 80%: random 360° around player

Spawn Distance: ~750 world units from player
```

#### Trajectory & Speed

- **Aimed toward:** Player with ±0.15 rad inaccuracy
- **Speed Progression:** 7.5 + survivalTime×0.08
- **Speed Multiplier:** 0.7 (30% slower than baseline)

#### Collision & Damage

```
Detection: Circle vs Circle
  distance < (player.radius + chappal.radius)
  
Chappal Radius: 40 (large hit area)

On Impact:
  ├─ Call triggerDamage('chappal')
  └─ Chappal removed immediately
```

#### Cleanup
- Removed when >2,600 units from player

---

### 5.2 Baygon Cloud

**Type:** `baygon`

#### Spawn Pattern

```
Cadence: max(6.0, 10.0 - survivalTime×0.04)

Spawn Position:
  ├─ Around player
  ├─ Random angle
  └─ Distance: 100–400 units
```

#### Size & Duration

- **Radius:** 270 (3x larger)
- **Lifetime:** 6.0 seconds

#### Damage Mechanics

```
While Player Inside:
  ├─ Damage tick every 0.8s
  ├─ Call triggerDamage('baygon')
  └─ No ally protection (direct player damage)
```

---

### 5.3 Torch Sweep

**Type:** `torch`

#### Spawn Pattern

```
Cadence: Every 12.0 seconds

Spawn Position:
  ├─ Around player
  ├─ Distance: ~900 units
  └─ Random angle
```

#### Properties

| Property | Value |
|----------|-------|
| **Radius** | 120 |
| **Lifetime** | 8.0s |
| **Movement Speed** | 3.2 (chases player) |

#### Mechanic

```
┌─────────────────────────────────────┐
│  Torch Does NOT slow player         │
│                                     │
│  If player inside torch radius:     │
│  ├─ Triple chappal volley triggered │
│  ├─ Adds 3 chappals at once         │
│  └─ Cooldown: 1.2s (torchBurstCD)   │
└─────────────────────────────────────┘
```

---

## 6. Power-Ups & Collectibles

### Spawn Mechanics

```
Spawn Check Cycle: Every 4s (if active collectibles < 8)

General Spawn Geometry:
  ├─ Around player
  ├─ Random angle
  └─ Distance: 180–800 units
```

### Probability Distribution

```
crumb:  55% ██████████
speed:  20% ████
shield: 15% ███
ally:   10% ██
```

---

### 6.1 Crumb

**On Pickup:**

```
If lives < maxLives:
  └─ +1 heart ❤️
  
Else (maxed hearts):
  └─ +100 score
```

---

### 6.2 Shield (Grease Shield)

**On Pickup:**

```
Duration: 5.0 seconds
Effect: Full invincibility

Protection Scope:
  ├─ Original cockroach: ✓ protected
  └─ Allied roaches: ✓ protected
     (allies NOT consumed while shield active)
```

---

### 6.3 Speed (Speed Tantrum)

**On Pickup:**

```
Duration: 3.0 seconds
Effect: Max speed × 1.8

Visual Feedback:
  ├─ Dust particles emitted behind player
  └─ HUD speed timer visible
```

---

### 6.4 Ally Pickup

**On Pickup:**

```
Action: Add one ally roach to allies[]
Role: 1-hit bodyguard vs chappal ONLY
```

---

## 7. Ally Roach System

### Ally Availability Channels

```
┌─────────────────────────────────────────┐
│          Ally Availability               │
├─────────────────────────────────────────┤
│  1. Normal collectible spawn (rare)      │
│  2. Forced spawner (reliable)            │
│     └─ One ally every 10s                │
└─────────────────────────────────────────┘
```

### Forced Ally Spawning

```
Interval: Every 10s (spawnTimers.allyForced)

Spawn Location:
  ├─ Just beyond viewport edge
  ├─ Random side selection
  └─ Margin: ~140px off-screen
  
Result: Ally appears far & off-screen initially
```

### Guide Arrow System

```
On Ally Spawn:
  ├─ guideTime = 5s
  ├─ Yellow directional arrow drawn
  ├─ Points from player → nearest ally
  └─ Disappears after guideTime elapses
```

### Expiry & Collection

```
Uncollected Ally:
  ├─ expireTime: 12s
  ├─ If not collected: removed from world
  └─ Creates urgency to gather allies
```

### Follow Formation

```
Formation Style: Ring/group around player (not tail-chase)

Distribution:
  ├─ Allocated by slots/rings
  ├─ All face same direction as player
  └─ Rotation synchronized

Constraints:
  ├─ Minimum distance: player vs ally enforced
  ├─ Pairwise separation: ally vs ally enforced
  └─ Entities pushed apart if too close
```

### Hit Absorption

```
Ally Stats:
  └─ Exactly 1 heart (one use only)

Damage Source Protection:
  └─ Only chappal-triggered damage consumed

On Ally Sacrifice:
  ├─ Removed from followers[]
  ├─ Dead flip animation added to deadAllies[]
  └─ Original cockroach takes NO heart loss
```

---

## 8. Damage Resolution Priority

### Decision Tree

```
triggerDamage(source):
  │
  ├─ Step 1: If source == chappal
  │  └─ Increment leather impact counter
  │
  ├─ Step 2: Is shield active?
  │  ├─ YES → IGNORE (no damage)
  │  └─ NO → continue
  │
  ├─ Step 3: Is invulnerability active?
  │  ├─ YES → IGNORE (no damage)
  │  └─ NO → continue
  │
  ├─ Step 4: Is source == chappal AND allies exist?
  │  ├─ YES → Ally absorbs hit & dies
  │  └─ NO → Player loses 1 life (1s i-frame)
  │
  └─ Done
```

### Protection Hierarchy

1. **Shield** → supersedes all
2. **Invulnerability** → supersedes all
3. **Ally Protection** → chappal only
4. **Direct Damage** → Baygon damages player hearts (if no shield/i-frame)

---

## 9. Popup System (UI Hazard Layer)

### Behavior

Managed by `popups.js`:

```
Spawn Cadence:
  ├─ Randomized: 4–8 seconds after each spawn
  ├─ Periodic spawns throughout game
  └─ Prevents clustering

Positioning:
  ├─ Away from joystick zone constraints
  └─ Respects viewport boundaries

Decay:
  ├─ Auto-decay after: 5s (if untouched)
  ├─ Manual close available
  └─ User input prioritized
```

### Scoring Impact

| Action | Score Change |
|--------|--------------|
| **Click/Close Popup** | +25 |
| **Auto-Decay** | -10 |

---

## 10. Audio System

### Technology Stack

- **Web Audio API** (fully synthesized)
- **No external audio assets** required

### Control Interface

**Pause Menu includes:**
- Volume slider (0–100)
- Mute/Unmute button
- Master gain bus

### Sound Library

```
Core Sounds Synthesized:
  ├─ Click (UI interaction)
  ├─ Hum drone (ambient background)
  ├─ Skitter (player movement)
  ├─ Hit (damage taken)
  ├─ Chime (collectible grab)
  ├─ Game Over (end state)
  └─ Bulb interactions (grab/snapback/flicker)
```

---

## 11. Landing Page Mechanics

### Interactive Bulb

```
┌──────────────────────────┐
│   Interactive Bulb       │
├──────────────────────────┤
│  • Pointer drag support  │
│  • Swinging animation    │
│  • Stretchy physics      │
└──────────────────────────┘
```

### Hint Text Behavior

```
Hint appears:
  └─ Default state

Hint hides:
  └─ During bulb movement

Hint reappears:
  └─ After 5s stillness
```

### Game Start

- **Toggle switch** initiates gameplay transition
- **Control mode radio** selection (Follow vs Joystick)
- Selected mode applied at runtime

### Layout Design

```
Landing Page Layout:
  ├─ Compressed to fit viewport
  ├─ Minimal/no scroll required
  ├─ Control settings & toggle side-by-side
  └─ Optimized for mobile & desktop
```

---

## 12. Persistence

### Persistent Values

```
Saved to localStorage:
  └─ High score ('cjp_high_score')
```

### Run-Reset Values

On each new game start, these reset:

```
Game State:
  ├─ Score
  ├─ Multiplier
  ├─ Current lives
  └─ Temporary timers (shield/speed/invuln/torch etc.)

Entities:
  ├─ Allied roaches & dead ally animations
  ├─ Hazards (chappals/baygon/torch)
  └─ Collectibles
```

---

## 13. Notable Balance Summary (Current)

### Hazard Balance

```
Bata Chappals:
  ├─ Frequent spawning (increasing)
  ├─ Doubled per cycle (pressure increase)
  ├─ Each 30% slower than baseline speed
  └─ 20% front-origin, 80% random

Baygon Cloud:
  ├─ Very large radius (270)
  ├─ Medium duration (6s)
  └─ Tick damage while inside

Torch Sweep:
  ├─ Acts as chappal amplifier (×3 burst)
  ├─ Does NOT slow player
  └─ Adds strategic element
```

### Ally Balance

```
Ally Abundance:
  ├─ Forced spawn: every 10s off-screen
  ├─ Short collection window: 12s
  ├─ Creates risk/reward (chase vs dodge)
  └─ Ring formation around player
```

---

## 14. Quick Reference Constants

### Player Constants

```
Player Settings:
  ├─ Lives start: 3
  ├─ maxLives: 5
  └─ Invulnerability after hit: 1.0s
```

### Chappal Constants

```
Chappal Settings:
  ├─ Spawn: 2 per cycle
  ├─ Front-origin chance: 20%
  ├─ Speed factor: 0.7× baseline
  └─ Radius: 40
```

### Baygon Constants

```
Baygon Settings:
  ├─ Radius: 270
  ├─ Life: 6s
  └─ Damage tick: every 0.8s (while inside)
```

### Torch Constants

```
Torch Settings:
  ├─ Interval: 12s
  ├─ Radius: 120
  ├─ Life: 8s
  └─ Triple volley cooldown: 1.2s
```

### Power-Up Constants

```
Shield Duration: 5s
Speed Duration: 3s

Ally Special:
  ├─ Forced spawn interval: 10s
  ├─ Guide arrow duration: 5s
  └─ Auto-despawn if uncollected: 12s
```

---

**End of Reference Document** ✓
