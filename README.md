[中文](README.zh-CN.md) | English

# JSpredict-DC

A refactored and enhanced Javascript port of the popular `predict` satellite tracking library, originally based
on [nsat/jspredict](https://github.com/nsat/jspredict).

This fork aims to provide a more modern and maintainable codebase with better module compatibility and TypeScript
support.

### Key Improvements:

* **Code Refactoring:** Cleaned up and modernized the internal codebase.
* **Module Compatibility:** Built with Rollup to support various module formats including ESM, CJS, UMD, and AMD.
* **TypeScript Support:** Includes TypeScript declaration files (`.d.ts`) for better developer experience in TypeScript
  projects.
* **Unit Tests:** Added unit tests using Jest to ensure core functionality remains accurate and stable.
* **Function extension:**  Added more SDKs.

### Depends on:

* [Satellite.js](https://github.com/shashwatak/satellite-js)
* [Moment.js](https://github.com/moment/moment)

## Installation

Install the library via npm:

```bash
npm install jspredict-dc
```

## API

| Method                                                                                                                                                                       | Description                                                                                                                                                                                  |
|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `jspredict_dc.getPositionByTime(tle: string, observerLocation?: ObserverLocation, time?: number \| Date): ObserveResult \| null`                                             | Calculates the satellite's position and other observation data for a specific time and optional observer location.                                                                           |
| `jspredict_dc.getEphemeris(tle: string, observerLocation: ObserverLocation, start: number \| Date, end: number \| Date, interval?: any): ObserveResult[]`                    | Calculates a series of satellite observations over a time range with a specified interval.                                                                                                   |
| `jspredict_dc.transits(tle: string, observerLocation: ObserverLocation, start: number \| Date, end: number \| Date, minElevation?: number, maxTransits?: number): Transit[]` | Finds satellite passes (transits) over a given observer location within a time window, filtered by minimum elevation and maximum number of transits. [Not supporting geostationary orbit satellites] |
| `jspredict_dc.transitSegment(tle: string, observerLocation: ObserverLocation, start: number \| Date, end: number \| Date): Transit \| null`                                  | Calculates the transit information for a specific time segment.                                                                                                                              |
| `jspredict_dc.getVisibilityWindows(tle: string, observerLocation: ObserverLocation, start: number \| Date, end: number \| Date): number[][]`                                 | Returns an array of visible window time ranges (as [start, end] timestamp pairs) for the satellite over the observer location in the given time range.                                       |
| `getOrbitalPeriodByTle(tle: string):  number`                                                                                                                                | Get Orbital Period by TLE.    (second)                                                                                                                                                                |
| `getOrbitalPeriodByCartesian3(cartesian3: [number,number,number]=[0,0,0]):  number;`                                                                                         | Get Orbital Period by Cartesian3. (second)                                                                                                                                                       |

See the TypeScript declaration file (`dist/jspredict-dc.d.ts`) for detailed type definitions.

**Input Types:**

* `tle`: 3 line string with "\n" character line breaks.
* `observerLocation`: 3 element array `[latitude (degrees), longitude (degrees), altitude (km)]`.
* `time`, `start`, `end`: Unix timestamp (ms) or Date object (`new Date()`).
* `interval`: step interval in milliseconds.

## Data Structures

Here are the main data structures used and returned by the library methods:

### ObserverLocation

An array representing a ground station's location: `[latitude (degrees), longitude (degrees), altitude (km)]`.

### Transit

Represents information about a satellite's visible pass over a ground station.

* `start` (number): Transit start time in milliseconds Unix timestamp.
* `end` (number): Transit end time in milliseconds Unix timestamp.
* `maxElevation` (number): Maximum elevation during the transit in degrees.
* `apexAzimuth` (number): Azimuth at the time of maximum elevation in degrees.
* `maxAzimuth` (number): Maximum azimuth during the transit in degrees.
* `minAzimuth` (number): Minimum azimuth during the transit in degrees.
* `duration` (number): Transit duration in milliseconds.

### Eci

Represents Earth-Centered Inertial coordinates (position and velocity).

* `position` (object): Satellite's position in ECI coordinates (km).
    * `x` (number)
    * `y` (number)
    * `z` (number)
* `velocity` (object): Satellite's velocity in ECI coordinates (km/s).
    * `x` (number)
    * `y` (number)
    * `z` (number)

### ObserveResult

Represents the satellite observation data for a specific time. Includes basic orbital data and optionally ground
observer data if a observerLocation is provided.

* `eci` (Eci): Satellite's position and velocity in ECI coordinates.
* `gmst` (number): Greenwich Mean Sidereal Time in radians.
* `latitude` (number): Satellite's latitude in Geodetic coordinates (degrees).
* `longitude` (number): Satellite's longitude in Geodetic coordinates (degrees).
* `altitude` (number): Satellite's altitude in Geodetic coordinates (km).
* `footprint` (number): Diameter of the area on the ground visible from the satellite (km).
* `sunlit` (boolean): Whether the satellite is illuminated by the sun.
* `eclipseDepth` (number): Depth of the satellite within the Earth's shadow (radians).
* `azimuth` (number | undefined): Azimuth from the ground observer to the satellite (degrees). **Calculated only if
  observerLocation is provided.**
* `elevation` (number | undefined): Elevation from the ground observer to the satellite (degrees). **Calculated only if
  observerLocation is provided.**
* `rangeSat` (number | undefined): Slant range from the ground observer to the satellite (km). **Calculated only if
  observerLocation is provided.**
* `doppler` (number | undefined): Doppler factor of the satellite as observed from the ground observer. **Calculated
  only if observerLocation is provided.**

## Usage Examples

Using ESM (e.g., with modern build tools):

```javascript
import jspredict_dc, {ObserverLocation} from 'jspredict-dc'; // ObserverLocation type is also exported

const tle = `STARLINK-1008\n1 44714C 19074B   25148.13868056  .00017318  00000+0  11598-2 0  1489\n2 44714  53.0556  28.5051 0001501  80.1165 230.1605 15.06396864    11`;
const observerLocation: ObserverLocation = [39.9042, 116.4074, 0.05]; // Beijing, 50m altitude

// Get position at a specific time
const observationTime = new Date('2024-05-28T12:00:00Z');
const position = jspredict_dc.getPositionByTime(tle, observerLocation, observationTime);
console.log('Position:', position);

// Get ephemeris over a time range
const startTime = new Date('2024-05-28T12:00:00Z');
const endTime = new Date('2024-05-28T12:10:00Z');
const interval = {minutes: 2};
const ephemeris = jspredict_dc.getEphemeris(tle, observerLocation, startTime, endTime, interval);
console.log('Ephemeris:', ephemeris);

// Find visible transits
const transitStartTime = new Date('2024-05-28T00:00:00Z');
const transitEndTime = new Date('2024-05-29T00:00:00Z');
const minElevation = 5; // degrees
const maxTransits = 2;
const transits = jspredict_dc.transits(tle, observerLocation, transitStartTime, transitEndTime, minElevation, maxTransits);
console.log('Transits:', transits);
```

Using CommonJS (e.g., in Node.js):

```javascript
const jspredict_dc = require('jspredict-dc');

const tle = `STARLINK-1008\n1 44714C 19074B   25148.13868056  .00017318  00000+0  11598-2 0  1489\n2 44714  53.0556  28.5051 0001501  80.1165 230.1605 15.06396864    11`;
const observerLocation = [39.9042, 116.4074, 0.05]; // Beijing, 50m altitude

// Get position at a specific time
const observationTime = new Date('2024-05-28T12:00:00Z');
const position = jspredict_dc.getPositionByTime(tle, observerLocation, observationTime);
console.log('Position:', position);

// Get ephemeris over a time range
const startTime = new Date('2024-05-28T12:00:00Z');
const endTime = new Date('2024-05-28T12:10:00Z');
const interval = {minutes: 2};
const ephemeris = jspredict_dc.getEphemeris(tle, observerLocation, startTime, endTime, interval);
console.log('Ephemeris:', ephemeris);

// Find visible transits
const transitStartTime = new Date('2024-05-28T00:00:00Z');
const transitEndTime = new Date('2024-05-29T00:00:00Z');
const minElevation = 5; // degrees
const maxTransits = 2;
const transits = jspredict_dc.transits(tle, observerLocation, transitStartTime, transitEndTime, minElevation, maxTransits);
console.log('Transits:', transits);

// getOrbitalPeriod
const res = jspredict.getOrbitalPeriodByTle(tle);
const pos =jspredict.getPositionByTime(tle, observerLocation, new Date())
const res2=jspredict.getOrbitalPeriodByCartesian3([pos.eci.position.x,  pos.eci.position.y, pos.eci.position.z])
console.log(res,res2)
```

Using a script tag (UMD format):

```html

<script src="path/to/your/dist/jspredict-dc.umd.js"></script>
<script>
    const tle = `STARLINK-1008\n1 44714C 19074B   25148.13868056  .00017318  00000+0  11598-2 0  1489\n2 44714  53.0556  28.5051 0001501  80.1165 230.1605 15.06396864    11`;
    const observerLocation = [39.9042, 116.4074, 0.05]; // Beijing, 50m altitude
    const observationTime = new Date('2024-05-28T12:00:00Z');

    // The library is available globally as jspredict_dc
    const position = jspredict_dc.getPositionByTime(tle, observerLocation, observationTime);
    console.log('Position:', position);
</script>
```

## Building

To build the library and generate the `dist` files:

```bash
npm run build
```

## Testing

To run the unit tests:

```bash
npm test
```
