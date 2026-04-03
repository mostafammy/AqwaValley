import { env } from "~/env";

export type WeatherInfo = {
  temp: number;
  description: string;
  icon: string;
  humidity: number;
  city?: string;
};

export type ForecastDay = {
  date: string;
  maxTemp: number;
  minTemp: number;
  et0: number;
  rain: number;
};

// Simple in-memory cache to stay within OpenWeather and Open-Meteo free limits
type OpenWeatherPayload = {
  main: {
    temp: number;
    humidity?: number;
  };
  weather: Array<{
    description?: string;
    icon?: string;
  }>;
  name?: string;
};

function isNumberArray(value: unknown): value is number[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "number")
  );
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}

function isOpenWeatherPayload(value: unknown): value is OpenWeatherPayload {
  if (!value || typeof value !== "object") return false;
  const candidate = value as {
    main?: { temp?: unknown; humidity?: unknown };
    weather?: unknown;
    name?: unknown;
  };

  const weather0: unknown =
    Array.isArray(candidate.weather) && candidate.weather.length > 0
      ? candidate.weather[0]
      : null;

  return (
    typeof candidate.main === "object" &&
    candidate.main !== null &&
    typeof candidate.main.temp === "number" &&
    (candidate.main.humidity === undefined ||
      typeof candidate.main.humidity === "number") &&
    Array.isArray(candidate.weather) &&
    weather0 !== null &&
    typeof weather0 === "object" &&
    typeof (weather0 as { description?: unknown }).description === "string" &&
    typeof (weather0 as { icon?: unknown }).icon === "string" &&
    (candidate.name === undefined || typeof candidate.name === "string")
  );
}

// Simple in-memory cache to stay within OpenWeather free limits
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
const weatherCache = new Map<string, { data: WeatherInfo; expires: number }>();
const forecastCache = new Map<
  string,
  { data: ForecastDay[]; expires: number }
>();

export const weatherService = {
  async getCurrentWeather(lat: number, lon: number): Promise<WeatherInfo> {
    const cacheKey = `${lat.toFixed(2)}-${lon.toFixed(2)}`;
    const cached = weatherCache.get(cacheKey);

    if (cached && cached.expires > Date.now()) {
      return cached.data;
    }

    try {
      const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${env.OPENWEATHER_API_KEY}&units=metric&lang=ar`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

      try {
        const response = await fetch(url, { signal: controller.signal });

        if (!response.ok) {
          console.warn(
            `OpenWeather API returned ${response.status}: ${response.statusText}. This usually happens if the API key is new and pending activation (takes 1-2 hours) OR if the subscription tier is exceeded.`,
          );
          return this.getFallbackWeather();
        }

        const data: unknown = await response.json();

        if (!isOpenWeatherPayload(data)) {
          console.error(
            "OpenWeather API returned unexpected data structure:",
            data,
          );
          return this.getFallbackWeather();
        }

        const firstWeather = data.weather?.[0];

        const weatherInfo: WeatherInfo = {
          temp: Math.round(data.main.temp),
          description: firstWeather?.description ?? "غير متاح",
          icon: firstWeather?.icon ?? "01d",
          humidity: data.main.humidity ?? 0,
          city: data.name,
        };

        weatherCache.set(cacheKey, {
          data: weatherInfo,
          expires: Date.now() + CACHE_TTL_MS,
        });

        return weatherInfo;
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error: unknown) {
      if (error instanceof Error && error.name === "AbortError") {
        console.error("OpenWeather API request timed out after 10s");
      } else {
        console.error("Failed to fetch weather:", error);
      }
      return this.getFallbackWeather();
    }
  },

  async getForecastWithEt0(
    lat: number,
    lon: number,
    days = 3,
  ): Promise<ForecastDay[]> {
    const cacheKey = `fcast-${lat.toFixed(2)}-${lon.toFixed(2)}-${days}`;
    const cached = forecastCache.get(cacheKey);

    if (cached && cached.expires > Date.now()) {
      return cached.data;
    }

    try {
      // Use Open-Meteo for ET0 and forecast as it's free and specialized
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,et0_fao_evapotranspiration,precipitation_sum&timezone=Africa%2FCairo&forecast_days=${days}`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

      try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok)
          throw new Error(`Open-Meteo returned ${response.status}`);

        interface OpenMeteoResponse {
          daily: {
            time: string[];
            temperature_2m_max: (number | null)[];
            temperature_2m_min: (number | null)[];
            et0_fao_evapotranspiration: (number | null)[];
            precipitation_sum: (number | null)[];
          };
        }

        const data = (await response.json()) as OpenMeteoResponse;
        if (!data.daily)
          throw new Error("Invalid Open-Meteo response structure");

        const forecast: ForecastDay[] = data.daily.time.map((date, i) => ({
          date,
          maxTemp: data.daily.temperature_2m_max[i] ?? 0,
          minTemp: data.daily.temperature_2m_min[i] ?? 0,
          et0: data.daily.et0_fao_evapotranspiration[i] ?? 0,
          rain: data.daily.precipitation_sum[i] ?? 0,
        }));

        forecastCache.set(cacheKey, {
          data: forecast,
          expires: Date.now() + CACHE_TTL_MS,
        });

        return forecast;
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        console.error("Open-Meteo forecast request timed out after 10s");
      } else {
        console.error("Failed to fetch Open-Meteo forecast:", error);
      }
      // Return sensible desert defaults as fallback
      return Array.from({ length: days }).map((_, i) => ({
        date: new Date(Date.now() + i * 86400000).toISOString().split("T")[0]!,
        maxTemp: 35,
        minTemp: 20,
        et0: 7.5,
        rain: 0,
      }));
    }
  },

  getFallbackWeather(): WeatherInfo {
    return {
      temp: 25,
      description: "الطقس غير متاح حالياً",
      icon: "01d",
      humidity: 50,
    };
  },
};
