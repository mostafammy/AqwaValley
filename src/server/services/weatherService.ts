import { env } from "~/env";

export type WeatherInfo = {
  temp: number;
  description: string;
  icon: string;
  humidity: number;
  city?: string;
};

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
        console.warn(`OpenWeather API returned ${response.status}: ${response.statusText}. This usually happens if the API key is new and pending activation (takes 1-2 hours) OR if the subscription tier is exceeded.`);
        return this.getFallbackWeather();
      }

      const data = (await response.json()) as any;

      if (!data || !data.main || typeof data.main.temp !== "number" || !Array.isArray(data.weather) || data.weather.length === 0) {
        console.error("OpenWeather API returned unexpected data structure:", data);
        return this.getFallbackWeather();
      }

      const weatherInfo: WeatherInfo = {
        temp: Math.round(data.main.temp),
        description: data.weather[0]?.description ?? "غير متاح",
        icon: data.weather[0]?.icon ?? "01d",
        humidity: data.main.humidity ?? 0,
        city: data.name,
      };

      weatherCache.set(cacheKey, {
        data: weatherInfo,
        expires: Date.now() + CACHE_TTL_MS,
      });

      return weatherInfo;
    } catch (error: any) {
      if (error.name === "AbortError") {
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
