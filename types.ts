
export interface WeatherData {
  city: string;
  country: string;
  temp: number;
  condition: string;
  high: number;
  low: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  uvIndex: number;
  aqi: AQIData;
  visibility: number;
  pressure: number;
  rainProbability: number;
  sunrise: string;
  sunset: string;
  hourly: HourlyForecast[];
  daily: DailyForecast[];
}

export interface AQIData {
  value: number;
  label: string;
  color: string;
  description: string;
  pollutants: {
    pm2_5: number;
    pm10: number;
    no2: number;
    so2: number;
    o3: number;
    co: number;
  };
}

export interface HourlyForecast {
  time: string;
  temp: number;
  condition: string;
}

export interface DailyForecast {
  day: string;
  min: number;
  max: number;
  condition: string;
  rainProb: number;
}

export interface AIInsights {
  humanInsight: string;
  healthSuggestion: string;
  travelWarning: string;
}

export interface FavoriteLocation {
  city: string;
  country: string;
}
