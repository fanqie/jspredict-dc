// 这些常量用于统一角度、距离和时间换算，保持与底层轨道库一致的单位体系。
const deg2rad = Math.PI / 180;
const rad2deg = 180 / Math.PI;

module.exports = {
  deg2rad,
  rad2deg,
  earthRadiusKm: 6378.137,
  earthDiameterKm: 12756.274,
  solarRadiusKm: 696000,
  astronomicalUnitKm: 149597870.7,
  muKm3PerS2: 398600.5,
  msPerDay: 24 * 60 * 60 * 1000,
  defaultMinElevation: 4,
  defaultStepSeconds: 60,
  defaultMaxIterations: 99999,
};
