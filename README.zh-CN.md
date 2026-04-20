[English](README.md) | 中文

# jspredict-dc v3

`jspredict-dc` 是一个基于 [`satellite.js`](https://github.com/shashwatak/satellite-js) 重构的卫星轨道传播与可见性工具库。

v3 版本的核心目标有三个：

- 保留 2.0 版本的公开 API，并通过兼容别名继续可用
- 统一轨道输入层，让 TLE、OMM XML、JSON GP 使用同一套入口
- 直接依赖 `satellite.js` 作为核心轨道数学基础，不再维护独立传播内核

## 这个包能做什么

- 按 UTC 时刻传播卫星位置
- 按时间窗采样星历
- 预测地面观测者的过境和可见窗口
- 根据轨道源或笛卡尔半径估算轨道周期
- 接受 TLE、OMM XML、JSON GP 或已构建好的 `satrec` 输入
- 保留 2.0 名称，同时提供更清晰的 v3 新名称

## 快速上手

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

## Demo 和官网

- GitHub Pages 演示地址：`https://fanqie.github.io/jspredict-dc/`
- 仓库根目录演示页：[`index.html`](./index.html)

演示页基于 Cesium，用来做浏览器里的快速可视化验证，包含：

- 实时轨道渲染
- 2D 星下点轨迹查看
- UTC 时间轴拖动
- 采样预览面板
- 纯文本数据页，用于检查原始输出

## v3 相对 2.0 的变化

### 改动重点

- v3 基于 `satellite.js` 6.x
- v3 不再把独立传播内核作为公共设计的一部分
- v3 接受统一后的轨道源输入，而不是只接受一种固定格式
- v3 使用原生 `Date`，不再依赖 moment 风格时间层
- v3 保留 2.0 名称作为兼容别名，旧代码可以继续运行

### API 迁移映射

| 2.0 名称 | v3 名称 | 状态 |
| --- | --- | --- |
| `getPositionByTime` | `observeAt` | 保留别名 |
| `getEphemeris` | `ephemeris` | 保留别名 |
| `transits` | `findTransits` | 保留别名 |
| `getTransitSegment` | `transitSegment` | 保留别名 |
| `getVisibilityWindows` | `visibilityWindows` | 保留别名 |
| `getSatelliteVisibilityWindows` | `satelliteVisibilityWindows` | 保留别名 |
| `getOrbitalPeriodByTle` | `orbitalPeriodFromOrbitSource` | 保留别名 |
| `getOrbitalPeriodByCartesian3` | `orbitalPeriodFromCartesian3` | 保留别名 |
| `setDebugIntervalLogging` | `printIntervalInfo` | 保留别名 |
| `setIterationLimit` | `setMax` | 保留别名 |

## 支持的轨道输入

`jspredict-dc` 支持以下输入：

- TLE 字符串
- OMM XML 字符串
- JSON GP 对象或 JSON 字符串
- 已经构建好的 `satrec` 对象

推荐使用的 v3 新入口：

- `normalizeOrbitSource(source)`
- `fromTle(line1, line2)`
- `fromJsonGp(record)`
- `fromOmmXml(xml)`

## 主要 API

### 观测

- `observeAt(source, observerLocation?, time?)`
- `getPositionByTime(...)` 旧名兼容别名

返回某个 UTC 时刻的单次观测结果。传入观测者位置后，还会附带方位角、仰角、斜距和多普勒相关信息。

### 星历

- `ephemeris(source, observerLocation, start, end, interval?)`
- `getEphemeris(...)` 旧名兼容别名

在时间窗内按固定步长采样，返回一组观测结果。

### 过境预测

- `findTransits(source, observerLocation, start, end, minElevation?, maxTransits?)`
- `transits(...)` 旧名兼容别名
- `transitSegment(source, observerLocation, start, end)`
- `getTransitSegment(...)` 旧名兼容别名

用于搜索地面观测者的可见过境窗口。

### 可见窗口

- `visibilityWindows(source, observerLocation, start, end)`
- `getVisibilityWindows(...)` 旧名兼容别名
- `satelliteVisibilityWindows(source1, source2, start, end, stepSeconds?)`
- `getSatelliteVisibilityWindows(...)` 旧名兼容别名

前者计算地面观测窗口，后者计算两颗卫星之间的互见窗口。

### 轨道周期

- `orbitalPeriodFromOrbitSource(source)`
- `orbitalPeriodFromTle(...)` 旧名兼容别名
- `orbitalPeriodFromCartesian3([x, y, z])`
- `getOrbitalPeriodByTle(...)` 旧名兼容别名
- `getOrbitalPeriodByCartesian3(...)` 旧名兼容别名

根据轨道源或笛卡尔半径估算轨道周期。

### 运行时配置

- `setIterationLimit(max)`
- `setMax(max)` 旧名兼容别名
- `printIntervalInfo(open)`
- `setDebugIntervalLogging(open)` 旧名兼容别名

用于控制搜索算法的最大迭代次数和调试日志输出。

## 全部导出 API

| API | 说明 |
| --- | --- |
| `normalizeOrbitSource(source)` | 将任意支持的轨道输入归一化为标准内部结构。 |
| `fromTle(line1, line2)` | 从 TLE 两行文本构建标准轨道源。 |
| `fromJsonGp(record)` | 从 JSON GP 对象构建标准轨道源。 |
| `fromOmmXml(xml)` | 从 OMM XML 构建标准轨道源。 |
| `observeAt(source, observerLocation?, time?)` | 计算单个时刻的卫星观测结果。 |
| `getPositionByTime(...)` | `observeAt` 的 2.0 兼容别名。 |
| `ephemeris(source, observerLocation, start, end, interval?)` | 按时间步长采样星历。 |
| `getEphemeris(...)` | `ephemeris` 的 2.0 兼容别名。 |
| `findTransits(...)` | 搜索可见过境窗口。 |
| `transits(...)` | `findTransits` 的 2.0 兼容别名。 |
| `transitSegment(...)` | 搜索单个过境窗口。 |
| `getTransitSegment(...)` | `transitSegment` 的 2.0 兼容别名。 |
| `visibilityWindows(...)` | 返回地面观测窗口，格式为 `[startMs, endMs]`。 |
| `getVisibilityWindows(...)` | `visibilityWindows` 的 2.0 兼容别名。 |
| `satelliteVisibilityWindows(...)` | 返回两颗卫星之间的互见窗口。 |
| `getSatelliteVisibilityWindows(...)` | `satelliteVisibilityWindows` 的 2.0 兼容别名。 |
| `orbitalPeriodFromOrbitSource(source)` | 从轨道源估算轨道周期。 |
| `orbitalPeriodFromTle(...)` | `orbitalPeriodFromOrbitSource` 的 2.0 兼容别名。 |
| `orbitalPeriodFromCartesian3([x, y, z])` | 从笛卡尔半径估算轨道周期。 |
| `getOrbitalPeriodByTle(...)` | `orbitalPeriodFromOrbitSource` 的 2.0 兼容别名。 |
| `getOrbitalPeriodByCartesian3(...)` | `orbitalPeriodFromCartesian3` 的 2.0 兼容别名。 |
| `setIterationLimit(max)` | 设置搜索算法允许的最大迭代次数。 |
| `setMax(max)` | `setIterationLimit` 的 2.0 兼容别名。 |
| `printIntervalInfo(open)` | 开关调试日志输出。 |
| `setDebugIntervalLogging(open)` | `printIntervalInfo` 的 2.0 兼容别名。 |

## 示例

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

## 依赖说明

### 运行时依赖

- [`satellite.js`](https://github.com/shashwatak/satellite-js) `^6.0.1`

### 开发依赖

- Rollup
- Jest
- CommonJS / JSON / Node resolve / 压缩等 Rollup 插件

### Demo 依赖

仓库根目录的演示页在浏览器里使用 Cesium，但 Cesium 不是这个包的运行时 npm 依赖。

## 协议

MIT
