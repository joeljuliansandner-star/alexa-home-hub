import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  Sun,
  CloudSun,
  Wind,
  Droplets,
} from "lucide-react";

/** Wurzen, Sachsen */
const LAT = 51.3667;
const LON = 12.7333;

type Weather = {
  temperature: number;
  apparent: number;
  humidity: number;
  wind: number;
  code: number;
  isDay: boolean;
};

function describe(code: number) {
  if (code === 0) return "Klar";
  if (code <= 2) return "Leicht bewölkt";
  if (code === 3) return "Bewölkt";
  if (code <= 48) return "Nebel";
  if (code <= 57) return "Nieselregen";
  if (code <= 67) return "Regen";
  if (code <= 77) return "Schnee";
  if (code <= 82) return "Regenschauer";
  if (code <= 86) return "Schneeschauer";
  return "Gewitter";
}

function iconFor(code: number, isDay: boolean) {
  if (code === 0) return isDay ? Sun : Sun;
  if (code <= 2) return CloudSun;
  if (code === 3) return Cloud;
  if (code <= 48) return CloudFog;
  if (code <= 57) return CloudDrizzle;
  if (code <= 67 || (code >= 80 && code <= 82)) return CloudRain;
  if (code <= 86) return CloudSnow;
  return CloudLightning;
}

export function WeatherClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const weather = useQuery({
    queryKey: ["weather", "wurzen"],
    queryFn: async (): Promise<Weather> => {
      const url =
        `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}` +
        `&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code,is_day` +
        `&timezone=Europe%2FBerlin`;
      const response = await fetch(url);
      if (!response.ok) throw new Error("Wetter nicht verfügbar");
      const json = await response.json();
      const c = json.current;
      return {
        temperature: Math.round(c.temperature_2m),
        apparent: Math.round(c.apparent_temperature),
        humidity: Math.round(c.relative_humidity_2m),
        wind: Math.round(c.wind_speed_10m),
        code: c.weather_code,
        isDay: c.is_day === 1,
      };
    },
    refetchInterval: 10 * 60_000,
    staleTime: 5 * 60_000,
  });

  const Icon = weather.data ? iconFor(weather.data.code, weather.data.isDay) : Cloud;

  return (
    <section className="panel flex flex-wrap items-center justify-between gap-6 p-5">
      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Wurzen</p>
        <p className="font-display text-4xl font-semibold tabular-nums">
          {now
            ? now.toLocaleTimeString("de-DE", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                timeZone: "Europe/Berlin",
              })
            : "--:--:--"}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {now
            ? now.toLocaleDateString("de-DE", {
                weekday: "long",
                day: "numeric",
                month: "long",
                timeZone: "Europe/Berlin",
              })
            : ""}
        </p>
      </div>

      <div className="flex items-center gap-4">
        <Icon className="size-10 text-accent" />
        <div>
          <p className="font-display text-3xl font-semibold tabular-nums">
            {weather.data ? `${weather.data.temperature}°C` : weather.isError ? "–" : "…"}
          </p>
          <p className="text-sm text-muted-foreground">
            {weather.data
              ? `${describe(weather.data.code)} · gefühlt ${weather.data.apparent}°C`
              : weather.isError
                ? "Wetterdaten nicht erreichbar"
                : "Wetter wird geladen"}
          </p>
          {weather.data ? (
            <p className="mt-1 flex gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Droplets className="size-3.5" />
                {weather.data.humidity}%
              </span>
              <span className="flex items-center gap-1">
                <Wind className="size-3.5" />
                {weather.data.wind} km/h
              </span>
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
