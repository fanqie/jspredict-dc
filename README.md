[中文](README.zh-CN.md) | English

# jspredict-dc v3

`jspredict-dc` is a satellite propagation and visibility utility library rebuilt on top of [`satellite.js`](https://github.com/shashwatak/satellite-js).

The v3 redesign focuses on three things:

- keep the 2.0 public API available through compatibility aliases
- normalize orbit inputs so TLE, OMM XML, and JSON GP all share one entry path
- lean on `satellite.js` for the core orbital math instead of maintaining a separate propagation engine

## What this package does

- propagate a satellite to any UTC time
- sample ephemeris over a time window
- predict transits and visibility windows for a ground observer
- estimate orbital period from an orbit source or a Cartesian radius
- accept TLE, OMM XML, JSON GP, or already-parsed `satrec`-like input
- preserve 2.0 names while offering clearer v3 method names

## Quick Start

```bash
npm install jspredict-dc
```

```js
const jspredict = require('jspredict-dc');

const tle = `STARLINK-1008
1 44714U 19074B   26109.91670139  .01912102  00000+0  47462-1 0  9994
2 44714  53.1550 346.4090 0001914  94.7468 310.9927 15.36899644  5865`;

const observer = [39.9042, 116.4074, 0.05];
const time = new Date('2026-04-20T08:27:14Z');

const observation = jspredict.observeAt(tle, observer, time);
const ephemeris = jspredict.ephemeris(tle, observer, time, new Date('2026-04-20T09:27:14Z'), { minutes: 5 });
const transits = jspredict.findTransits(tle, observer, time, new Date('2026-04-21T08:27:14Z'));
```

## Demo and homepage

- GitHub Pages demo: `https://fanqie.github.io/jspredict-dc/`
- Repository demo file: [`index.html`](./index.html)

The demo is a Cesium-based verification page. It includes:

- live orbit rendering
- 2D ground-track inspection
- UTC time axis scrubber
- sample preview panel
- plain-text data view for raw output inspection

## v3 vs 2.0

### What changed

- v3 is centered on `satellite.js` 6.x
- v3 removes the separate propagation engine from the public design
- v3 accepts normalized orbit sources instead of requiring one rigid input shape
- v3 uses native `Date` handling instead of a moment-based time layer
- v3 keeps 2.0 names as compatibility aliases so older code can keep working

### API migration map

| 2.0 name | v3 name | Status |
| --- | --- | --- |
| `getPositionByTime` | `observeAt` | kept as alias |
| `getEphemeris` | `ephemeris` | kept as alias |
| `transits` | `findTransits` | kept as alias |
| `getTransitSegment` | `transitSegment` | kept as alias |
| `getVisibilityWindows` | `visibilityWindows` | kept as alias |
| `getSatelliteVisibilityWindows` | `satelliteVisibilityWindows` | kept as alias |
| `getOrbitalPeriodByTle` | `orbitalPeriodFromOrbitSource` | kept as alias |
| `getOrbitalPeriodByCartesian3` | `orbitalPeriodFromCartesian3` | kept as alias |
| `setDebugIntervalLogging` | `printIntervalInfo` | kept as alias |
| `setIterationLimit` | `setMax` | kept as alias |

## Supported orbit inputs

`jspredict-dc` accepts:

- TLE strings
- OMM XML strings
- JSON GP objects or JSON strings
- prebuilt `satrec` objects

Recommended v3 helpers:

- `normalizeOrbitSource(source)`
- `fromTle(line1, line2)`
- `fromJsonGp(record)`
- `fromOmmXml(xml)`

## Main API

### Observation

- `observeAt(source, observerLocation?, time?)`
- `getPositionByTime(...)` legacy alias

Returns a single observation result at one UTC instant. When an observer location is provided, the result also includes azimuth, elevation, range, and doppler.

### Ephemeris

- `ephemeris(source, observerLocation, start, end, interval?)`
- `getEphemeris(...)` legacy alias

Generates repeated observations across a time window.

### Transit prediction

- `findTransits(source, observerLocation, start, end, minElevation?, maxTransits?)`
- `transits(...)` legacy alias
- `transitSegment(source, observerLocation, start, end)`
- `getTransitSegment(...)` legacy alias

Finds visible passes for a ground observer.

### Visibility windows

- `visibilityWindows(source, observerLocation, start, end)`
- `getVisibilityWindows(...)` legacy alias
- `satelliteVisibilityWindows(source1, source2, start, end, stepSeconds?)`
- `getSatelliteVisibilityWindows(...)` legacy alias

Computes when a satellite is visible to an observer, or when two satellites can see each other.

### Orbital period

- `orbitalPeriodFromOrbitSource(source)`
- `orbitalPeriodFromTle(...)` legacy alias
- `orbitalPeriodFromCartesian3([x, y, z])`
- `getOrbitalPeriodByTle(...)` legacy alias
- `getOrbitalPeriodByCartesian3(...)` legacy alias

Estimates orbital period from the input orbit or from a Cartesian radius.

### Runtime config

- `setIterationLimit(max)`
- `setMax(max)` legacy alias
- `printIntervalInfo(open)`
- `setDebugIntervalLogging(open)` legacy alias

These functions control the iterative search behavior and the optional debug logging.

## All exported APIs

| API | Description |
| --- | --- |
| `normalizeOrbitSource(source)` | Normalize any supported orbit input into a standard internal source. |
| `fromTle(line1, line2)` | Build a normalized source from a TLE pair. |
| `fromJsonGp(record)` | Build a normalized source from a JSON GP object. |
| `fromOmmXml(xml)` | Build a normalized source from OMM XML. |
| `observeAt(source, observerLocation?, time?)` | Propagate once and return a single observation. |
| `getPositionByTime(...)` | 2.0 compatibility alias of `observeAt`. |
| `ephemeris(source, observerLocation, start, end, interval?)` | Sample observations across a time span. |
| `getEphemeris(...)` | 2.0 compatibility alias of `ephemeris`. |
| `findTransits(...)` | Search visible passes over a time span. |
| `transits(...)` | 2.0 compatibility alias of `findTransits`. |
| `transitSegment(...)` | Find a single pass segment within a window. |
| `getTransitSegment(...)` | 2.0 compatibility alias of `transitSegment`. |
| `visibilityWindows(...)` | Return observer visibility windows as `[startMs, endMs]` pairs. |
| `getVisibilityWindows(...)` | 2.0 compatibility alias of `visibilityWindows`. |
| `satelliteVisibilityWindows(...)` | Return mutual visibility windows between two satellites. |
| `getSatelliteVisibilityWindows(...)` | 2.0 compatibility alias of `satelliteVisibilityWindows`. |
| `orbitalPeriodFromOrbitSource(source)` | Estimate orbital period from any supported orbit source. |
| `orbitalPeriodFromTle(...)` | 2.0 compatibility alias of `orbitalPeriodFromOrbitSource`. |
| `orbitalPeriodFromCartesian3([x, y, z])` | Estimate orbital period from a radius vector. |
| `getOrbitalPeriodByTle(...)` | 2.0 compatibility alias of `orbitalPeriodFromOrbitSource`. |
| `getOrbitalPeriodByCartesian3(...)` | 2.0 compatibility alias of `orbitalPeriodFromCartesian3`. |
| `setIterationLimit(max)` | Set the maximum number of iterations used by search routines. |
| `setMax(max)` | 2.0 compatibility alias of `setIterationLimit`. |
| `printIntervalInfo(open)` | Enable or disable interval logging. |
| `setDebugIntervalLogging(open)` | 2.0 compatibility alias of `printIntervalInfo`. |

## Example

```js
const jspredict = require('jspredict-dc');

const tle = `STARLINK-1008
1 44714U 19074B   26109.91670139  .01912102  00000+0  47462-1 0  9994
2 44714  53.1550 346.4090 0001914  94.7468 310.9927 15.36899644  5865`;

const observer = [39.9042, 116.4074, 0.05];
const start = new Date('2026-04-20T08:00:00Z');
const end = new Date('2026-04-20T09:00:00Z');

const current = jspredict.observeAt(tle, observer, new Date('2026-04-20T08:27:14Z'));
const samples = jspredict.ephemeris(tle, observer, start, end, { minutes: 5 });
const passes = jspredict.findTransits(tle, observer, start, end, 0, 5);
const windows = jspredict.visibilityWindows(tle, observer, start, end);
```

## Dependencies

### Runtime

- [`satellite.js`](https://github.com/shashwatak/satellite-js) `^6.0.1`

### Development

- Rollup
- Jest
- Rollup plugins for CommonJS, JSON, node resolution, and minification

### Demo-only

The repository root demo page uses Cesium in the browser, but Cesium is not a package runtime dependency.

## License

MIT
