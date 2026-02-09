
import { WeatherData, HourlyForecast, DailyForecast, AQIData } from '../types';

const WMO_MAP: Record<number, string> = {
  0: 'Clear',
  1: 'Partly Cloudy',
  2: 'Cloudy',
  3: 'Overcast',
  45: 'Mist',
  48: 'Mist',
  51: 'Drizzle',
  61: 'Rain',
  63: 'Rain',
  65: 'Heavy Rain',
  71: 'Snow',
  73: 'Snow',
  75: 'Heavy Snow',
  80: 'Showers',
  81: 'Showers',
  82: 'Heavy Showers',
  95: 'Storm',
  96: 'Storm',
  99: 'Storm',
};

const mapWmoToCondition = (code: number): string => WMO_MAP[code] || 'Clear';

const getAQIData = (val: number | undefined, pollutants: any): AQIData => {
  const score = val ?? 0;
  let label = "Good";
  let color = "#10b981";
  let description = "Air quality is satisfactory, and air pollution poses little or no risk.";

  if (score > 300) {
    label = "Hazardous";
    color = "#7f1d1d";
    description = "Health warning of emergency conditions: everyone is more likely to be affected.";
  } else if (score > 200) {
    label = "Very Unhealthy";
    color = "#6b21a8";
    description = "Health alert: The risk of health effects is increased for everyone.";
  } else if (score > 150) {
    label = "Unhealthy";
    color = "#ef4444";
    description = "Everyone may experience health effects; sensitive groups more so.";
  } else if (score > 100) {
    label = "Sensitive Risk";
    color = "#f97316";
    description = "Members of sensitive groups may experience health effects.";
  } else if (score > 50) {
    label = "Moderate";
    color = "#eab308";
    description = "Air quality is acceptable. However, there may be a risk for some people.";
  }

  return {
    value: score,
    label,
    color,
    description,
    pollutants: {
      pm2_5: pollutants?.pm2_5 || 0,
      pm10: pollutants?.pm10 || 0,
      no2: pollutants?.nitrogen_dioxide || 0,
      so2: pollutants?.sulphur_dioxide || 0,
      o3: pollutants?.ozone || 0,
      co: pollutants?.carbon_monoxide || 0,
    }
  };
};

export const fetchWeatherByCoords = async (lat: number, lon: number, forcedName?: string): Promise<WeatherData> => {
  const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m,surface_pressure&hourly=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,uv_index_max,precipitation_probability_max&timezone=auto`;
  const aqiUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=us_aqi,pm2_5,pm10,nitrogen_dioxide,sulphur_dioxide,ozone,carbon_monoxide`;
  
  const [weatherRes, aqiRes] = await Promise.all([
    fetch(weatherUrl),
    fetch(aqiUrl)
  ]);

  if (!weatherRes.ok || !aqiRes.ok) throw new Error('Data sync failed');
  
  const weatherData = await weatherRes.json();
  const aqiData = await aqiRes.json();

  let city = forcedName || 'My Location';
  let country = '';
  
  try {
    const geoUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=12`;
    const geoRes = await fetch(geoUrl, { headers: { 'User-Agent': 'AtmosphereWeatherApp/2.0' } });
    if (geoRes.ok) {
      const geoData = await geoRes.json();
      if (!forcedName) city = geoData.address.city || geoData.address.town || geoData.display_name.split(',')[0];
      country = geoData.address.country_code?.toUpperCase() || '';
    }
  } catch (e) {
    console.warn("Reverse geocoding failed");
  }

  const hourly: HourlyForecast[] = weatherData.hourly.time.slice(0, 24).map((time: string, i: number) => ({
    time: new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
    temp: Math.round(weatherData.hourly.temperature_2m[i]),
    condition: mapWmoToCondition(weatherData.hourly.weather_code[i]),
  }));

  const daily: DailyForecast[] = weatherData.daily.time.map((time: string, i: number) => {
    const date = new Date(time);
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return {
      day: i === 0 ? 'Today' : dayNames[date.getDay()],
      min: Math.round(weatherData.daily.temperature_2m_min[i]),
      max: Math.round(weatherData.daily.temperature_2m_max[i]),
      condition: mapWmoToCondition(weatherData.daily.weather_code[i]),
      rainProb: weatherData.daily.precipitation_probability_max[i],
    };
  });

  return {
    city,
    country,
    temp: Math.round(weatherData.current.temperature_2m),
    condition: mapWmoToCondition(weatherData.current.weather_code),
    high: Math.round(weatherData.daily.temperature_2m_max[0]),
    low: Math.round(weatherData.daily.temperature_2m_min[0]),
    feelsLike: Math.round(weatherData.current.apparent_temperature),
    humidity: weatherData.current.relative_humidity_2m,
    windSpeed: weatherData.current.wind_speed_10m,
    uvIndex: weatherData.daily.uv_index_max[0],
    aqi: getAQIData(aqiData.current?.us_aqi, aqiData.current),
    visibility: 10,
    pressure: Math.round(weatherData.current.surface_pressure),
    rainProbability: weatherData.daily.precipitation_probability_max[0],
    sunrise: '06:00',
    sunset: '20:00',
    hourly,
    daily,
  };
};

export const searchCity = async (query: string) => {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
  const res = await fetch(url, { headers: { 'User-Agent': 'AtmosphereWeatherApp/2.0' } });
  const data = await res.json();
  if (data.length === 0) throw new Error('City not found');
  return {
    lat: parseFloat(data[0].lat),
    lon: parseFloat(data[0].lon),
    name: data[0].display_name.split(',')[0],
  };
};

export const fetchWeather = async (city: string): Promise<WeatherData> => {
  const coords = await searchCity(city);
  return fetchWeatherByCoords(coords.lat, coords.lon, coords.name);
};

export const cacheWeather = (city: string, data: WeatherData) => {
  localStorage.setItem(`weather_${city.toLowerCase()}`, JSON.stringify({
    data,
    timestamp: Date.now()
  }));
};
