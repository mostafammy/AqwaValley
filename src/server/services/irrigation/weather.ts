import { weatherService } from "../weatherService";

/**
 * Weather Forecast — Real-time data from Open-Meteo.
 *
 * This implementation fetches real weather data including ET₀
 * (Evapotranspiration) using the FAO-56 standard.
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
// Public API
// ---------------------------------------------------------------------------

/**
 * Get a 3-day weather forecast for an area.
 *
 * Fetches real-time data from Open-Meteo and maps it to our internal schema.
 *
 * @param lat - Latitude
 * @param lon - Longitude
 * @returns 3-day weather forecast with ET₀ and max temperature
 */
export async function getWeatherForecast(
  lat: number,
  lon: number,
): Promise<WeatherForecast> {
  try {
    const dailyForecast = await weatherService.getForecastWithEt0(lat, lon, 3);

    return {
      daily: dailyForecast.map((f) => ({
        maxTemp: Math.round(f.maxTemp),
        et0: parseFloat(f.et0.toFixed(2)),
        rain: parseFloat(f.rain.toFixed(1)),
      })),
    };
  } catch (error) {
    console.error("weather.getWeatherForecast.fallback_on_error:", error);
    // Return sensible desert defaults on total failure
    const day: WeatherDay = {
      maxTemp: 35,
      et0: 7.5,
      rain: 0,
    };
    return { daily: [day, day, day] };
  }
}
