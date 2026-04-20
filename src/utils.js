const satellite = require('satellite.js');
const {
  astronomicalUnitKm,
  deg2rad,
  earthRadiusKm,
  msPerDay,
} = require('./constants');

// 将输入值判断为普通对象，避免把数组、Date 或其它宿主对象误当成结构化配置。
function isPlainObject(value) {
  return Boolean(value) && Object.prototype.toString.call(value) === '[object Object]';
}

// 把支持的各种时间输入统一成 Date，后续传播与采样只处理这一种时间形式。
function toDate(value) {
  if (value == null) {
    return new Date();
  }

  if (value instanceof Date) {
    return new Date(value.getTime());
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value);
  }

  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  if (typeof value.valueOf === 'function') {
    const numeric = value.valueOf();
    if (typeof numeric === 'number' && Number.isFinite(numeric)) {
      return new Date(numeric);
    }
  }

  throw new Error('Invalid time value');
}

// 将时间对象转换成毫秒时间戳，便于做窗口比较和差值计算。
function toMillis(value) {
  return toDate(value).getTime();
}

// 把 number、字符串或者“单位对象”都折算成毫秒长度，方便星历采样复用同一套入口。
function toDurationMs(interval, fallbackMs = 60 * 1000) {
  if (interval == null) {
    return fallbackMs;
  }

  if (typeof interval === 'number') {
    if (!Number.isFinite(interval) || interval <= 0) {
      throw new Error('Interval must be a positive number');
    }
    return interval;
  }

  if (typeof interval === 'string') {
    const parsed = Number(interval);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  if (isPlainObject(interval)) {
    const unitMap = {
      milliseconds: 1,
      ms: 1,
      seconds: 1000,
      second: 1000,
      s: 1000,
      minutes: 60 * 1000,
      minute: 60 * 1000,
      m: 60 * 1000,
      hours: 60 * 60 * 1000,
      hour: 60 * 60 * 1000,
      h: 60 * 60 * 1000,
      days: 24 * 60 * 60 * 1000,
      day: 24 * 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
      weeks: 7 * 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
      w: 7 * 24 * 60 * 60 * 1000,
    };

    const total = Object.entries(interval).reduce((sum, [key, rawValue]) => {
      const multiplier = unitMap[key];
      if (!multiplier || typeof rawValue !== 'number') {
        return sum;
      }
      return sum + rawValue * multiplier;
    }, 0);

    if (total > 0) {
      return total;
    }
  }

  throw new Error('Invalid interval value');
}

// 统一观察者输入，支持数组和对象两种写法，最终都返回 [lat, lon, alt]。
function normalizeObserverLocation(observerLocation) {
  if (observerLocation == null) {
    return null;
  }

  if (Array.isArray(observerLocation)) {
    if (observerLocation.length < 3) {
      throw new Error('Observer location must contain latitude, longitude, and altitude');
    }
    return [
      Number(observerLocation[0]),
      Number(observerLocation[1]),
      Number(observerLocation[2]),
    ];
  }

  if (isPlainObject(observerLocation)) {
    const latitude = observerLocation.latitude ?? observerLocation.lat;
    const longitude = observerLocation.longitude ?? observerLocation.lon ?? observerLocation.lng;
    const altitude = observerLocation.altitude ?? observerLocation.height ?? observerLocation.alt;

    if ([latitude, longitude, altitude].some((value) => value == null)) {
      throw new Error('Observer location object must expose latitude, longitude, and altitude');
    }

    return [Number(latitude), Number(longitude), Number(altitude)];
  }

  throw new Error('Unsupported observer location format');
}

// 需要地面观测几何的 API 必须显式提供观测者位置，避免后续循环里出现隐式 NaN 故障。
function requireObserverLocation(observerLocation, apiName) {
  const normalized = normalizeObserverLocation(observerLocation);
  if (!normalized) {
    throw new Error(`${apiName} requires observerLocation`);
  }
  return normalized;
}

// 对经度做 -180 到 180 的闭环处理，避免跨日界线时出现不连续跳变。
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

// 对经度做闭环归一化，保持输出结果适合地图或天球显示。
function boundLongitude(longitude) {
  let value = longitude;
  while (value < -180) {
    value += 360;
  }
  while (value > 180) {
    value -= 360;
  }
  return value;
}

// 从 TLE / OMM 文本中拆出干净的行，后续解析统一使用去空白后的结果。
function splitOrbitLines(text) {
  return text
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

// 判断字符串是否看起来像 XML 轨道源。
function looksLikeXml(text) {
  return /^\s*<[\s\S]+>\s*$/.test(text);
}

// 判断字符串是否看起来像 JSON 轨道源。
function looksLikeJson(text) {
  return /^\s*[{[]/.test(text);
}

// 提取 XML 中某个标签的文本值，同时兼容带命名空间前缀的字段。
function extractXmlTag(xml, tagName) {
  const escaped = tagName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`<${escaped}\\b[^>]*>([\\s\\S]*?)</${escaped}>`, 'i'),
    new RegExp(`<[^:>]+:${escaped}\\b[^>]*>([\\s\\S]*?)</[^:>]+:${escaped}>`, 'i'),
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(xml);
    if (match) {
      return match[1].trim();
    }
  }

  return undefined;
}

// 将 OMM 记录裁剪到库真正会使用的字段，并规范化日期与字符串值。
function normalizeOmmRecord(record) {
  const omm = {};
  const keys = [
    'OBJECT_NAME',
    'OBJECT_ID',
    'CENTER_NAME',
    'REF_FRAME',
    'TIME_SYSTEM',
    'MEAN_MOTION',
    'ECCENTRICITY',
    'INCLINATION',
    'RA_OF_ASC_NODE',
    'ARG_OF_PERICENTER',
    'MEAN_ANOMALY',
    'EPHEMERIS_TYPE',
    'CLASSIFICATION_TYPE',
    'NORAD_CAT_ID',
    'ELEMENT_SET_NO',
    'REV_AT_EPOCH',
    'BSTAR',
    'MEAN_MOTION_DOT',
    'MEAN_MOTION_DDOT',
    'EPOCH',
  ];

  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null && value !== '') {
      omm[key] = typeof value === 'string' ? value.trim() : value;
    }
  }

  if (omm.EPOCH instanceof Date) {
    omm.EPOCH = omm.EPOCH.toISOString();
  }

  return omm;
}

