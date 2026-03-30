import { env } from "~/env";

export type WeatherInfo = {
  temp: number;
  description: string;
  icon: string;
  humidity: number;
  city?: string;
};

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

      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

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
    } catch (error: unknown) {
      if (error instanceof Error && error.name === "AbortError") {
        console.error("OpenWeather API request timed out after 10s");
      } else {
        console.error("Failed to fetch weather:", error);
      }
      return this.getFallbackWeather();
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
