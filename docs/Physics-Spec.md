# Web 3-Cushion Billiards Physics Specification (MVP)

## 1. Document Info
- Title: Web 3-Cushion Billiards Physics Specification
- Version: v1.0
- Date: 2026-02-20
- Scope: Shot initialization, spin initialization, miscue limit, and core table/ball constants

## 2. Purpose
This document defines the minimum physics rules needed to produce realistic 3-cushion behavior for MVP.

## 3. Constants
### 3.1 Ball
- Diameter: `d = 0.0615 m`
- Radius: `R = 0.03075 m`
- Mass: `m_b = 0.21 kg`
- Material: Phenolic resin
- Ball-ball restitution: `e_bb = 0.92 ~ 0.98`

### 3.2 Table
- Inner playfield: `2.844 m x 1.422 m`
- Outer size: `3.100 m x 1.700 m`
- Cushion height: `0.037 m`
- Ball-cushion restitution: `e_bc = 0.70 ~ 0.75`
- Sliding friction coefficient: `mu_s ~= 0.20`
- Rolling friction coefficient: `mu_r ~= 0.01 ~ 0.015`

### 3.3 Cue
- Cue mass: `m_c = 0.50 kg`
- Cue length: `1.41 m` (non-critical to impulse math)
- Tip diameter: `12 mm`
- Tip-ball friction coefficient: `mu_tip = 0.70`
- Tip restitution: `e_tip = 0.70` (default, tunable)

## 4. Coordinate and Input Conventions
- Cue-ball center impact point is `(0, 0)`.
- Horizontal offset from center is `x` (left/right english).
- Vertical offset from center is `y` (top/bottom spin).
- Shot direction unit vector is `n_hat` on the table plane.
- Cue yaw control:
  - Mouse left movement rotates cue clockwise around cue ball.
  - Mouse right movement rotates cue counterclockwise around cue ball.
  - Horizontal rotation range: `0 ~ 360 deg` (wrapped).
- Cue elevation control:
  - Mouse up increases cue elevation and targets upper cue-ball area.
  - Mouse down decreases cue elevation and targets lower cue-ball area.
  - Elevation range: `0 ~ 89 deg` (clamped).
- Stroke input:
  - Hold left-click, drag downward, release to strike.
  - Valid drag distance range: `10 px ~ 1000 px` (clamped).
- Spin input:
  - `W` -> move impact point toward 12 o'clock.
  - `S` -> move impact point toward 6 o'clock.
  - `A` -> move impact point toward 9 o'clock.
  - `D` -> move impact point toward 3 o'clock.

## 5. Drag-to-Speed Mapping (GDD-Aligned)
Define drag distance as `d_px`.

- `d_px_clamped = clamp(d_px, 10, 1000)`
- Minimum cue-ball initial speed: `V0_min = 1.0 m/s`
- Maximum cue-ball initial speed: `V0_max = 50 km/h = 13.89 m/s`
- Linear map:
`V0_target = V0_min + (d_px_clamped - 10) / (1000 - 10) * (V0_max - V0_min)`

`V0_target` is the desired post-impact cue-ball speed from the UI contract.

## 6. Initial Linear Velocity at Impact
Physical impact equation between cue and cue ball:

`V0 = (m_c * (1 + e_tip) / (m_c + m_b)) * v_c`

- `V0` is the cue-ball speed immediately after impact from physics terms.
- Initial linear velocity vector:
`v0_vec = V0 * n_hat`

Implementation note:
- Solve for `v_c` from `V0_target` so runtime matches control design:
`v_c = V0_target * (m_c + m_b) / (m_c * (1 + e_tip))`
- Then compute `V0` using the physical formula and apply final safety clamp:
`V0 = clamp(V0, V0_min, V0_max)`

## 7. Initial Angular Velocity (Spin)
Using impulse + rigid body moment relations from the reference:

- Sphere inertia: `I = (2/5) * m_b * R^2`
- Top/back spin component:
`omega_x = (5 * V0 * y) / (2 * R^2)`
- Side spin component:
`omega_z = (5 * V0 * x) / (2 * R^2)`

Notes:
- Axis naming depends on engine coordinates. In some engines, side spin may be `omega_y` instead of `omega_z`.
- Sign (`+/-`) should follow your right-hand rule and camera/table axis definitions.

## 8. Miscue Rule (Essential Constraint)
Miscue occurs when the impact offset is too close to the ball edge.

- Offset distance:
`r_off = sqrt(x^2 + y^2)`
- Miscue threshold:
`r_off > 0.9 * R`

When miscue is triggered:
1. Mark shot as failure.
2. Apply no valid cue impulse to the cue ball (or apply severe power loss, if desired).
3. End turn according to game rule handling.

## 9. Runtime Integration Order (Per Shot)
1. Validate room/game/turn state.
2. Read shot input: direction, drag distance `d_px`, offsets `(x, y)`.
3. Run miscue check (`r_off > 0.9R`).
4. If valid, compute `d_px_clamped` and `V0_target`.
5. Convert `V0_target` to `v_c`, then compute final `V0` and clamp.
6. Set `Rigidbody.velocity = v0_vec` once at impact frame.
7. Compute `omega_x`, `omega_z` and set `Rigidbody.angularVelocity` once.
8. Let engine resolve ball-ball, ball-cushion, and friction over time.

## 10. Calibration Guidelines
- Start with:
  - `e_tip = 0.70`
  - `e_bb = 0.95`
  - `e_bc = 0.72`
  - `mu_s = 0.20`
  - `mu_r = 0.012`
- Tune in this order:
1. Shot travel length (power map and `e_tip`)
2. Ball-to-ball rebound feel (`e_bb`)
3. Cushion rebound angle/energy (`e_bc`)
4. Slide-to-roll transition and long-tail decay (`mu_s`, `mu_r`)

## 11. Validation Checklist
- Center hit (`x=0, y=0`) produces near-zero spin.
- Larger `|y|` increases top/back spin while reducing practical forward roll stability.
- Larger `|x|` increases side spin and visible post-cushion throw.
- `r_off > 0.9R` consistently triggers miscue.
- Simulated cue-ball behavior remains deterministic under same input and tick rate.
- `10 px` drag produces `1.0 m/s` and `1000 px` drag produces `13.89 m/s`.

## 12. Out of Scope (v1.0)
- Cloth anisotropy by direction
- Humidity/temperature dependent coefficients
- Detailed cue deflection/squirt and swerve model
- Tip compression time-domain model
