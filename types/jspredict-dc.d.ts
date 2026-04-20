declare module 'jspredict-dc' {
  /** 观察者位置，按 [纬度, 经度, 海拔公里] 顺序传入。 */
  export type ObserverLocation = [number, number, number];
  /** 支持对象式写法的观察者位置。 */
  export interface ObserverLocationObject {
    /** 纬度，单位为度。 */
    latitude: number;
    /** 经度，单位为度。 */
    longitude: number;
    /** 海拔高度，单位为公里。 */
    altitude: number;
  }
  /** 观察者位置的数组写法或对象写法。 */
  export type ObserverLocationInput = ObserverLocation | ObserverLocationObject;

  /** 单次过境窗口，包含起止时间、峰值仰角和方位角范围。 */
  export interface Transit {
    /** 过境开始时间戳，单位为毫秒。 */
    start: number;
    /** 过境结束时间戳，单位为毫秒。 */
    end: number;
    /** 峰值仰角，单位为度。 */
    maxElevation: number;
    /** 峰值仰角出现时的方位角，单位为度。 */
    apexAzimuth: number;
    /** 过境过程中的最大方位角，单位为度。 */
    maxAzimuth: number;
    /** 过境过程中的最小方位角，单位为度。 */
    minAzimuth: number;
    /** 过境持续时长，单位为毫秒。 */
    duration: number;
  }

  /** 传播后的惯性系位置和速度。 */
  export interface Eci {
    /** 位置向量，单位为公里。 */
    position: { x: number; y: number; z: number };
    /** 速度向量，单位为公里/秒。 */
    velocity: { x: number; y: number; z: number };
  }

  /** 单时刻观测结果，包含地理位置、日照状态和可选的地面观测量。 */
  export interface ObserveResult {
    eci: Eci;
    /** 格林尼治平恒星时。 */
    gmst: number;
    /** 纬度，单位为度。 */
    latitude: number;
    /** 经度，单位为度。 */
    longitude: number;
    /** 海拔高度，单位为公里。 */
    altitude: number;
    /** 可见覆盖范围直径，单位为公里。 */
    footprint: number;
    /** 是否处于日照状态。 */
    sunlit: boolean;
    /** 处于地影时的阴影深度。 */
    eclipseDepth: number;
    /** 观测者坐标存在时的方位角，单位为度。 */
    azimuth?: number;
    /** 观测者坐标存在时的仰角，单位为度。 */
    elevation?: number;
    /** 观测者坐标存在时的斜距，单位为公里。 */
    rangeSat?: number;
    /** 观测者坐标存在时的多普勒因子。 */
    doppler?: number;
  }

  /** OMM / JSON GP 的标准字段集合。 */
  export interface OmmRecord {
    OBJECT_NAME?: string;
    OBJECT_ID?: string;
    CENTER_NAME?: string;
    REF_FRAME?: string;
    TIME_SYSTEM?: string;
    MEAN_MOTION?: string | number;
    ECCENTRICITY?: string | number;
    INCLINATION?: string | number;
    RA_OF_ASC_NODE?: string | number;
    ARG_OF_PERICENTER?: string | number;
    MEAN_ANOMALY?: string | number;
    EPHEMERIS_TYPE?: string | number;
    CLASSIFICATION_TYPE?: string;
    NORAD_CAT_ID?: string | number;
    ELEMENT_SET_NO?: string | number;
    REV_AT_EPOCH?: string | number;
    BSTAR?: string | number;
    MEAN_MOTION_DOT?: string | number;
    MEAN_MOTION_DDOT?: string | number;
    EPOCH?: string | Date;
    [key: string]: unknown;
  }

  /** TLE 的两行文本结构。 */
  export interface TleSource {
    line1: string;
    line2: string;
  }

  /** 归一化后的轨道源结构。 */
  export interface OrbitSource {
    kind: 'tle' | 'omm' | 'satrec';
    tle?: TleSource;
    omm?: OmmRecord;
    satrec?: unknown;
    source?: string;
  }

  /** 可传入库中的轨道源总输入。 */
  export type OrbitSourceInput = string | TleSource | OmmRecord | OrbitSource | unknown;

  /** jspredict-dc 对外暴露的完整 API。 */
  export interface JSPredictDC {
    /** 开关式调试日志输出。 */
    printIntervalInfo(open: boolean): boolean;
    /** 兼容旧名的调试开关。 */
    setDebugIntervalLogging(open: boolean): boolean;
    /** 设置最大迭代次数。 */
    setMax(max?: number): number;
    /** 兼容旧名的最大迭代次数设置。 */
    setIterationLimit(max?: number): number;

    /** 将任意轨道源归一化成内部标准结构。 */
    normalizeOrbitSource(source: OrbitSourceInput): OrbitSource;
    /** 从 TLE 文本构建轨道源。 */
    fromTle(line1OrText: string, line2?: string): OrbitSource;
    /** 从 JSON GP 记录构建轨道源。 */
    fromJsonGp(record: OmmRecord): OrbitSource;
    /** 从 OMM XML 构建轨道源。 */
    fromOmmXml(xml: string): OrbitSource;

    /** 计算给定时刻的观测结果。 */
    observeAt(source: OrbitSourceInput, observerLocation?: ObserverLocationInput, start?: number | Date | string): ObserveResult | null;
    /** 兼容旧名的单时刻观测接口。 */
    getPositionByTime(source: OrbitSourceInput, observerLocation?: ObserverLocationInput, start?: number | Date | string): ObserveResult | null;

    /** 在时间段内按固定步长采样星历。 */
    ephemeris(source: OrbitSourceInput, observerLocation: ObserverLocationInput, start: number | Date | string, end: number | Date | string, interval?: number | string | { [unit: string]: number }): ObserveResult[];
    /** 兼容旧名的星历采样接口。 */
    getEphemeris(source: OrbitSourceInput, observerLocation: ObserverLocationInput, start: number | Date | string, end: number | Date | string, interval?: number | string | { [unit: string]: number }): ObserveResult[];

    /** 搜索过境窗口。 */
    findTransits(source: OrbitSourceInput, observerLocation: ObserverLocationInput, start: number | Date | string, end: number | Date | string, minElevation?: number, maxTransits?: number): Transit[];
    /** 兼容旧名的过境搜索接口。 */
    transits(source: OrbitSourceInput, observerLocation: ObserverLocationInput, start: number | Date | string, end: number | Date | string, minElevation?: number, maxTransits?: number): Transit[];

    /** 返回单个过境窗口。 */
    transitSegment(source: OrbitSourceInput, observerLocation: ObserverLocationInput, start: number | Date | string, end: number | Date | string): Transit | null;
    /** 兼容旧名的单窗口过境搜索。 */
    getTransitSegment(source: OrbitSourceInput, observerLocation: ObserverLocationInput, start: number | Date | string, end: number | Date | string): Transit | null;

    /** 返回观测者可见窗口的起止时间数组。 */
    visibilityWindows(source: OrbitSourceInput, observerLocation: ObserverLocationInput, start: number | Date | string, end: number | Date | string): number[][];
    /** 兼容旧名的可见窗口接口。 */
    getVisibilityWindows(source: OrbitSourceInput, observerLocation: ObserverLocationInput, start: number | Date | string, end: number | Date | string): number[][];

    /** 计算两颗卫星之间的可见窗口。 */
    satelliteVisibilityWindows(source1: OrbitSourceInput, source2: OrbitSourceInput, start: number | Date | string, end: number | Date | string, stepSeconds?: number): number[][];
    /** 兼容旧名的卫星互见窗口接口。 */
    getSatelliteVisibilityWindows(source1: OrbitSourceInput, source2: OrbitSourceInput, start: number | Date | string, end: number | Date | string, stepSeconds?: number): number[][];

    /** 根据轨道源估算轨道周期。 */
    orbitalPeriodFromOrbitSource(source: OrbitSourceInput): number;
    /** 兼容旧名的轨道周期接口。 */
    orbitalPeriodFromTle(source: OrbitSourceInput): number;
    /** 兼容旧名的轨道周期接口。 */
    getOrbitalPeriodByTle(source: OrbitSourceInput): number;

    /** 根据笛卡尔坐标估算轨道周期。 */
    orbitalPeriodFromCartesian3(cartesian3?: [number, number, number]): number;
    /** 兼容旧名的笛卡尔周期接口。 */
    getOrbitalPeriodByCartesian3(cartesian3?: [number, number, number]): number;
  }

  const jspredict_dc: JSPredictDC;
  export default jspredict_dc;
}