// 从 OMM XML 文本中抽取字段并归一化，作为 JSON GP / XML 两种输入的统一入口。
function parseOmmXml(xml) {
  const omm = {};
  const fields = [
    'OBJECT_NAME',
    'OBJECT_ID',
    'CENTER_NAME',
    'REF_FRAME',
    'TIME_SYSTEM',
    'MEAN_MOTION',
    'ECCENTRICITY',
    'INCLINATION',
    'RA_OF_ASC_NODE',
    'ARG_OF_PERICENTER',
    'MEAN_ANOMALY',
    'EPHEMERIS_TYPE',
    'CLASSIFICATION_TYPE',
    'NORAD_CAT_ID',
    'ELEMENT_SET_NO',
    'REV_AT_EPOCH',
    'BSTAR',
    'MEAN_MOTION_DOT',
    'MEAN_MOTION_DDOT',
    'EPOCH',
  ];

  for (const field of fields) {
    const value = extractXmlTag(xml, field);
    if (value !== undefined) {
      omm[field] = value;
    }
  }

  if (!omm.EPOCH) {
    const epoch = extractXmlTag(xml, 'EPOCH');
    if (epoch) {
      omm.EPOCH = epoch;
    }
  }

  return normalizeOmmRecord(omm);
}

// 把用户传入的任意轨道源写法统一成内部标准结构，后续只处理少数几种分支。
function parseOrbitSource(source) {
  if (source && typeof source === 'object' && source.kind === 'satrec' && source.satrec) {
    return {
      kind: 'satrec',
      satrec: source.satrec,
    };
  }

  if (source && typeof source === 'object' && source.kind === 'tle' && source.tle) {
    return {
      kind: 'tle',
      tle: {
        line1: String(source.tle.line1).trim(),
        line2: String(source.tle.line2).trim(),
      },
    };
  }

  if (source && typeof source === 'object' && source.kind === 'omm' && source.omm) {
    return {
      kind: 'omm',
      omm: normalizeOmmRecord(source.omm),
    };
  }

  if (source && typeof source === 'object' && source.no != null && source.ecco != null && source.inclo != null) {
    return {
      kind: 'satrec',
      satrec: source,
    };
  }

  if (typeof source === 'string') {
    const text = source.trim();
    if (!text) {
      throw new Error('Orbit source is empty');
    }

    if (looksLikeXml(text)) {
      return {
        kind: 'omm',
        source: text,
        omm: parseOmmXml(text),
      };
    }

    if (looksLikeJson(text)) {
      try {
        const parsed = JSON.parse(text);
        return parseOrbitSource(parsed);
      } catch (error) {
        throw new Error(`Invalid JSON orbit source: ${error.message}`);
      }
    }

    const lines = splitOrbitLines(text);
    if (lines.length === 2) {
      return {
        kind: 'tle',
        source: text,
        tle: {
          line1: lines[0],
          line2: lines[1],
        },
      };
    }

    if (lines.length >= 3) {
      return {
        kind: 'tle',
        source: text,
        tle: {
          line1: lines[lines.length - 2],
          line2: lines[lines.length - 1],
        },
      };
    }

    throw new Error('Invalid orbit source string');
  }

  if (Array.isArray(source)) {
    throw new Error('Orbit source cannot be an array');
  }

  if (isPlainObject(source)) {
    if (source.line1 && source.line2) {
      return {
        kind: 'tle',
        tle: {
          line1: String(source.line1).trim(),
          line2: String(source.line2).trim(),
        },
      };
    }

    if (source.type === 'tle' && source.tle) {
      return parseOrbitSource(source.tle);
    }

    if (source.format === 'tle' && source.line1 && source.line2) {
      return {
        kind: 'tle',
        tle: {
          line1: String(source.line1).trim(),
          line2: String(source.line2).trim(),
        },
      };
    }

    if (source.type === 'omm' && source.omm) {
      return {
        kind: 'omm',
        omm: normalizeOmmRecord(source.omm),
      };
    }

    if (
      source.MEAN_MOTION != null ||
      source.ECCENTRICITY != null ||
      source.INCLINATION != null ||
      source.NORAD_CAT_ID != null
    ) {
      return {
        kind: 'omm',
        omm: normalizeOmmRecord(source),
      };
    }
  }

  throw new Error('Unsupported orbit source format');
}

