const satellite = require('satellite.js');
const moment = require('moment');
const mu = 398600.5; // in km3 / s2
const earthRadius = 6378.137; // in km
const xkmper = 6.378137E3; // earth radius (km) wgs84
const astro_unit = 1.49597870691E8; // Astronomical unit - km (IAU 76)
const solar_radius = 6.96000E5; // solar radius - km (IAU 76)
const deg2rad = Math.PI / 180;
const ms2day = 1000 * 60 * 60 * 24; // milliseconds to day
let max_iterations = 99999;
const defaultMinElevation = 4; // degrees
let printIntervalInfo = false;

const _jspredict_dc = {
    printIntervalInfo: function (open) {
        printIntervalInfo = open || false;
    },
    setMax: function (max) {
        max_iterations = max || max_iterations;
    },
    /**
     * @typedef {Array<number>} ObserverLocation - 地面观测站位置 [纬度 (度), 经度 (度), 海拔 (千米)].
     */

    /**
     * @typedef {object} Transit - 卫星可见过境信息.
     * @property {number} start - 过境开始时间 (毫秒 Unix 时间戳).
     * @property {number} end - 过境结束时间 (毫秒 Unix 时间戳).
     * @property {number} maxElevation - 过境期间的最大仰角 (度).
     * @property {number} apexAzimuth - 达到最大仰角时的方位角 (度).
     * @property {number} maxAzimuth - 过境期间的最大方位角 (度).
     * @property {number} minAzimuth - 过境期间的最小方位角 (度).
     * @property {number} duration - 过境持续时间 (毫秒).
     */

    /**
     * @typedef {object} Eci - 地心惯性坐标系（Earth-Centered Inertial）.
     * @property {{x: number, y: number, z: number}} position - 卫星在 ECI 坐标系中的位置 (千米).
     * @property {{x: number, y: number, z: number}} velocity - 卫星在 ECI 坐标系中的速度 (千米/秒).
     */

    /**
     * @typedef {object} ObserveResult - 卫星观测结果.
     * @property {Eci} eci - 卫星在 ECI 坐标系中的位置和速度.
     * @property {number} gmst - 格林威治平均恒星时 (弧度).
     * @property {number} latitude - 卫星在地心大地坐标系中的纬度 (度).
     * @property {number} longitude - 卫星在地心大地坐标系中的经度 (度).
     * @property {number} altitude - 卫星在地心大地坐标系中的海拔高度 (千米).
     * @property {number} footprint - 卫星对地面可见的区域直径 (千米).
     * @property {boolean} sunlit - 卫星是否被太阳照亮.
     * @property {number} eclipseDepth - 卫星处于地球阴影中的深度 (弧度).
     * @property {number | undefined} azimuth - 从地面观测点到卫星的方位角 (度). **仅在提供 observerLocation 时计算.**
     * @property {number | undefined} elevation - 从地面观测点到卫星的仰角 (度). **仅在提供 observerLocation 时计算.**
     * @property {number | undefined} rangeSat - 从地面观测点到卫星的直线距离 (千米). **仅在提供 observerLocation 时计算.**
     * @property {number | undefined} doppler - 从地面观测点观察到的卫星的多普勒因子. **仅在提供 observerLocation 时计算.**
     */

    /**
     * @param {string} tle - 卫星的两行轨道数据 (TLE).
     * @param {ObserverLocation} [observerLocation] - 地面观测站位置 [纬度, 经度, 海拔] (千米).
     * @param {number | Date} [time] - 观测时间 (毫秒时间戳 或 Date 对象).
     * @returns {ObserveResult | null} 卫星观测结果或 null.
     */
    getPositionByTime: function (tle, observerLocation, time) {
        const tles = tle.split('\n');
        if (tles.length < 2 || tles.length > 3) {
            throw new Error('Invalid TLE format: expected 2 or 3 lines');
        }
        const satrec = satellite.twoline2satrec(tles[1], tles[2]);

        if (this._badSat(satrec, observerLocation, time)) {
            return null;
        }

        return this._observe(satrec, observerLocation, time)
    },

    /**
     * @param {string} tle - 卫星的两行轨道数据 (TLE).
     * @param {ObserverLocation} observerLocation - 地面观测站位置 [纬度, 经度, 海拔] (千米).
     * @param {number | Date} start - 开始时间 (毫秒时间戳 或 Date 对象).
     * @param {number | Date} end - 结束时间 (毫秒时间戳 或 Date 对象).
     * @param {*} [interval] - 时间间隔 (moment.js interval object).
     * @returns {ObserveResult[]} 卫星观测结果数组.
     */
    getEphemeris: function (tle, observerLocation, start, end, interval) {
        start = moment(start);
        end = moment(end);

        const tles = tle.split('\n');
        if (tles.length < 2 || tles.length > 3) {
            throw new Error('Invalid TLE format: expected 2 or 3 lines');
        }
        const satrec = satellite.twoline2satrec(tles[1], tles[2]);

        if (this._badSat(satrec, observerLocation, start)) {
            return null;
        }

        const observes = [];
        let observed = undefined;
        let iterations = 0;
        while (start < end && iterations < max_iterations) {
            observed = this._observe(satrec, observerLocation, start);
            if (!observed) {
                break;
            }
            observes.push(observed);
            start.add(interval);
            if (printIntervalInfo) {
                start.locale("zh-cn");
                console.log(start.format("llll"));
            }
            iterations += 1;
        }

        return observes
    },

    /**
     * @param {string} tle - 卫星的两行轨道数据 (TLE).
     * @param {ObserverLocation} observerLocation - 地面观测站位置 [纬度, 经度, 海拔] (千米).
     * @param {number | Date} start - 开始搜索时间 (毫秒时间戳 或 Date 对象).
     * @param {number | Date} end - 结束搜索时间 (毫秒时间戳 或 Date 对象).
     * @param {number} [minElevation] - 最小可见仰角 (度), 默认为 4 度.
     * @param {number} [maxTransits] - 返回的最大过境数.
     * @returns {Transit[]} 可见过境信息数组.
     */
    transits: function (tle, observerLocation, start, end, minElevation, maxTransits = 100) {
        start = moment(start);
        end = moment(end);

        if (!minElevation) {
            minElevation = defaultMinElevation;
        }

        if (!maxTransits) {
            maxTransits = max_iterations;
        }

        const tles = tle.split('\n');
        if (tles.length < 2 || tles.length > 3) {
            throw new Error('Invalid TLE format: expected 2 or 3 lines');
        }
        const satrec = satellite.twoline2satrec(tles[1], tles[2]);
        if (this._badSat(satrec, observerLocation, start)) {
            return [];
        }

        let time = start.valueOf();
        const transits = [];
        let nextTransit;
        let iterations = 0;

        while (iterations < max_iterations && transits.length < maxTransits) {
            const transit = this._quickPredict(satrec, observerLocation, time);
            if (!transit) {
                break;
            }
            if (transit.end > end.valueOf()) {
                break;
            }
            if (transit.end > start.valueOf() && transit.maxElevation > minElevation) {
                transits.push(transit);
            }
            time = transit.end + 60 * 1000;
            iterations += 1;
        }

        return transits
    },

    /**
     * @param {string} tle - 卫星的两行轨道数据 (TLE).
     * @param {ObserverLocation} observerLocation - 地面观测站位置 [纬度, 经度, 海拔] (千米).
     * @param {number | Date} start - 时间段开始时间 (毫秒时间戳 或 Date 对象).
     * @param {number | Date} end - 时间段结束时间 (毫秒时间戳 或 Date 对象).
     * @returns {Transit | null} 过境信息或 null.
     */
    transitSegment: function (tle, observerLocation, start, end) {
        start = moment(start);
        end = moment(end);

        const tles = tle.split('\n');
        if (tles.length < 2 || tles.length > 3) {
            throw new Error('Invalid TLE format: expected 2 or 3 lines');
        }
        const satrec = satellite.twoline2satrec(tles[1], tles[2]);
        if (this._badSat(satrec, observerLocation, start)) {
            return [];
        }

        return this._quickPredict(satrec, observerLocation, start.valueOf(), end.valueOf());
    },
    /**
     * @param {string} tle - 卫星的两行轨道数据 (TLE).
     * @param {ObserverLocation} observerLocation - 地面观测站位置 [纬度, 经度, 海拔] (千米).
     * @param {number | Date} start - 时间段开始时间 (毫秒时间戳 或 Date 对象).
     * @param {number | Date} end - 时间段结束时间 (毫秒时间戳 或 Date 对象).
     * @returns {number[][]} 可见窗口时间戳数组.
     */
    getVisibilityWindows: function (tle, observerLocation, start, end) {

        const tles = tle.split('\n');
        if (tles.length < 2 || tles.length > 3) {
            throw new Error('Invalid TLE format: expected 2 or 3 lines');
        }
        const satrec = satellite.twoline2satrec(tles[1], tles[2]);
        if (this._isGeo(satrec) && this._aosHappens(satrec, observerLocation)) {
            return [[start.valueOf(), end.valueOf()]];
        }
        const transits = this.transits(tle, observerLocation, start, end);
        if (!transits || transits.length === 0) {
            return [];
        }

        return transits.map(t => [t.start, t.end]);
    },
    /**
     * 计算两颗卫星之间的可见时间窗口。
     * @param {string} tle1 - 第一颗卫星的两行轨道数据 (TLE)。
     * @param {string} tle2 - 第二颗卫星的两行轨道数据 (TLE)。
     * @param {number | Date} start - 时间段开始时间 (毫秒时间戳 或 Date 对象)。
     * @param {number | Date} end - 时间段结束时间 (毫秒时间戳 或 Date 对象)。
     * @param {number} [stepSeconds=60] - 时间步长（秒），默认 60 秒。
     * @returns {number[][]} 两卫星之间可见的时间窗口数组 [[start, end], ...]。
     */
    getSatelliteVisibilityWindows: function (tle1, tle2, start, end, stepSeconds = 60) {
        // 输入验证
        if (!tle1 || typeof tle1 !== 'string' || !tle2 || typeof tle2 !== 'string') {
            throw new Error('Invalid TLE: expected strings for both satellites');
        }
        start = moment(start);
        end = moment(end);


        // 解析 TLE 数据
        const tles1 = tle1.split('\n');
        const tles2 = tle2.split('\n');
        if (tles1.length < 2 || tles1.length > 3 || tles2.length < 2 || tles2.length > 3) {
            throw new Error('Invalid TLE format: expected 2 or 3 lines for each satellite');
        }
        const satrec1 = satellite.twoline2satrec(tles1[tles1.length - 2], tles1[tles1.length - 1]);
        const satrec2 = satellite.twoline2satrec(tles2[tles2.length - 2], tles2[tles2.length - 1]);

        // 检查卫星是否有效
        if (this._badSat(satrec1, null, start) || this._badSat(satrec2, null, start)) {
            return [];
        }

        const windows = [];
        let current = start.clone();
        let isVisible = false;
        let windowStart = null;
        const stepMs = stepSeconds * 1000;

        // 迭代时间范围
        while (current <= end && windows.length < max_iterations) {
            // 计算两颗卫星的 ECI 位置
            const eci1 = this._eci(satrec1, current);
            const eci2 = this._eci(satrec2, current);
            if (!eci1.position || !eci2.position) {
                break;
            }

            // 检查地球遮挡
            const visible = this._isSatToSatVisible(eci1.position, eci2.position);

            if (visible && !isVisible) {
                // 从不可见到可见，记录窗口开始
                isVisible = true;
                windowStart = current.valueOf();
            } else if (!visible && isVisible) {
                // 从可见到不可见，记录窗口结束
                isVisible = false;
                windows.push([windowStart, current.valueOf()]);
                windowStart = null;
            }

            // 自适应步长（可选：当接近可见/不可见边界时减小步长）
            const nextStep = this._adaptiveStep(eci1, eci2, visible, stepSeconds);
            current.add(nextStep, 'seconds');
        }

        // 如果在时间结束时仍可见，关闭窗口
        if (isVisible && windowStart) {
            windows.push([windowStart, end.valueOf()]);
        }

        return windows;
    },
    getOrbitalPeriodByTle(tle) {
        const tles = tle.split('\n');
        if (tles.length < 2 || tles.length > 3){
            throw new Error('Invalid TLE format: expected 2 or 3 lines');
        }
        const satrec1 = satellite.twoline2satrec(tles[tles.length - 2], tles[tles.length - 1]);
        const a = satrec1.a *  earthRadius; // 转换为米
        return  2 * Math.PI * Math.sqrt(Math.pow(a, 3) / mu); // 单位：秒
    },
    /**
     * 根据坐标  获取轨道周期
     * @param cartesian3 {[number,number,number]}
     * @returns {number}
     */
    getOrbitalPeriodByCartesian3(cartesian3=[0,0,0]){
        const [x, y, z] = cartesian3;
        const r = Math.sqrt(x * x + y * y + z * z); // 当前位置到地心距离 (m)
        return  2 * Math.PI * Math.sqrt(Math.pow(r, 3) / mu); // 秒
    },
    /**
     * 检查两颗卫星之间是否被地球遮挡。
     * @param {{x: number, y: number, z: number}} pos1 - 第一颗卫星的 ECI 位置 (千米)。
     * @param {{x: number, y: number, z: number}} pos2 - 第二颗卫星的 ECI 位置 (千米)。
     * @returns {boolean} 如果视线未被地球遮挡，返回 true。
     */
    _isSatToSatVisible: function (pos1, pos2) {
        // 计算两卫星之间的向量
        const vec = this._vecSub(pos2, pos1);
        const dist = this._magnitude(vec);

        // 如果距离为 0（理论上不可能），返回 false
        if (dist === 0) {
            return false;
        }

        // 参数化直线：P(t) = pos1 + t * (pos2 - pos1), t ∈ [0, 1]
        // 判断直线与地球球体（中心在原点，半径 xkmper）的交点
        const a = vec.x * vec.x + vec.y * vec.y + vec.z * vec.z;
        const b = 2 * (pos1.x * vec.x + pos1.y * vec.y + pos1.z * vec.z);
        const c = pos1.x * pos1.x + pos1.y * pos1.y + pos1.z * pos1.z - xkmper * xkmper;

        // 求解二次方程：a*t^2 + b*t + c = 0
        const discriminant = b * b - 4 * a * c;
        if (discriminant < 0) {
            // 无实数解，直线不与地球相交
            return true;
        }

        // 计算交点
        const t1 = (-b + Math.sqrt(discriminant)) / (2 * a);
        const t2 = (-b - Math.sqrt(discriminant)) / (2 * a);

        // 如果交点在 t ∈ [0, 1] 之外，则无遮挡
        return t1 < 0 || t1 > 1 || t2 < 0 || t2 > 1;
    },

    /**
     * 计算自适应步长以优化性能。
     * @param {Object} eci1 - 第一颗卫星的 ECI 数据。
     * @param {Object} eci2 - 第二颗卫星的 ECI 数据。
     * @param {boolean} isVisible - 当前是否可见。
     * @param {number} defaultStep - 默认步长（秒）。
     * @returns {number} 下一时间步长（秒）。
     */
    _adaptiveStep: function (eci1, eci2, isVisible, defaultStep) {
        // 简单实现：当接近边界（可见/不可见切换）时减小步长
        const dist = this._magnitude(this._vecSub(eci2.position, eci1.position));
        const relSpeed = this._magnitude(this._vecSub(eci2.velocity, eci1.velocity));
        if (relSpeed === 0) {
            return defaultStep;
        }
        // 假设边界变化与相对速度和距离相关
        const minStep = 1; // 最小步长 1 秒
        const adaptiveStep = Math.max(minStep, Math.min(defaultStep, 1000 * dist / relSpeed));
        return isVisible ? defaultStep : Math.min(defaultStep, adaptiveStep / 2);
    },
    _observe: function (satrec, observerLocation, start) {
        start = moment(start);
        const eci = this._eci(satrec, start);
        const gmst = this._gmst(start);
        if (!eci.position) {
            return null;
        }
        const geo = satellite.eciToGeodetic(eci.position, gmst);

        const solar_vector = this._calculateSolarPosition(start.valueOf());
        const eclipse = this._satEclipsed(eci.position, solar_vector);

        const track = {
            eci: eci,
            gmst: gmst,
            latitude: geo.latitude / deg2rad,
            longitude: this._boundLongitude(geo.longitude / deg2rad),
            altitude: geo.height,
            footprint: 12756.33 * Math.acos(xkmper / (xkmper + geo.height)),
            sunlit: !eclipse.eclipsed,
            eclipseDepth: eclipse.depth / deg2rad
        }

        // If we have a groundstation let's get those additional observe parameters
        if (observerLocation && observerLocation.length == 3) {
            const observerGd = {
                longitude: observerLocation[1] * deg2rad,
                latitude: observerLocation[0] * deg2rad,
                height: observerLocation[2]
            }

            const positionEcf = satellite.eciToEcf(eci.position, gmst),
                velocityEcf = satellite.eciToEcf(eci.velocity, gmst),
                observerEcf = satellite.geodeticToEcf(observerGd),
                lookAngles = satellite.ecfToLookAngles(observerGd, positionEcf),
                doppler = satellite.dopplerFactor(observerEcf, positionEcf, velocityEcf);

            track.azimuth = lookAngles.azimuth / deg2rad;
            track.elevation = lookAngles.elevation / deg2rad;
            track.rangeSat = lookAngles.rangeSat;
            track.doppler = doppler;
        }

        return track
    },

    _quickPredict: function (satrec, observerLocation, start, end) {
        if (this._isGeo(satrec)) {
            return null
        }
        let transit = {};
        let lastel = 0;
        let iterations = 0;

        if (this._badSat(satrec, observerLocation, start)) {
            return null;
        }

        let daynum = this._findAOS(satrec, observerLocation, start);
        if (!daynum) {
            return null;
        }
        transit.start = daynum;

        let observed = this._observe(satrec, observerLocation, daynum);
        if (!observed) {
            return null;
        }

        let iel = Math.round(observed.elevation);

        let maxEl = 0, apexAz = 0, minAz = 360, maxAz = 0;

        while (iel >= 0 && iterations < max_iterations && (!end || daynum < end)) {
            lastel = iel;
            daynum = daynum + ms2day * Math.cos((observed.elevation - 1.0) * deg2rad) * Math.sqrt(observed.altitude) / 25000.0;
            observed = this._observe(satrec, observerLocation, daynum);
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
        if (lastel !== 0) {
            daynum = this._findLOS(satrec, observerLocation, daynum);
        }

        transit.end = daynum;
        transit.maxElevation = maxEl;
        transit.apexAzimuth = apexAz;
        transit.maxAzimuth = maxAz;
        transit.minAzimuth = minAz;
        transit.duration = transit.end - transit.start;

        return transit
    },
    _isGeo(satrec) {
        const revPerDay = satrec.no * 24 * 60 / (2 * Math.PI);
        return Math.abs(revPerDay - 1.0027) < 0.005;
    },
    _badSat: function (satrec, observerLocation, start) {
        if (observerLocation && !this._aosHappens(satrec, observerLocation)) {
            return true
        } else if (start && this._decayed(satrec, start)) {
            return true
        } else {
            return false
        }
    },

    _aosHappens: function (satrec, observerLocation) {
        let lin, sma, apogee;
        let meanmo = satrec.no * 24 * 60 / (2 * Math.PI); // convert rad/min to rev/day
        if (meanmo === 0) {
            return false
        } else {
            lin = satrec.inclo / deg2rad;

            if (lin >= 90.0) {
                lin = 180.0 - lin;
            }

            sma = 331.25 * Math.exp(Math.log(1440.0 / meanmo) * (2.0 / 3.0));
            apogee = sma * (1.0 + satrec.ecco) - xkmper;

            if ((Math.acos(xkmper / (apogee + xkmper)) + (lin * deg2rad)) > Math.abs(observerLocation[0] * deg2rad)) {
                return true
            } else {
                return false
            }
        }
    },

    _decayed: function (satrec, start) {
        start = moment(start);

        const satepoch = moment.utc(satrec.epochyr, "YY").add(satrec.epochdays, 'days').valueOf();

        let meanmo = satrec.no * 24 * 60 / (2 * Math.PI); // convert rad/min to rev/day
        const drag = satrec.ndot * 24 * 60 * 24 * 60 / (2 * Math.PI); // convert rev/day^2

        if (satepoch + ms2day * ((16.666666 - meanmo) / (10.0 * Math.abs(drag))) < start) {
            return true
        } else {
            return false
        }
    },

    _findAOS: function (satrec, observerLocation, start) {
        let current = start;
        let observed = this._observe(satrec, observerLocation, current);
        if (!observed) {
            return null;
        }
        let aostime = 0;
        let iterations = 0;

        if (observed.elevation > 0) {
            return current
        }
        while (observed.elevation < -1 && iterations < max_iterations) {
            current = current - ms2day * 0.00035 * (observed.elevation * ((observed.altitude / 8400.0) + 0.46) - 2.0);
            observed = this._observe(satrec, observerLocation, current);
            if (!observed) {
                break;
            }
            iterations += 1;
        }
        iterations = 0;
        while (aostime === 0 && iterations < max_iterations) {
            if (!observed) {
                break;
            }
            if (Math.abs(observed.elevation) < 0.50) { // this was 0.03 but switched to 0.50 for performance
                aostime = current;
            } else {
                current = current - ms2day * observed.elevation * Math.sqrt(observed.altitude) / 530000.0;
                observed = this._observe(satrec, observerLocation, current);
            }
            iterations += 1;
        }
        if (aostime === 0) {
            return null;
        }
        return aostime
    },

    _findLOS: function (satrec, observerLocation, start) {
        let current = start;
        let observed = this._observe(satrec, observerLocation, current);
        let lostime = 0;
        let iterations = 0;

        while (lostime === 0 && iterations < max_iterations) {
            if (Math.abs(observed.elevation) < 0.50) { // this was 0.03 but switched to 0.50 for performance
                lostime = current;
            } else {
                current = current + ms2day * observed.elevation * Math.sqrt(observed.altitude) / 502500.0;
                observed = this._observe(satrec, observerLocation, current);
                if (!observed) {
                    break;
                }
            }
            iterations += 1;
        }
        return lostime
    },

    _eci: function (satrec, date) {
        date = new Date(date.valueOf());
        return satellite.propagate(
            satrec,
            date.getUTCFullYear(),
            date.getUTCMonth() + 1, // months range 1-12
            date.getUTCDate(),
            date.getUTCHours(),
            date.getUTCMinutes(),
            date.getUTCSeconds()
        );
    },

    _gmst: function (date) {
        date = new Date(date.valueOf());
        return satellite.gstime(
            date.getUTCFullYear(),
            date.getUTCMonth() + 1, // months range 1-12
            date.getUTCDate(),
            date.getUTCHours(),
            date.getUTCMinutes(),
            date.getUTCSeconds()
        );
    },

    _boundLongitude: function (longitude) {
        while (longitude < -180) {
            longitude += 360;
        }
        while (longitude > 180) {
            longitude -= 360;
        }
        return longitude
    },

    _satEclipsed: function (pos, sol) {
        const sd_earth = Math.asin(xkmper / this._magnitude(pos));
        const rho = this._vecSub(sol, pos);
        const sd_sun = Math.asin(solar_radius / rho.w);
        const earth = this._scalarMultiply(-1, pos);
        const delta = this._angle(sol, earth);
        const eclipseDepth = sd_earth - sd_sun - delta;
        let eclipse = false;
        if (sd_earth < sd_sun) {
            eclipse = false;
        } else if (eclipseDepth >= 0) {
            eclipse = true;
        } else {
            eclipse = false;
        }
        return {
            depth: eclipseDepth,
            eclipsed: eclipse
        }
    },

    _calculateSolarPosition: function (start) {
        const time = start / ms2day + 2444238.5; // jul_utc
        const mjd = time - 2415020.0;
        const year = 1900 + mjd / 365.25;
        const T = (mjd + this._deltaET(year) / (ms2day / 1000)) / 36525.0;
        const M = deg2rad * ((358.47583 + ((35999.04975 * T) % 360) - (0.000150 + 0.0000033 * T) * Math.pow(T, 2)) % 360);
        const L = deg2rad * ((279.69668 + ((36000.76892 * T) % 360) + 0.0003025 * Math.pow(T, 2)) % 360);
        const e = 0.01675104 - (0.0000418 + 0.000000126 * T) * T;
        const C = deg2rad * ((1.919460 - (0.004789 + 0.000100 * T) * T) * Math.sin(M) + (0.020094 - 0.000100 * T) * Math.sin(2 * M) + 0.000293 * Math.sin(3 * M));
        const O = deg2rad * ((259.18 - 1934.142 * T) % 360.0);
        const Lsa = (L + C - deg2rad * (0.00569 - 0.00479 * Math.sin(O))) % (2 * Math.PI);
        const nu = (M + C) % (2 * Math.PI);
        let R = 1.0000002 * (1 - Math.pow(e, 2)) / (1 + e * Math.cos(nu));
        const eps = deg2rad * (23.452294 - (0.0130125 + (0.00000164 - 0.000000503 * T) * T) * T + 0.00256 * Math.cos(O));
        R = astro_unit * R;
        return {
            x: R * Math.cos(Lsa),
            y: R * Math.sin(Lsa) * Math.cos(eps),
            z: R * Math.sin(Lsa) * Math.sin(eps),
            w: R
        }
    },

    _deltaET: function (year) {
        return 26.465 + 0.747622 * (year - 1950) + 1.886913 * Math.sin((2 * Math.PI) * (year - 1975) / 33)
    },

    _vecSub: function (v1, v2) {
        const vec = {
            x: v1.x - v2.x,
            y: v1.y - v2.y,
            z: v1.z - v2.z
        }
        vec.w = this._magnitude(vec);
        return vec
    },

    _scalarMultiply: function (k, v) {
        return {
            x: k * v.x,
            y: k * v.y,
            z: k * v.z,
            w: v.w ? Math.abs(k) * v.w : undefined
        }
    },

    _magnitude: function (v) {
        return Math.sqrt(Math.pow(v.x, 2) + Math.pow(v.y, 2) + Math.pow(v.z, 2))
    },

    _angle: function (v1, v2) {
        const dot = (v1.x * v2.x + v1.y * v2.y + v1.z * v2.z);
        return Math.acos(dot / (this._magnitude(v1) * this._magnitude(v2)))
    }
}

module.exports = _jspredict_dc;
module.exports.default = _jspredict_dc;
