import { useQuery } from "@tanstack/react-query";
import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Droplets,
  Sun,
  Wind,
} from "lucide-react";

import { Skeleton } from "@/components/kit/Skeleton";

/** Wurzen, Sachsen */
const LAT = 51.3667;
const LON = 12.7333;

type Forecast = { day: string; min: number; max: number; code: number };
type Weather = {
  temperature: number;
  apparent: number;
  humidity: number;
  wind: number;
  code: number;
  isDay: boolean;
  days: Forecast[];
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

function iconFor(code: number) {
  if (code === 0) return Sun;
  if (code <= 2) return CloudSun;
  if (code === 3) return Cloud;
  if (code <= 48) return CloudFog;
  if (code <= 57) return CloudDrizzle;
  if (code <= 67 || (code >= 80 && code <= 82)) return CloudRain;
  if (code <= 86) return CloudSnow;
  return CloudLightning;
}

/** Große Wetterkarte mit aktuellen Werten und 4-Tage-Vorhersage. */
export function WeatherPanel() {
  const weather = useQuery({
    queryKey: ["weather", "wurzen", "forecast"],
    queryFn: async (): Promise<Weather> => {
      const url =
        `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}` +
        `&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code,is_day` +
        `&daily=weather_code,temperature_2m_max,temperature_2m_min&forecast_days=5` +
        `&timezone=Europe%2FBerlin`;
      const response = await fetch(url);
      if (!response.ok) throw new Error("Wetter nicht verfügbar");
      const json = await response.json();
      const c = json.current;
      const d = json.daily;
      const days: Forecast[] = (d?.time ?? []).slice(1, 5).map((iso: string, index: number) => ({
        day: new Date(iso).toLocaleDateString("de-DE", { weekday: "short" }),
        min: Math.round(d.temperature_2m_min[index + 1]),
        max: Math.round(d.temperature_2m_max[index + 1]),
        code: d.weather_code[index + 1],
      }));
      return {
        temperature: Math.round(c.temperature_2m),
        apparent: Math.round(c.apparent_temperature),
        humidity: Math.round(c.relative_humidity_2m),
        wind: Math.round(c.wind_speed_10m),
        code: c.weather_code,
        isDay: c.is_day === 1,
        days,
      };
    },
    refetchInterval: 10 * 60_000,
    staleTime: 5 * 60_000,
  });

  if (weather.isLoading) {
    return (
      <section className="panel space-y-4 p-6">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-14 w-40" />
        <Skeleton className="h-16 w-full" />
      </section>
    );
  }

  const data = weather.data;
  const Icon = data ? iconFor(data.code) : Cloud;

  return (
    <section className="panel rise-in space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="flex min-w-0 items-center gap-5">
          <span className="flex size-16 shrink-0 items-center justify-center rounded-3xl bg-accent/12 text-accent">
            <Icon className="size-8" />
          </span>
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Wurzen</p>
            <p className="stat-value text-5xl tabular-nums">
              {data ? `${data.temperature}°` : "–"}
            </p>
            <p className="mt-1 truncate text-sm text-muted-foreground">
              {data
                ? `${describe(data.code)} · gefühlt ${data.apparent}°`
                : "Wetterdaten nicht erreichbar"}
            </p>
          </div>
        </div>

        {data ? (
          <div className="flex gap-3">
            <div className="rounded-2xl bg-secondary/50 px-4 py-3">
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Droplets className="size-3.5" /> Feuchte
              </p>
              <p className="stat-value mt-1 text-xl text-accent">{data.humidity}%</p>
            </div>
            <div className="rounded-2xl bg-secondary/50 px-4 py-3">
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Wind className="size-3.5" /> Wind
              </p>
              <p className="stat-value mt-1 text-xl text-accent">{data.wind}</p>
            </div>
          </div>
        ) : null}
      </div>

      {data?.days.length ? (
        <div className="grid grid-cols-4 gap-2">
          {data.days.map((day) => {
            const DayIcon = iconFor(day.code);
            return (
              <div
                key={day.day}
                className="flex flex-col items-center gap-1.5 rounded-2xl bg-secondary/40 px-2 py-3"
              >
                <span className="text-xs text-muted-foreground">{day.day}</span>
                <DayIcon className="size-5 text-accent" />
                <span className="stat-value text-sm tabular-nums">{day.max}°</span>
                <span className="text-[11px] text-muted-foreground tabular-nums">{day.min}°</span>
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