// 把归一化后的轨道源转换为 satellite.js 可直接传播的 satrec。
function toSatrec(source) {
  const normalized = parseOrbitSource(source);
  const satelliteLib = satellite;

  if (normalized.kind === 'satrec') {
    return normalized.satrec;
  }

  if (normalized.kind === 'tle') {
    return satelliteLib.twoline2satrec(normalized.tle.line1, normalized.tle.line2);
  }

  if (normalized.kind === 'omm') {
    if (typeof satelliteLib.json2satrec !== 'function') {
      throw new Error('satellite.js json2satrec is unavailable in this build');
    }
    return satelliteLib.json2satrec(normalized.omm);
  }

  throw new Error('Unable to convert orbit source to satrec');
}

// 兼容不同 satellite.js 构建里的时间接口，统一拿到 satrec 的历元毫秒值。
function satrecEpochMillis(satrec) {
  if (Number.isFinite(satrec.jdsatepoch)) {
    return (satrec.jdsatepoch - 2440587.5) * msPerDay;
  }

  if (Number.isFinite(satrec.epochyr) && Number.isFinite(satrec.epochdays)) {
    const year = satrec.epochyr < 100 ? 2000 + satrec.epochyr : satrec.epochyr;
    return Date.UTC(year, 0, 1) + (satrec.epochdays - 1) * msPerDay;
  }

  return NaN;
}

// 计算给定时间的 GMST，优先使用库自带方法，兼容旧签名回退。
function getGmst(date) {
  const jday = satellite.jday(date);
  try {
    return satellite.gstime(jday);
  } catch (error) {
    return satellite.gstime(
      date.getUTCFullYear(),
      date.getUTCMonth() + 1,
      date.getUTCDate(),
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds(),
    );
  }
}

