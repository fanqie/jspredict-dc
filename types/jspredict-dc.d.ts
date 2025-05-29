declare module 'jspredict-dc' {
    /**
     * 地面观测站位置 (Ground Station Location).
     * 数组格式: [纬度 (度), 经度 (度), 海拔 (千米)].
     * Array format: [latitude (degrees), longitude (degrees), altitude (km)].
     */
    export type ObserverLocation = [number, number, number];

    /**
     * 卫星可见过境信息 (Satellite Visible Transit Information).
     */
    export interface Transit {
      /**
       * 过境开始时间 (毫秒 Unix 时间戳) (Transit start time in milliseconds Unix timestamp).
       */
      start: number;
      /**
       * 过境结束时间 (毫秒 Unix 时间戳) (Transit end time in milliseconds Unix timestamp).
       */
      end: number;
      /**
       * 过境期间的最大仰角 (度) (Maximum elevation during the transit in degrees).
       */
      maxElevation: number;
      /**
       * 达到最大仰角时的方位角 (度) (Azimuth at the time of maximum elevation in degrees).
       */
      apexAzimuth: number;
      /**
       * 过境期间的最大方位角 (度) (Maximum azimuth during the transit in degrees).
       */
      maxAzimuth: number;
      /**
       * 过境期间的最小方位角 (度) (Minimum azimuth during the transit in degrees).
       */
      minAzimuth: number;
      /**
       * 过境持续时间 (毫秒) (Transit duration in milliseconds).
       */
      duration: number;
    }

    /**
     * 地心惯性坐标系 (Earth-Centered Inertial - ECI).
     * 描述物体相对于地球中心的惯性坐标。
     * Describes an object's position and velocity relative to the Earth's center in an inertial frame.
     */
    export interface Eci {
        /**
         * 卫星在 ECI 坐标系中的位置 (千米) (Satellite's position in ECI coordinates (km)).
         */
        position :{x:number,y:number,z:number}
        /**
         * 卫星在 ECI 坐标系中的速度 (千米/秒) (Satellite's velocity in ECI coordinates (km/s)).
         */
        velocity :{x:number,y:number,z:number}
    }
    /**
     * 卫星观测结果 (Satellite Observation Result).
     * 包含卫星的各种计算属性，可选地包含从地面观测点看到的数据。
     * Contains various calculated properties of the satellite, optionally including data from a ground observer.
     */
    export interface ObserveResult {
      /**
       * 卫星在 ECI 坐标系中的位置和速度 (Satellite's position and velocity in ECI coordinates).
       */
      eci: Eci;
      /**
       * 格林威治平均恒星时 (弧度) (Greenwich Mean Sidereal Time in radians).
       */
      gmst: number;
      /**
       * 卫星在地心大地坐标系中的纬度 (度) (Satellite's latitude in Geodetic coordinates (degrees)).
       */
      latitude: number;
      /**
       * 卫星在地心大地坐标系中的经度 (度) (Satellite's longitude in Geodetic coordinates (degrees)).
       */
      longitude: number;
      /**
       * 卫星在地心大地坐标系中的海拔高度 (千米) (Satellite's altitude in Geodetic coordinates (km)).
       */
      altitude: number;
      /**
       * 卫星对地面可见的区域直径 (千米) (Diameter of the area on the ground visible from the satellite (km)).
       */
      footprint: number;
      /**
       * 卫星是否被太阳照亮 (是否处于日照区) (Whether the satellite is illuminated by the sun).
       */
      sunlit: boolean;
      /**
       * 卫星处于地球阴影中的深度 (弧度) (Depth of the satellite within the Earth's shadow (radians)).
       */
      eclipseDepth: number;
      /**
       * 从地面观测点到卫星的方位角 (度). 仅在提供 observerLocation 时计算. (Azimuth from the ground observer to the satellite (degrees). Calculated only if observerLocation is provided).
       */
      azimuth?: number;
      /**
       * 从地面观测点到卫星的仰角 (度). 仅在提供 observerLocation 时计算. (Elevation from the ground observer to the satellite (degrees). Calculated only if observerLocation is provided).
       */
      elevation?: number;
      /**
       * 从地面观测点到卫星的直线距离 (千米). 仅在提供 observerLocation 时计算. (Slant range from the ground observer to the satellite (km). Calculated only if observerLocation is provided).
       */
      rangeSat?: number;
      /**
       * 从地面观测点观察到的卫星的多普勒因子. 仅在提供 observerLocation 时计算. (Doppler factor of the satellite as observed from the ground observer. Calculated only if observerLocation is provided).
       */
      doppler?: number;
    }

    /**
     * JSpredict-DC 库的核心接口 (Core interface for the JSpredict-DC library).
     */
    export interface JSPredictDC {
      /**
       * 开启或关闭观察时间间隔信息的控制台输出 (Enables or disables console output for observation intervals).
       * @param open - 是否开启 (true) 或关闭 (false) (Whether to open (true) or close (false)).
       */
      printIntervalInfo(open: boolean): void;
      /**
       * 设置最大迭代次数 (Sets the maximum number of iterations for certain calculations).
       * @param max - 最大迭代次数 (Maximum number of iterations).
       */
      setMax(max: number): void;
      /**
       * 计算卫星在特定时间的位置和观测数据 (Calculates the satellite's position and observation data at a specific time).
       * @param tle - 卫星的两行轨道数据 (Satellite Two-Line Element set).
       * @param observerLocation - 可选: 地面观测站位置 [纬度, 经度, 海拔] (千米) (Optional: Ground station location [latitude, longitude, altitude] (km)).
       * @param start - 可选: 观测时间 (毫秒时间戳 或 Date 对象) (Optional: Observation time (milliseconds timestamp or Date object)).
       * @returns 卫星观测结果或 null (Satellite observation result or null).
       */
      getPositionByTime(
        tle: string,
        observerLocation?: ObserverLocation,
        start?: number | Date
      ): ObserveResult | null;
      /**
       * 计算卫星在时间范围内的多个时刻的观测数据 (Calculates satellite observation data for multiple points over a time range).
       * @param tle - 卫星的两行轨道数据 (Satellite Two-Line Element set).
       * @param observerLocation - 地面观测站位置 [纬度, 经度, 海拔] (千米) (Ground station location [latitude, longitude, altitude] (km)).
       * @param start - 开始时间 (毫秒时间戳 或 Date 对象) (Start time (milliseconds timestamp or Date object)).
       * @param end - 结束时间 (毫秒时间戳 或 Date 对象) (End time for search (milliseconds timestamp or Date object)).
       * @param interval - 可选: 时间间隔 (moment.js interval object) (Optional: Time interval (moment.js interval object)).
       * @returns 卫星观测结果数组 (Array of satellite observation results).
       */
      getEphemeris(
        tle: string,
        observerLocation: ObserverLocation,
        start: number | Date,
        end: number | Date,
        interval?: any
      ): ObserveResult[];
      /**
       * 查找卫星在地面观测站的可见过境 (Finds visible satellite transits over a ground station).
       * @param tle - 卫星的两行轨道数据 (Satellite Two-Line Element set).
       * @param observerLocation - 地面观测站位置 [纬度, 经度, 海拔] (千米) (Ground station location [latitude, longitude, altitude] (km)).
       * @param start - 开始搜索时间 (毫秒时间戳 或 Date 对象) (Start time for search (milliseconds timestamp or Date object)).
       * @param end - 结束搜索时间 (毫秒时间戳 或 Date 对象) (End time for search (milliseconds timestamp or Date object)).
       * @param minElevation - 可选: 最小可见仰角 (度), 默认为 4 度 (Optional: Minimum visible elevation (degrees), defaults to 4 degrees).
       * @param maxTransits - 可选: 返回的最大过境数 (Optional: Maximum number of transits to return).
       * @returns {Transit[]} 可见过境信息数组 (Array of visible transit information).
       */
      transits(
        tle: string,
        observerLocation: ObserverLocation,
        start: number | Date,
        end: number | Date,
        minElevation?: number,
        maxTransits?: number
      ): Transit[];
      /**
       * 计算卫星在特定时间段的过境信息 (Calculates transit information for a specific time segment).
       * @param tle - 卫星的两行轨道数据 (Satellite Two-Line Element set).
       * @param observerLocation - 地面观测站位置 [纬度, 经度, 海拔] (千米) (Ground station location [latitude, longitude, altitude] (km)).
       * @param start - 时间段开始时间 (毫秒时间戳 或 Date 对象) (Start time of the segment (milliseconds timestamp or Date object)).
       * @param end - 时间段结束时间 (毫秒时间戳 或 Date 对象) (End time of the segment (milliseconds timestamp or Date object)).
       * @returns {Transit | null} 过境信息或 null (Transit information or null).
       */
      transitSegment(
        tle: string,
        observerLocation: ObserverLocation,
        start: number | Date,
        end: number | Date
      ): Transit | null;
    }
    declare const jspredict_dc: JSPredictDC;
    export default jspredict_dc;
  }
