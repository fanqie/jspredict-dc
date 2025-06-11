[English](README.md) | 中文

# JSpredict-DC

一个流行的 `predict` 卫星跟踪库的 JavaScript
重构和增强版本，最初基于 [nsat/jspredict](https://github.com/nsat/jspredict)。

本分支旨在提供一个更现代化、更易于维护的代码库，具有更好的模块兼容性和 TypeScript 支持。

### 主要改进：

* **代码重构：** 清理并现代化了内部代码库。
* **模块兼容性：** 使用 Rollup 构建，支持包括 ESM、CJS、UMD 和 AMD 在内的多种模块格式。
* **TypeScript 支持：** 包含 TypeScript 声明文件（`.d.ts`），为 TypeScript 项目提供更好的开发体验。
* **单元测试：** 添加了使用 Jest 的单元测试，确保核心功能准确稳定。
* **功能扩展：** 增加了更多的SDK。

### 依赖：

* [Satellite.js](https://github.com/shashwatak/satellite-js)
* [Moment.js](https://github.com/moment/moment)

## 安装

通过 npm 安装库：

```bash
npm install jspredict-dc
```

## API

| 方法                                                                                                                                                                           | 说明                                                              |
|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------|
| `jspredict_dc.getPositionByTime(tle: string, observerLocation?: ObserverLocation, time?: number \| Date): ObserveResult \| null`                                             | 计算卫星在特定时间的位置和其他观测数据，可选择观测者位置。                                   |
| `jspredict_dc.getEphemeris(tle: string, observerLocation: ObserverLocation, start: number \| Date, end: number \| Date, interval?: any): ObserveResult[]`                    | 在指定的时间范围内，以指定的时间间隔计算一系列卫星观测数据。                                  |
| `jspredict_dc.transits(tle: string, observerLocation: ObserverLocation, start: number \| Date, end: number \| Date, minElevation?: number, maxTransits?: number): Transit[]` | 在给定的观测者位置和时间窗口内，查找卫星可见过境（transits），可按最小仰角和最大过境数过滤。[不支持地球同步轨道卫星] |
| `jspredict_dc.transitSegment(tle: string, observerLocation: ObserverLocation, start: number \| Date, end: number \| Date): Transit \| null`                                  | 计算特定时间段的过境信息。                                                   |
| `jspredict_dc.getVisibilityWindows(tle: string, observerLocation: ObserverLocation, start: number \| Date, end: number \| Date): number[][]`                                 | 返回卫星在给定观测者位置和时间范围内的可见窗口时间戳数组（每个元素为[start, end]对）。               |
| `getOrbitalPeriodByTle(tle: string):  number`                                                                                                                                | 根据tle  获取轨道周期(秒)。                                               |
| `getOrbitalPeriodByCartesian3(cartesian3: [number,number,number]=[0,0,0]):  number;`                                                                                         | 根据笛卡尔坐标获取轨道周期(秒)。                                               |

详细类型定义请参考 TypeScript 声明文件（`dist/jspredict-dc.d.ts`）。

**输入类型：**

*   `tle`: 3 行字符串，使用 "\\n" 作为换行符。
*   `observerLocation`: 3 元素数组 `[纬度 (度), 经度 (度), 海拔 (千米)]`。
*   `time`, `start`, `end`: Unix 时间戳 (毫秒) 或 Date 对象 (`new Date()`)。
*   `interval`:步长间隔（毫秒）。

## 数据结构

以下是库方法使用和返回的主要数据结构：

### ObserverLocation

表示地面观测站位置的数组：`[纬度 (度), 经度 (度), 海拔 (千米)]`。

### Transit

表示卫星从地面观测站可见过境的信息。

* `start` (number): 过境开始时间 (毫秒 Unix 时间戳)。
* `end` (number): 过境结束时间 (毫秒 Unix 时间戳)。
* `maxElevation` (number): 过境期间的最大仰角 (度)。
* `apexAzimuth` (number): 达到最大仰角时的方位角 (度)。
* `maxAzimuth` (number): 过境期间的最大方位角 (度)。
* `minAzimuth` (number): 过境期间的最小方位角 (度)。
* `duration` (number): 过境持续时间 (毫秒)。

### Eci

表示地心惯性坐标系（位置和速度）。

* `position` (object): 卫星在 ECI 坐标系中的位置 (千米)。
    * `x` (number)
    * `y` (number)
    * `z` (number)
* `velocity` (object): 卫星在 ECI 坐标系中的速度 (千米/秒)。
    * `x` (number)
    * `y` (number)
    * `z` (number)

### ObserveResult

表示特定时间的卫星观测数据。包含基本的轨道数据，如果提供了 observerLocation，则可选地包含地面观测者数据。

* `eci` (Eci): 卫星在 ECI 坐标系中的位置和速度。
* `gmst` (number): 格林威治平均恒星时 (弧度)。
* `latitude` (number): 卫星在地心大地坐标系中的纬度 (度)。
* `longitude` (number): 卫星在地心大地坐标系中的经度 (度)。
* `altitude` (number): 卫星在地心大地坐标系中的海拔高度 (千米)。
* `footprint` (number): 卫星对地面可见的区域直径 (千米)。
* `sunlit` (boolean): 卫星是否被太阳照亮（是否处于日照区）。
* `eclipseDepth` (number): 卫星处于地球阴影中的深度 (弧度)。
* `azimuth` (number | undefined): 从地面观测点到卫星的方位角 (度)。**仅在提供 observerLocation 时计算。**
* `elevation` (number | undefined): 从地面观测点到卫星的仰角 (度)。**仅在提供 observerLocation 时计算。**
* `rangeSat` (number | undefined): 从地面观测点到卫星的直线距离 (千米)。**仅在提供 observerLocation 时计算。**
* `doppler` (number | undefined): 从地面观测点观察到的卫星的多普勒因子。**仅在提供 observerLocation 时计算。**

## 使用示例

使用 ESM (例如，现代构建工具)：

```javascript
import jspredict_dc, {ObserverLocation} from 'jspredict-dc'; // ObserverLocation 类型也已导出

const tle = `STARLINK-1008\n1 44714C 19074B   25148.13868056  .00017318  00000+0  11598-2 0  1489\n2 44714  53.0556  28.5051 0001501  80.1165 230.1605 15.06396864    11`;
const observerLocation: ObserverLocation = [39.9042, 116.4074, 0.05]; // 北京，海拔50米

// 获取特定时间的位置
const observationTime = new Date('2024-05-28T12:00:00Z');
const position = jspredict_dc.getPositionByTime(tle, observerLocation, observationTime);
console.log('位置:', position);

// 获取时间范围内的星历
const startTime = new Date('2024-05-28T12:00:00Z');
const endTime = new Date('2024-05-28T12:10:00Z');
const interval = {minutes: 2};
const ephemeris = jspredict_dc.getEphemeris(tle, observerLocation, startTime, endTime, interval);
console.log('星历:', ephemeris);

// 查找可见过境
const transitStartTime = new Date('2024-05-28T00:00:00Z');
const transitEndTime = new Date('2024-05-29T00:00:00Z');
const minElevation = 5; // 度
const maxTransits = 2;
const transits = jspredict_dc.transits(tle, observerLocation, transitStartTime, transitEndTime, minElevation, maxTransits);
console.log('过境:', transits);

// 获取轨道周期 提供了两种方法
const res = jspredict.getOrbitalPeriodByTle(tle);
const pos = jspredict.getPositionByTime(tle, observerLocation, new Date())
const res2 = jspredict.getOrbitalPeriodByCartesian3([pos.eci.position.x, pos.eci.position.y, pos.eci.position.z])
console.log(res, res2)
```

使用 CommonJS (例如，在 Node.js 中)：

```javascript
const jspredict_dc = require('jspredict-dc');

const tle = `STARLINK-1008\n1 44714C 19074B   25148.13868056  .00017318  00000+0  11598-2 0  1489\n2 44714  53.0556  28.5051 0001501  80.1165 230.1605 15.06396864    11`;
const observerLocation = [39.9042, 116.4074, 0.05]; // 北京，海拔50米

// 获取特定时间的位置
const observationTime = new Date('2024-05-28T12:00:00Z');
const position = jspredict_dc.getPositionByTime(tle, observerLocation, observationTime);
console.log('位置:', position);

// 获取时间范围内的星历
const startTime = new Date('2024-05-28T12:00:00Z');
const endTime = new Date('2024-05-28T12:10:00Z');
const interval = {minutes: 2};
const ephemeris = jspredict_dc.getEphemeris(tle, observerLocation, startTime, endTime, interval);
console.log('星历:', ephemeris);

// 查找可见过境
const transitStartTime = new Date('2024-05-28T00:00:00Z');
const transitEndTime = new Date('2024-05-29T00:00:00Z');
const minElevation = 5; // 度
const maxTransits = 2;
const transits = jspredict_dc.transits(tle, observerLocation, transitStartTime, transitEndTime, minElevation, maxTransits);
console.log('过境:', transits);
```

使用 script 标签 (UMD 格式)：

```html

<script src="path/to/your/dist/jspredict-dc.umd.js"></script>
<script>
    const tle = `STARLINK-1008\n1 44714C 19074B   25148.13868056  .00017318  00000+0  11598-2 0  1489\n2 44714  53.0556  28.5051 0001501  80.1165 230.1605 15.06396864    11`;
    const observerLocation = [39.9042, 116.4074, 0.05]; // 北京，海拔50米
    const observationTime = new Date('2024-05-28T12:00:00Z');

    // 库通过全局变量 jspredict_dc 可用
    const position = jspredict_dc.getPositionByTime(tle, observerLocation, observationTime);
    console.log('位置:', position);
</script>
```

## 构建

构建库并生成 `dist` 文件：

```bash
npm run build
```

## 测试

运行单元测试：

```bash
npm test
``` 