// 调用传播器获取某一时刻的卫星状态，并兼容不同 satellite.js 版本的参数签名。
function getPropagation(date, satrec) {
  try {
    const propagated = satellite.propagate(satrec, date);
    if (propagated && propagated.position) {
      return propagated;
    }
  } catch (error) {
    // Fall through to the component-based call for older satellite.js builds.
  }

  return satellite.propagate(
    satrec,
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate(),
    date.getUTCHours(),
    date.getUTCMinutes(),
    date.getUTCSeconds(),
  );
}

// 计算太阳位置向量，用于判断卫星是否处于地影中。
function getSunVector(date) {
  if (typeof satellite.sunPos === 'function') {
    const solar = satellite.sunPos(satellite.jday(date));
    if (solar && Array.isArray(solar.rsun) && solar.rsun.length >= 3) {
      return {
        x: solar.rsun[0] * astronomicalUnitKm,
        y: solar.rsun[1] * astronomicalUnitKm,
        z: solar.rsun[2] * astronomicalUnitKm,
      };
    }
  }

  const time = date.getTime() / msPerDay + 2444238.5;
  const mjd = time - 2415020.0;
  const year = 1900 + mjd / 365.25;
  const deltaEt = 26.465 + 0.747622 * (year - 1950) + 1.886913 * Math.sin((2 * Math.PI) * (year - 1975) / 33);
  const T = (mjd + deltaEt / (msPerDay / 1000)) / 36525.0;
  const M = deg2rad * ((358.47583 + ((35999.04975 * T) % 360) - (0.000150 + 0.0000033 * T) * Math.pow(T, 2)) % 360);
  const L = deg2rad * ((279.69668 + ((36000.76892 * T) % 360) + 0.0003025 * Math.pow(T, 2)) % 360);
  const e = 0.01675104 - (0.0000418 + 0.000000126 * T) * T;
  const C = deg2rad * ((1.919460 - (0.004789 + 0.000100 * T) * T) * Math.sin(M) + (0.020094 - 0.000100 * T) * Math.sin(2 * M) + 0.000293 * Math.sin(3 * M));
  const O = deg2rad * ((259.18 - 1934.142 * T) % 360.0);
  const Lsa = (L + C - deg2rad * (0.00569 - 0.00479 * Math.sin(O))) % (2 * Math.PI);
  const nu = (M + C) % (2 * Math.PI);
  let radius = 1.0000002 * (1 - Math.pow(e, 2)) / (1 + e * Math.cos(nu));
  const eps = deg2rad * (23.452294 - (0.0130125 + (0.00000164 - 0.000000503 * T) * T) * T + 0.00256 * Math.cos(O));
  radius = astronomicalUnitKm * radius;

  return {
    x: radius * Math.cos(Lsa),
    y: radius * Math.sin(Lsa) * Math.cos(eps),
    z: radius * Math.sin(Lsa) * Math.sin(eps),
  };
}

// 判断卫星是否被地球遮挡太阳，返回日照状态和阴影深度。
function satEclipsed(position, sunVector) {
  const positionMagnitude = Math.sqrt(position.x ** 2 + position.y ** 2 + position.z ** 2);
  const sunDelta = {
    x: sunVector.x - position.x,
    y: sunVector.y - position.y,
    z: sunVector.z - position.z,
  };
  const sunMagnitude = Math.sqrt(sunDelta.x ** 2 + sunDelta.y ** 2 + sunDelta.z ** 2);
  const earthRadius = earthRadiusKm;
  const sunRadius = 696000;
  const sdEarth = Math.asin(clamp(earthRadius / positionMagnitude, -1, 1));
  const sdSun = Math.asin(clamp(sunRadius / sunMagnitude, -1, 1));
  const earth = {
    x: -position.x,
    y: -position.y,
    z: -position.z,
  };
  const dot = sunVector.x * earth.x + sunVector.y * earth.y + sunVector.z * earth.z;
  const delta = Math.acos(clamp(dot / (Math.sqrt(sunVector.x ** 2 + sunVector.y ** 2 + sunVector.z ** 2) * positionMagnitude), -1, 1));
  const eclipseDepth = sdEarth - sdSun - delta;
  return {
    depth: eclipseDepth,
    eclipsed: sdEarth >= sdSun && eclipseDepth >= 0,
  };
}

