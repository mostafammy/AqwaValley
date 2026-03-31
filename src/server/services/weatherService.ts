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
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
const weatherCache = new Map<string, { data: WeatherInfo; expires: number }>();
const forecastCache = new Map<string, { data: ForecastDay[]; expires: number }>();

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

  async getForecastWithEt0(lat: number, lon: number, days = 3): Promise<ForecastDay[]> {
    const cacheKey = `fcast-${lat.toFixed(2)}-${lon.toFixed(2)}-${days}`;
    const cached = forecastCache.get(cacheKey);

    if (cached && cached.expires > Date.now()) {
      return cached.data;
    }

    try {
      // Use Open-Meteo for ET0 and forecast as it's free and specialized
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,et0_fao_evapotranspiration,precipitation_sum&timezone=Africa%2FCairo&forecast_days=${days}`;
      
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Open-Meteo returned ${response.status}`);

      const data = (await response.json()) as any;
      if (!data.daily) throw new Error("Invalid Open-Meteo response structure");

      const forecast: ForecastDay[] = data.daily.time.map((date: string, i: number) => ({
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
    } catch (error) {
      console.error("Failed to fetch Open-Meteo forecast:", error);
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
