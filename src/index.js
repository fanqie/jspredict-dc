const runtime = require('./runtime');
const core = require('./core');

// 运行时开关只保留最小表面，避免把内部状态暴露给调用方。
function setMax(max) {
  if (max == null) {
    return runtime.maxIterations;
  }

  if (!Number.isFinite(max) || max <= 0) {
    throw new Error('max must be a positive number');
  }

  runtime.maxIterations = Math.floor(max);
  return runtime.maxIterations;
}

// 兼容 2.x 的调试开关：保留旧名字，同时让新代码可以统一用更直观的 API。
function printIntervalInfo(open) {
  runtime.printIntervalInfo = Boolean(open);
  return runtime.printIntervalInfo;
}

const api = {
  // 运行时配置。
  printIntervalInfo,
  setDebugIntervalLogging: printIntervalInfo,
  setMax,
  setIterationLimit: setMax,

  // 轨道输入归一化。
  normalizeOrbitSource: core.normalizeOrbitSource,
  fromTle: core.fromTle,
  fromJsonGp: core.fromJsonGp,
  fromOmmXml: core.fromOmmXml,

  // 单时刻观测与星历。
  observeAt: core.observeAt,
  getPositionByTime: core.observeAt,

  ephemeris: core.ephemeris,
  getEphemeris: core.ephemeris,

  // 过境与可见性。
  findTransits: core.findTransits,
  transits: core.findTransits,

  transitSegment: core.transitSegment,
  getTransitSegment: core.transitSegment,

  visibilityWindows: core.visibilityWindows,
  getVisibilityWindows: core.visibilityWindows,

  satelliteVisibilityWindows: core.satelliteVisibilityWindows,
  getSatelliteVisibilityWindows: core.satelliteVisibilityWindows,

  // 轨道周期。
  orbitalPeriodFromOrbitSource: core.orbitalPeriodFromOrbitSource,
  orbitalPeriodFromTle: core.orbitalPeriodFromOrbitSource,
  getOrbitalPeriodByTle: core.orbitalPeriodFromOrbitSource,

  orbitalPeriodFromCartesian3: core.orbitalPeriodFromCartesian3,
  getOrbitalPeriodByCartesian3: core.orbitalPeriodFromCartesian3,
};

module.exports = api;
module.exports.default = api;