// 判断轨道是否接近地球同步轨道，用于快速过滤不需要过境搜索的目标。
function isGeostationary(satrec) {
  const revPerDay = satrec.no * 24 * 60 / (2 * Math.PI);
  return Math.abs(revPerDay - 1.0027) < 0.005;
}

// 判断给定卫星是否可能在当前观察者位置产生有效过境。
function aosHappens(satrec, observerLocation) {
  let meanMotion = satrec.no * 24 * 60 / (2 * Math.PI);
  if (meanMotion === 0) {
    return false;
  }

  let inclination = satrec.inclo / deg2rad;
  if (inclination >= 90.0) {
    inclination = 180.0 - inclination;
  }

  const sma = 331.25 * Math.exp(Math.log(1440.0 / meanMotion) * (2.0 / 3.0));
  const apogee = sma * (1.0 + satrec.ecco) - earthRadiusKm;
  return (Math.acos(earthRadiusKm / (apogee + earthRadiusKm)) + (inclination * deg2rad)) > Math.abs(observerLocation[0] * deg2rad);
}

// 通过历元和阻尼参数粗略判断卫星是否已经衰减失效。
function decayed(satrec, startMs) {
  const satelliteEpoch = satrecEpochMillis(satrec);
  const meanMotion = satrec.no * 24 * 60 / (2 * Math.PI);
  const drag = satrec.ndot * 24 * 60 * 24 * 60 / (2 * Math.PI);

  if (!Number.isFinite(satelliteEpoch) || !Number.isFinite(meanMotion) || drag === 0) {
    return false;
  }

  return satelliteEpoch + msPerDay * ((16.666666 - meanMotion) / (10.0 * Math.abs(drag))) < startMs;
}

// 组合几何条件和衰减判断，快速排除不需要继续搜索的轨道。
function badSat(satrec, observerLocation, startMs) {
  if (observerLocation && !aosHappens(satrec, observerLocation)) {
    return true;
  }

  if (startMs != null && decayed(satrec, startMs)) {
    return true;
  }

  return false;
}

// 向量减法，供可见性和轨道可达性判断复用。
function vecSub(v1, v2) {
  return {
    x: v1.x - v2.x,
    y: v1.y - v2.y,
    z: v1.z - v2.z,
  };
}

// 计算向量模长。
function magnitude(v) {
  return Math.sqrt(v.x ** 2 + v.y ** 2 + v.z ** 2);
}

// 向量按标量缩放。
function scalarMultiply(k, v) {
  return {
    x: k * v.x,
    y: k * v.y,
    z: k * v.z,
  };
}

// 计算两个向量的夹角。
function angle(v1, v2) {
  const dot = (v1.x * v2.x + v1.y * v2.y + v1.z * v2.z);
  return Math.acos(dot / (magnitude(v1) * magnitude(v2)));
}

// 观测单个时刻的卫星状态，返回地理位置、方位角、仰角、距离和多普勒等结果。
function observeAt(source, observerLocation, time) {
  const satrec = toSatrec(source);
  const date = toDate(time);
  const propagated = getPropagation(date, satrec);

  if (!propagated || !propagated.position) {
    return null;
  }

  const gmst = getGmst(date);
  const geo = satellite.eciToGeodetic(propagated.position, gmst);
  const sunVector = getSunVector(date);
  const eclipse = satEclipsed(propagated.position, sunVector);
  const altitude = geo.height;
  const ratio = clamp(earthRadiusKm / Math.max(earthRadiusKm + altitude, 1e-6), -1, 1);

  const track = {
    eci: propagated,
    gmst,
    latitude: geo.latitude / deg2rad,
    longitude: boundLongitude(geo.longitude / deg2rad),
    altitude,
    footprint: 2 * earthRadiusKm * Math.acos(ratio),
    sunlit: !eclipse.eclipsed,
    eclipseDepth: eclipse.depth / deg2rad,
  };

  const normalizedObserver = normalizeObserverLocation(observerLocation);
  if (normalizedObserver) {
    const observerGd = {
      longitude: normalizedObserver[1] * deg2rad,
      latitude: normalizedObserver[0] * deg2rad,
      height: normalizedObserver[2],
    };

    const positionEcf = satellite.eciToEcf(propagated.position, gmst);
    const velocityEcf = satellite.eciToEcf(propagated.velocity, gmst);
    const observerEcf = satellite.geodeticToEcf(observerGd);
    const lookAngles = satellite.ecfToLookAngles(observerGd, positionEcf);
    const doppler = satellite.dopplerFactor(observerEcf, positionEcf, velocityEcf);

    track.azimuth = lookAngles.azimuth / deg2rad;
    track.elevation = lookAngles.elevation / deg2rad;
    track.rangeSat = lookAngles.rangeSat;
    track.doppler = doppler;
  }

  return track;
}

