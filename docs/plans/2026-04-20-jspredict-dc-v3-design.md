# jspredict-dc v3 Design

## Requirements

- Keep the 2.x public API available through compatibility aliases.
- Recenter the library around `satellite-js` as the propagation engine.
- Support TLE, OMM XML, and JSON GP orbit inputs.
- Keep the package small, testable, and easy to evolve.

## Architecture

### Layers

1. `src/utils.js`
   - Input normalization
   - Orbit-source parsing
   - Time conversion helpers
   - Low-level visibility and orbital math

2. `src/index.js`
   - Public API surface
   - Legacy aliases
   - Runtime configuration hooks

3. `jspredict-dc.js`
   - Thin compatibility wrapper for local `require('../jspredict-dc')`

### Data flow

1. Accept a TLE string, OMM XML string, JSON GP object, or normalized orbit source.
2. Normalize the source into a canonical orbit source.
3. Convert the normalized source into a `satellite.js` satrec.
4. Run propagation, observation, transit, and visibility calculations.
5. Return the existing 2.x result shapes.

## Key Decisions

### Use `satellite-js` as the engine

`jspredict-dc` no longer owns the propagation implementation. This keeps the code base aligned with the upstream orbital math and reduces maintenance risk.

### Normalize inputs at the boundary

OMM XML stays at the edge. Internal code works with a normalized orbit source and a satrec, which keeps the core logic stable.

### Preserve legacy names

The old API names remain as aliases so existing callers keep working while v3 introduces clearer names like `observeAt`, `ephemeris`, and `findTransits`.

### Remove `moment`

Native date handling is enough for the current API. Dropping `moment` trims a dependency without changing the observable API.

## Risks

- OMM/JSON field quality depends on callers providing a valid GP record.
- The compatibility layer keeps legacy behavior, but some edge-case differences may remain around date coercion and falsy defaults.
- `getOrbitalPeriodByCartesian3` is still an estimate based on radius, not a full orbital state recovery.

## Verification

- `npm test`
- `npm run build`

