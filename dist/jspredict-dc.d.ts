declare module 'jspredict-dc' {
    export type WGS84Positions = [number, number, number];
  
    export interface Transit {
      start: number;
      end: number;
      maxElevation: number;
      apexAzimuth: number;
      maxAzimuth: number;
      minAzimuth: number;
      duration: number;
    }
  
    export interface ObserveResult {
      eci: any;
      gmst: number;
      latitude: number;
      longitude: number;
      altitude: number;
      footprint: number;
      sunlit: boolean;
      eclipseDepth: number;
      azimuth?: number;
      elevation?: number;
      rangeSat?: number;
      doppler?: number;
    }
  
    export interface JSPredictDC {
      printIntervalInfo(open: boolean): void;
      setMax(max: number): void;
      observe(
        tle: string,
        qth?: WGS84Positions,
        start?: number | Date
      ): ObserveResult | null;
      observes(
        tle: string,
        qth: WGS84Positions,
        start: number | Date,
        end: number | Date,
        interval?: any
      ): ObserveResult[];
      transits(
        tle: string,
        qth: WGS84Positions,
        start: number | Date,
        end: number | Date,
        minElevation?: number,
        maxTransits?: number
      ): Transit[];
      transitSegment(
        tle: string,
        qth: WGS84Positions,
        start: number | Date,
        end: number | Date
      ): Transit | null;
    }
    declare const jspredict_dc: JSPredictDC;
    export default jspredict_dc;
  }