// 从给定时刻向前后搜索卫星升起和落下的边界。
function findAOS(satrec, observerLocation, startMs) {
  let current = startMs;
  let observed = observeAt(satrec, observerLocation, current);
  if (!observed) {
    return null;
  }

  let aostime = 0;
  let iterations = 0;

  if (observed.elevation > 0) {
    return current;
  }

  while (observed.elevation < -1 && iterations < require('./runtime').maxIterations) {
    current -= msPerDay * 0.00035 * (observed.elevation * ((observed.altitude / 8400.0) + 0.46) - 2.0);
    observed = observeAt(satrec, observerLocation, current);
    if (!observed) {
      break;
    }
    iterations += 1;
  }

  iterations = 0;
  while (aostime === 0 && iterations < require('./runtime').maxIterations) {
    if (!observed) {
      break;
    }
    if (Math.abs(observed.elevation) < 0.50) {
      aostime = current;
    } else {
      current -= msPerDay * observed.elevation * Math.sqrt(observed.altitude) / 530000.0;
      observed = observeAt(satrec, observerLocation, current);
    }
    iterations += 1;
  }

  if (aostime === 0) {
    return null;
  }

  return aostime;
}

// 从当前的升起时刻继续搜索，找到过境结束时刻。
function findLOS(satrec, observerLocation, startMs) {
  let current = startMs;
  let observed = observeAt(satrec, observerLocation, current);
  let lostime = 0;
  let iterations = 0;

  while (lostime === 0 && iterations < require('./runtime').maxIterations) {
    if (Math.abs(observed.elevation) < 0.50) {
      lostime = current;
    } else {
      current += msPerDay * observed.elevation * Math.sqrt(observed.altitude) / 502500.0;
      observed = observeAt(satrec, observerLocation, current);
      if (!observed) {
        break;
      }
    }
    iterations += 1;
  }

  return lostime;
}

// 快速预测一次过境窗口，并估计峰值仰角、方位和持续时间。
function quickPredict(satrec, observerLocation, startMs, endMs) {
  if (isGeostationary(satrec)) {
    return null;
  }

  if (badSat(satrec, observerLocation, startMs)) {
    return null;
  }

  const transit = {};
  let lastEl = 0;
  let iterations = 0;
  const maxIterations = require('./runtime').maxIterations;

  let daynum = findAOS(satrec, observerLocation, startMs);
  if (!daynum) {
    return null;
  }

  transit.start = daynum;

  let observed = observeAt(satrec, observerLocation, daynum);
  if (!observed) {
    return null;
  }

  let iel = Math.round(observed.elevation);
  let maxEl = 0;
  let apexAz = 0;
  let minAz = 360;
  let maxAz = 0;

  while (iel >= 0 && iterations < maxIterations && (!endMs || daynum < endMs)) {
    lastEl = iel;
    daynum += msPerDay * Math.cos((observed.elevation - 1.0) * deg2rad) * Math.sqrt(observed.altitude) / 25000.0;
    observed = observeAt(satrec, observerLocation, daynum);
    if (!observed) {
      break;
    }
    iel = Math.round(observed.elevation);
    if (maxEl < observed.elevation) {
      maxEl = observed.elevation;
      apexAz = observed.azimuth;
    }
    maxAz = Math.max(maxAz, observed.azimuth);
    minAz = Math.min(minAz, observed.azimuth);
    iterations += 1;
  }

  if (lastEl !== 0) {
    daynum = findLOS(satrec, observerLocation, daynum);
  }

  transit.end = daynum;
  transit.maxElevation = maxEl;
  transit.apexAzimuth = apexAz;
  transit.maxAzimuth = maxAz;
  transit.minAzimuth = minAz;
  transit.duration = transit.end - transit.start;

  return transit;
}

