/**
 * Weather Forecast Stub — Static ET₀ values for New Valley Governorate.
 *
 * This is a stub implementation returning sensible defaults based on the
 * current month. Replace with a real weather API integration (e.g.,
 * Open-Meteo, Tomorrow.io) when available.
 *
 * New Valley ET₀ reference values:
 * - Winter (Dec–Feb): 3–5 mm/day, max temp 18–25°C
 * - Spring (Mar–May): 5–8 mm/day, max temp 25–38°C
 * - Summer (Jun–Aug): 8–12 mm/day, max temp 38–46°C
 * - Autumn (Sep–Nov): 5–8 mm/day, max temp 28–38°C
 *
 * @module server/services/irrigation/weather
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WeatherDay {
  readonly maxTemp: number;
  readonly et0: number;
  readonly rain: number;
}

export interface WeatherForecast {
  readonly daily: readonly WeatherDay[];
}

// ---------------------------------------------------------------------------
// Seasonal defaults calibrated for New Valley, Egypt
// ---------------------------------------------------------------------------

interface SeasonalDefaults {
  readonly maxTemp: number;
  readonly et0: number;
}

/** Month index (0-11) → seasonal weather defaults. */
function getSeasonalDefaults(month: number): SeasonalDefaults {
  // Winter: Dec(11), Jan(0), Feb(1)
  if (month <= 1 || month === 11) {
    return { maxTemp: 22, et0: 4.0 };
  }
  // Spring: Mar(2), Apr(3), May(4)
  if (month <= 4) {
    return { maxTemp: 32, et0: 6.5 };
  }
  // Summer: Jun(5), Jul(6), Aug(7)
  if (month <= 7) {
    return { maxTemp: 42, et0: 10.0 };
  }
  // Autumn: Sep(8), Oct(9), Nov(10)
  return { maxTemp: 33, et0: 6.5 };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get a 3-day weather forecast for an area.
 *
 * Currently returns static values based on the current month.
 * The `_districtId` parameter is accepted for API compatibility
 * with a future real weather provider.
 *
 * @param _districtId - District UUID (unused in stub, reserved for future API)
 * @returns 3-day weather forecast with ET₀ and max temperature
 */
export function getWeatherForecast(_districtId: string): WeatherForecast {
  const currentMonth = new Date().getMonth();
  const defaults = getSeasonalDefaults(currentMonth);

  // Return identical values for all 3 days (stub)
  // Rainfall is always 0 in New Valley — hyper-arid desert
  const day: WeatherDay = {
    maxTemp: defaults.maxTemp,
    et0: defaults.et0,
    rain: 0,
  };

  return { daily: [day, day, day] };
}
