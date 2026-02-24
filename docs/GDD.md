# Web 3-Cushion Billiards GDD (MVP)

## 1. Document Info
- Title: Web 3-Cushion Billiards Game Design Document
- Version: v1.0
- Date: 2026-02-20
- Scope: MVP

## 2. Game Overview
- Genre: Real-time multiplayer web billiards
- Mode: 3-Cushion only
- Core loop: Join room -> Take turns shooting -> Reach 10 points first

## 3. Core Policies
- No one can enter a room while a game is in progress.
- Up to 6 players per room, no spectators.
- The match ends immediately when one player reaches 10 points.

## 4. Information Architecture
1. Depth 1: Login
2. Depth 2: Lobby
3. Depth 3: Room (Game Screen)

## 5. Depth 1 - Login
### 5.1 Guest Login
- Nickname required
- Duplicate nickname allowed

### 5.2 Member Login/Signup
- ID/PW signup and login
- No email verification, no SMTP dependency

## 6. Depth 2 - Lobby
### 6.1 Room List
- Show 9 rooms first (3x3)
- Infinite scroll
- Pagination size fixed at 9 rooms per load

### 6.2 Sorting Priority
1. Waiting rooms first (not started)
2. Fewer waiting players
3. Most recently created

### 6.3 Entry Rules
- In-progress room: cannot enter
- Waiting/finished room: anyone can enter (including previously kicked users)

## 7. Room Creation Policy
- Input: room title only
- Title max length: 15 chars
- No forbidden characters
- Duplicate titles allowed
- No password
- Max players fixed at 6

## 8. Depth 3 - Room / Game Screen
### 8.1 Layout
- Top-view billiard table centered
- Player list, current turn, score board
- In-room chat panel

### 8.2 Player Count
- Max: 6
- Minimum to start: 2

### 8.3 Control Scheme
#### Cue Control (Mouse)
- Mouse horizontal movement:
  - Cue rotates 360 degrees around the cue ball on the horizontal plane.
  - Move mouse left -> cue rotates clockwise.
  - Move mouse right -> cue rotates counterclockwise.
- Mouse vertical movement:
  - Cue rotates vertically around the cue ball.
  - Move mouse up -> cue butt rises, tip aims upper part of the cue ball.
  - Move mouse down -> cue butt lowers, tip aims lower part of the cue ball.
  - Elevation angle range: min `0 deg` (horizontal), max `89 deg`.
- Mouse drag stroke:
  - Hold left-click to prepare stroke.
  - Drag downward.
  - Release left-click to execute stroke.
  - Drag range: `10 px` to `400 px`.
  - `10 px` maps to minimum shot speed `1 m/s`.
  - `400 px` maps to maximum shot speed `50 km/h` (`13.89 m/s`).
  - Values outside range are clamped to `[10, 400]`.
  - Recommended mapping: linear interpolation from drag distance to initial shot speed.

#### Spin Control (Keyboard)
- `W`: move impact point toward 12 o'clock.
- `S`: move impact point toward 6 o'clock.
- `A`: move impact point toward 9 o'clock.
- `D`: move impact point toward 3 o'clock.

## 9. Host System
### 9.1 Host Permissions
- Start game
- Kick player
- Start rematch

### 9.2 Host Transfer
- If host leaves, host is automatically transferred to the next player by join order
- Room is not destroyed by host leaving

### 9.3 Kick Policy
- Immediate kick (no voting)
- Kicked player can re-enter only when room is not in progress

## 10. Match Rules
### 10.1 Start
- Match starts only with host start button
- No ready-check required

### 10.2 Turn Rules
- Fixed turn order by join order
- Turn timer: 10 seconds
- Timeout behavior: automatic turn skip only (no extra penalty)
- After shot end, keep turn when 3-cushion score is valid.
- After shot end, switch turn to next player when 3-cushion score is invalid.

### 10.3 Win/Lose Conditions
- +1 scoring condition (valid 3-cushion):
  - Cue ball must contact both object balls.
  - Cue ball must contact cushions at least 3 times before second object-ball contact.
- First player to 10 points wins
- Match ends immediately at 10 points
- No tie-break rule needed due to immediate end

### 10.4 Leave/Disconnect
- Mid-game leave is immediate loss
- If only one player remains, match ends immediately and remaining player wins

### 10.5 Rematch
- Started by host button
- Score resets to 0 for all players
- Turn order remains fixed by join order

## 11. Chat
- Scope: room-only chat
- Rate limit: 1 message per 3 seconds per player
- Storage: memory only (ephemeral, not persisted)
- Profanity filter: none (MVP)

## 12. State Model (MVP)
### 12.1 Room States
- `WAITING`: before game start
- `IN_GAME`: game in progress (room locked)
- `FINISHED`: game ended, rematch possible

### 12.2 Room State Transitions
1. `WAITING` -> `IN_GAME` (host clicks start, player count >= 2)
2. `IN_GAME` -> `FINISHED` (player reaches 10 points OR only one player remains)
3. `FINISHED` -> `IN_GAME` (host starts rematch)

### 12.3 Player States
- `IN_ROOM`
- `PLAYING`
- `WIN`
- `LOSE`
- `KICKED` (outside room until rejoin allowed by room state)

## 13. Physics Input Parameters (to be formalized in Physics Spec)
### 13.1 Balls
- Diameter: 61.5 mm
- Mass: 210 g
- Ball-ball restitution: e ~= 0.92 to 0.98
- Material: Phenolic resin

### 13.2 Table
- Inner size: 2.844 m x 1.422 m
- Outer size: 3,100 mm x 1,700 mm
- Cushion height: 0.037 m
- Ball-cushion restitution: e ~= 0.70 to 0.75
- Cloth friction:
  - Sliding friction coefficient ~= 0.2
  - Rolling friction coefficient ~= 0.01 to 0.015

### 13.3 Cue
- Length: 1.41 m
- Mass: 500 g
- Tip diameter: 12 mm
- Tip-ball friction coefficient: 0.7
- Tip restitution: 0.7

## 14. Out of Scope for MVP
- Spectator mode
- Password/private rooms
- Persistent chat history
- Profanity filtering/moderation tooling
- Additional billiards modes beyond 3-cushion