// 判断两颗卫星之间的视线是否被地球遮挡。
function isSatToSatVisible(pos1, pos2) {
  const vec = vecSub(pos2, pos1);
  const dist = magnitude(vec);

  if (dist === 0) {
    return false;
  }

  const a = vec.x * vec.x + vec.y * vec.y + vec.z * vec.z;
  const b = 2 * (pos1.x * vec.x + pos1.y * vec.y + pos1.z * vec.z);
  const c = pos1.x * pos1.x + pos1.y * pos1.y + pos1.z * pos1.z - earthRadiusKm * earthRadiusKm;
  const discriminant = b * b - 4 * a * c;

  if (discriminant < 0) {
    return true;
  }

  const t1 = (-b + Math.sqrt(discriminant)) / (2 * a);
  const t2 = (-b - Math.sqrt(discriminant)) / (2 * a);
  return t1 < 0 || t1 > 1 || t2 < 0 || t2 > 1;
}

// 根据两次传播结果和相对速度，计算更合适的自适应步长。
function adaptiveStep(eci1, eci2, isVisible, defaultStep) {
  const dist = magnitude(vecSub(eci2.position, eci1.position));
  const relSpeed = magnitude(vecSub(eci2.velocity, eci1.velocity));
  if (relSpeed === 0) {
    return defaultStep;
  }

  const minStep = 1;
  // dist / relSpeed 已经是秒，不能再乘 1000。
  const adaptiveStepValue = Math.max(minStep, Math.min(defaultStep, dist / relSpeed));
  return isVisible ? defaultStep : Math.min(defaultStep, adaptiveStepValue / 2);
}

// 计算两个轨道源之间在给定时间段内的相互可见窗口。
function satelliteVisibilityWindows(source1, source2, start, end, stepSeconds = 60) {
  const satrec1 = toSatrec(source1);
  const satrec2 = toSatrec(source2);
  const startDate = toDate(start);
  const endDate = toDate(end);
  const windows = [];
  let current = new Date(startDate.getTime());
  let isVisible = false;
  let windowStart = null;
  const maxIterations = require('./runtime').maxIterations;

  while (current <= endDate && windows.length < maxIterations) {
    const eci1 = getPropagation(current, satrec1);
    const eci2 = getPropagation(current, satrec2);

    if (!eci1.position || !eci2.position) {
      break;
    }

    const visible = isSatToSatVisible(eci1.position, eci2.position);
    if (visible && !isVisible) {
      isVisible = true;
      windowStart = current.getTime();
    } else if (!visible && isVisible) {
      isVisible = false;
      windows.push([windowStart, current.getTime()]);
      windowStart = null;
    }

    const nextStep = adaptiveStep(eci1, eci2, visible, stepSeconds);
    current = new Date(current.getTime() + nextStep * 1000);
  }

  if (isVisible && windowStart != null) {
    windows.push([windowStart, endDate.getTime()]);
  }

  return windows;
}

// 以固定步长生成星历采样，用于绘图、表格或调试输出。
function ephemeris(source, observerLocation, start, end, interval) {
  const startDate = toDate(start);
  const endDate = toDate(end);
  const stepMs = toDurationMs(interval, 60 * 1000);
  const observations = [];
  const maxIterations = require('./runtime').maxIterations;
  let current = new Date(startDate.getTime());
  let iterations = 0;

  while (current < endDate && iterations < maxIterations) {
    const observation = observeAt(source, observerLocation, current);
    if (!observation) {
      break;
    }
    observations.push(observation);
    current = new Date(current.getTime() + stepMs);
    if (require('./runtime').printIntervalInfo) {
      console.log(current.toISOString());
    }
    iterations += 1;
  }

  return observations;
}

// 搜索指定时间段内的所有过境窗口。
function findTransits(source, observerLocation, start, end, minElevation, maxTransits = 100) {
  const startDate = toDate(start);
  const endDate = toDate(end);
  const satrec = toSatrec(source);
  const threshold = minElevation == null ? 4 : minElevation;
  const effectiveMaxTransits = maxTransits == null ? require('./runtime').maxIterations : maxTransits;
  const normalizedObserver = requireObserverLocation(observerLocation, 'findTransits');

  if (!Number.isFinite(effectiveMaxTransits) || effectiveMaxTransits < 0) {
    throw new Error('maxTransits must be a non-negative number');
  }

  if (badSat(satrec, normalizedObserver, startDate.getTime())) {
    return [];
  }

  const transits = [];
  let time = startDate.getTime();
  let iterations = 0;
  const maxIterations = require('./runtime').maxIterations;

  while (iterations < maxIterations && transits.length < effectiveMaxTransits) {
    const transit = quickPredict(satrec, normalizedObserver, time, endDate.getTime());
    if (!transit) {
      break;
    }
    if (transit.end > endDate.getTime()) {
      break;
    }
    if (transit.end > startDate.getTime() && transit.maxElevation > threshold) {
      transits.push(transit);
    }
    time = transit.end + 60 * 1000;
    iterations += 1;
  }

  return transits;
}

// 搜索单个过境窗口，适合做“下一次过境”之类的交互。
function transitSegment(source, observerLocation, start, end) {
  const startDate = toDate(start);
  const endDate = toDate(end);
  const satrec = toSatrec(source);
  const normalizedObserver = requireObserverLocation(observerLocation, 'transitSegment');
  if (badSat(satrec, normalizedObserver, startDate.getTime())) {
    return null;
  }

  return quickPredict(satrec, normalizedObserver, startDate.getTime(), endDate.getTime());
}

// 计算观测者在整个时间段内的可见窗口，输出起止时间戳数组。
function visibilityWindows(source, observerLocation, start, end) {
  const startDate = toDate(start);
  const endDate = toDate(end);
  const satrec = toSatrec(source);
  const normalizedObserver = requireObserverLocation(observerLocation, 'visibilityWindows');

  if (isGeostationary(satrec) && aosHappens(satrec, normalizedObserver)) {
    return [[startDate.getTime(), endDate.getTime()]];
  }

  const transits = findTransits(satrec, normalizedObserver, startDate, endDate);
  if (!transits || transits.length === 0) {
    return [];
  }

  return transits.map((transit) => [transit.start, transit.end]);
}

// 根据轨道源里的半长轴估算轨道周期。
function orbitalPeriodFromOrbitSource(source) {
  const satrec = toSatrec(source);
  const semiMajorAxisKm = satrec.a * earthRadiusKm;
  return 2 * Math.PI * Math.sqrt(Math.pow(semiMajorAxisKm, 3) / 398600.5);
}

// 根据笛卡尔坐标半径估算对应的开普勒周期。
function orbitalPeriodFromCartesian3(cartesian3 = [0, 0, 0]) {
  const [x, y, z] = cartesian3;
  const radius = Math.sqrt(x * x + y * y + z * z);
  if (radius <= 0) {
    return 0;
  }

  return 2 * Math.PI * Math.sqrt(Math.pow(radius, 3) / 398600.5);
}

module.exports = {
  parseOrbitSource,
  normalizeOrbitSource: parseOrbitSource,
  fromTle(line1OrText, maybeLine2) {
    if (maybeLine2) {
      return parseOrbitSource({ line1: line1OrText, line2: maybeLine2 });
    }
    return parseOrbitSource(line1OrText);
  },
  fromJsonGp(record) {
    return parseOrbitSource(normalizeOmmRecord(record));
  },
  fromOmmXml(xml) {
    return parseOrbitSource(parseOmmXml(xml));
  },
  toSatrec,
  observeAt,
  ephemeris,
  findTransits,
  transitSegment,
  visibilityWindows,
  satelliteVisibilityWindows,
  orbitalPeriodFromOrbitSource,
  orbitalPeriodFromCartesian3,
  _internals: {
    boundLongitude,
    clamp,
    getPropagation,
    getGmst,
    getSunVector,
    satEclipsed,
    isGeostationary,
    badSat,
    aosHappens,
    decayed,
    findAOS,
    findLOS,
    quickPredict,
    isSatToSatVisible,
    adaptiveStep,
    vecSub,
    magnitude,
    scalarMultiply,
    angle,
  },
};
