
import React, { useState, useEffect, useCallback } from 'react';
import { AreaChart, Area, XAxis, ResponsiveContainer, Tooltip } from 'recharts';
// Removed getCachedWeather as it is not exported from weatherService.ts
import { fetchWeather, fetchWeatherByCoords, cacheWeather } from './services/weatherService';
import { getAIInsights } from './services/geminiService';
import { WeatherData, AIInsights, FavoriteLocation } from './types';
import { Icons } from './constants';
import { translations, LanguageCode, languages } from './translations';

const App: React.FC = () => {
  const [lang, setLang] = useState<LanguageCode>(() => {
    const saved = localStorage.getItem('lang');
    if (saved) return saved as LanguageCode;
    const browserLang = navigator.language.split('-')[0] as LanguageCode;
    return (translations[browserLang as LanguageCode] ? browserLang : 'en') as LanguageCode;
  });

  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [insights, setInsights] = useState<AIInsights | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [favorites, setFavorites] = useState<FavoriteLocation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const t = translations[lang];

  const handleFetchData = useCallback(async (lat?: number, lon?: number, cityName?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      let data: WeatherData;
      if (lat !== undefined && lon !== undefined) {
        data = await fetchWeatherByCoords(lat, lon, cityName);
      } else if (cityName) {
        data = await fetchWeather(cityName);
      } else {
        data = await fetchWeather('San Francisco');
      }

      setWeather(data);
      setLastUpdated(new Date());
      cacheWeather(data.city, data);
      
      // Attempt to get AI insights in background
      getAIInsights(data, lang).then(setInsights).catch(console.error);
    } catch (err) {
      console.error(err);
      setError(t.error);
    } finally {
      setIsLoading(false);
    }
  }, [lang, t.error]);

  const useCurrentLocation = useCallback(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => handleFetchData(pos.coords.latitude, pos.coords.longitude),
        (err) => {
          console.warn("Geolocation failed", err);
          handleFetchData(undefined, undefined, 'San Francisco');
        },
        { timeout: 10000 }
      );
    } else {
      handleFetchData(undefined, undefined, 'San Francisco');
    }
  }, [handleFetchData]);

  useEffect(() => {
    useCurrentLocation();
    try {
      const saved = localStorage.getItem('favorites');
      if (saved) setFavorites(JSON.parse(saved));
    } catch (e) {
      console.warn("Could not load favorites");
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('lang', lang);
    if (weather) {
      getAIInsights(weather, lang).then(setInsights).catch(console.error);
    }
  }, [lang]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      handleFetchData(undefined, undefined, searchInput.trim());
      setSearchInput('');
    }
  };

  const toggleFavorite = () => {
    if (!weather) return;
    const isFav = favorites.some(f => f.city === weather.city);
    let newFavs: FavoriteLocation[];
    if (isFav) {
      newFavs = favorites.filter(f => f.city !== weather.city);
    } else {
      newFavs = [...favorites, { city: weather.city, country: weather.country }];
    }
    setFavorites(newFavs);
    localStorage.setItem('favorites', JSON.stringify(newFavs));
  };

  if (isLoading && !weather) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-50">
        <div className="text-center">
          <div className="animate-spin mb-6 text-blue-500 inline-block scale-150"><Icons.Sun /></div>
          <p className="text-slate-500 font-medium tracking-tight animate-pulse">{t.loading}</p>
        </div>
      </div>
    );
  }

  const isRain = weather?.condition.toLowerCase().includes('rain') || weather?.condition.toLowerCase().includes('shower') || weather?.condition.toLowerCase().includes('storm');
  const isClear = weather?.condition.toLowerCase().includes('clear');
  const bgGradient = isRain ? 'from-slate-500 to-slate-700' : isClear ? 'from-sky-400 to-blue-600' : 'from-blue-500 to-indigo-700';

  return (
    <div className="min-h-screen bg-slate-50 pb-20 overflow-x-hidden font-['Inter']">
      <div className={`bg-gradient-to-br ${bgGradient} pt-6 pb-24 px-6 text-white rounded-b-[48px] md:rounded-b-[80px] shadow-2xl relative transition-all duration-1000`}>
        <div className="absolute top-0 right-0 w-[300px] h-[300px] md:w-[600px] md:h-[600px] bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl opacity-50"></div>
        
        <div className="max-w-4xl mx-auto relative z-10">
          <div className="flex justify-between items-center mb-8">
             <div className="flex items-center gap-2 bg-white/15 px-4 py-2 rounded-full backdrop-blur-xl border border-white/20">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(74,222,128,0.8)]"></div>
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">{t.appName} LIVE</span>
             </div>
             <div className="flex gap-2">
                <select 
                  value={lang} 
                  onChange={(e) => setLang(e.target.value as LanguageCode)}
                  className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-full py-2 px-5 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-white/30 appearance-none cursor-pointer hover:bg-white/20 transition-all shadow-lg"
                >
                  {Object.entries(languages).map(([code, { name, flag }]) => (
                    <option key={code} value={code} className="text-slate-900">{flag} {name}</option>
                  ))}
                </select>
             </div>
          </div>

          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-16 gap-8">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-4 md:gap-6">
                <button onClick={useCurrentLocation} title="Current Location" className="p-3 md:p-4 bg-white/10 hover:bg-white/20 rounded-full transition-all active:scale-90 shadow-xl border border-white/10">
                  <Icons.Navigation />
                </button>
                <div>
                  <h1 className="text-3xl md:text-6xl font-black tracking-tight drop-shadow-lg leading-tight">{weather?.city}</h1>
                  {weather?.country && <p className="text-white/70 text-[10px] md:text-xs font-black uppercase tracking-[0.3em] mt-1">{weather.country}</p>}
                </div>
                <button onClick={toggleFavorite} className={`p-3 md:p-4 rounded-full transition-all shadow-xl active:scale-90 ${favorites.some(f => f.city === weather?.city) ? 'text-rose-400 bg-white/20' : 'text-white/60 bg-white/10 hover:bg-white/20'}`}>
                  <Icons.Heart filled={favorites.some(f => f.city === weather?.city)} />
                </button>
              </div>
            </div>

            <form onSubmit={handleSearch} className="relative w-full md:w-80 group">
              <input 
                type="text" 
                placeholder={t.searchPlaceholder} 
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full bg-white/10 backdrop-blur-3xl border border-white/20 rounded-[28px] py-4 md:py-5 pl-14 pr-8 text-white placeholder-white/40 focus:outline-none focus:bg-white/20 focus:ring-4 focus:ring-white/10 transition-all shadow-2xl text-lg font-medium"
              />
              <div className="absolute left-6 top-4 md:top-5 text-white/40 group-focus-within:text-white transition-colors"><Icons.Search /></div>
            </form>
          </div>

          <div className="flex flex-col items-center text-center animate-in fade-in zoom-in duration-1000">
            <div className="mb-10 drop-shadow-[0_20px_50px_rgba(255,255,255,0.3)] scale-[2] md:scale-[3] text-white float-animation">
              {isRain ? <Icons.CloudRain /> : <Icons.Sun />}
            </div>
            <div className="text-9xl md:text-[14rem] font-thin tracking-tighter mb-4 tabular-nums leading-none drop-shadow-2xl">
              {weather?.temp}°
            </div>
            <div className="text-3xl md:text-5xl font-extralight mb-6 tracking-wider opacity-95">{weather?.condition}</div>
            
            <div className="flex flex-wrap justify-center gap-4">
               <div className="bg-white/10 backdrop-blur-xl px-6 md:px-8 py-2 md:py-3 rounded-full border border-white/15 font-black text-[10px] md:text-sm tracking-widest shadow-xl">
                 {t.high}: {weather?.high}°
               </div>
               <div className="bg-white/10 backdrop-blur-xl px-6 md:px-8 py-2 md:py-3 rounded-full border border-white/15 font-black text-[10px] md:text-sm tracking-widest shadow-xl opacity-80">
                 {t.low}: {weather?.low}°
               </div>
            </div>

            {lastUpdated && (
              <p className="mt-8 text-[8px] md:text-[10px] font-black uppercase tracking-[0.4em] opacity-40">
                Synced at {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 md:px-6 -mt-10 md:-mt-14 space-y-10 md:space-y-12 relative z-20">
        {/* Real-time Human Insights */}
        {insights && (
          <div className="bg-white/95 backdrop-blur-3xl rounded-[40px] md:rounded-[56px] p-8 md:p-12 shadow-[0_50px_100px_-20px_rgba(0,0,0,0.1)] border border-white/50 animate-in slide-in-from-bottom-16 duration-1000">
            <div className="flex items-center gap-4 mb-8 md:mb-12">
              <div className="p-3 bg-blue-500 text-white rounded-2xl shadow-blue-200 shadow-2xl rotate-3"><Icons.Zap /></div>
              <h3 className="font-black uppercase tracking-[0.4em] text-[10px] text-slate-400">{t.perspectives}</h3>
            </div>
            <div className="grid md:grid-cols-3 gap-10 md:gap-16">
              <InsightBlock label={t.environment} text={insights.humanInsight} />
              <InsightBlock label={t.wellbeing} text={insights.healthSuggestion} />
              <InsightBlock label={t.travel} text={insights.travelWarning} />
            </div>
          </div>
        )}

        {/* AQI Section */}
        <div className="bg-white rounded-[40px] md:rounded-[56px] p-8 md:p-14 shadow-sm border border-slate-100 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-slate-50 rounded-full -mr-24 -mt-24 opacity-50"></div>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10 relative z-10">
            <div>
              <h3 className="text-slate-400 text-[10px] font-black uppercase tracking-[0.4em] mb-4">{t.aqi} - Atmosphere Quality</h3>
              <div className="inline-block px-5 py-1.5 rounded-full text-white font-black text-[10px] tracking-widest uppercase shadow-lg" style={{ backgroundColor: weather?.aqi.color }}>
                {weather?.aqi.label}
              </div>
            </div>
            <div className="text-5xl md:text-7xl font-black text-slate-800 tabular-nums tracking-tighter">
              {weather?.aqi.value}
              <span className="text-lg font-bold text-slate-300 ml-3">US AQI</span>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-12 mb-10 relative z-10">
            <p className="text-slate-500 text-lg leading-relaxed font-medium md:border-r md:border-slate-100 md:pr-12">
              {weather?.aqi.description}
            </p>
            <div className="grid grid-cols-2 gap-6 md:gap-8">
              <PollutantMeter label="PM2.5" value={weather?.aqi.pollutants.pm2_5 || 0} unit="µg/m³" max={100} />
              <PollutantMeter label="PM10" value={weather?.aqi.pollutants.pm10 || 0} unit="µg/m³" max={200} />
              <PollutantMeter label="NO2" value={weather?.aqi.pollutants.no2 || 0} unit="µg/m³" max={100} />
              <PollutantMeter label="O3" value={weather?.aqi.pollutants.o3 || 0} unit="µg/m³" max={180} />
              <PollutantMeter label="SO2" value={weather?.aqi.pollutants.so2 || 0} unit="µg/m³" max={100} />
              <PollutantMeter label="CO" value={Math.round((weather?.aqi.pollutants.co || 0) / 100)} unit="mg/m³" max={10} />
            </div>
          </div>
        </div>

        {/* Hourly Chart */}
        <div className="bg-white rounded-[40px] md:rounded-[56px] p-8 md:p-14 shadow-sm border border-slate-100">
          <h3 className="text-slate-400 text-[10px] font-black uppercase tracking-[0.4em] mb-10">{t.hourly}</h3>
          <div className="h-64 md:h-72 w-full mb-10">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weather?.hourly.slice(0, 18)}>
                <defs>
                  <linearGradient id="colorTemp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="time" hide />
                <Tooltip 
                  contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 40px 80px -20px rgba(0,0,0,0.15)', padding: '16px', fontWeight: '900' }}
                  cursor={{ stroke: '#3b82f6', strokeWidth: 2, strokeDasharray: '8 8' }}
                />
                <Area type="monotone" dataKey="temp" stroke="#3b82f6" fillOpacity={1} fill="url(#colorTemp)" strokeWidth={4} dot={{ fill: '#3b82f6', strokeWidth: 4, r: 6, stroke: '#fff' }} activeDot={{ r: 10, strokeWidth: 0 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="flex overflow-x-auto gap-8 md:gap-16 pb-6 hide-scrollbar">
            {weather?.hourly.slice(0, 24).map((h, i) => (
              <div key={i} className="flex flex-col items-center min-w-[4rem] md:min-w-[5rem] group p-2 rounded-2xl transition-all">
                <span className="text-[10px] text-slate-400 mb-4 font-black uppercase tracking-widest">{h.time}</span>
                <div className="mb-4 text-slate-300 group-hover:text-blue-500 transition-all scale-125">
                   {h.condition.includes('Rain') || h.condition.includes('Showers') ? <Icons.CloudRain /> : <Icons.Sun />}
                </div>
                <span className="font-black text-slate-800 text-xl md:text-2xl tabular-nums">{h.temp}°</span>
              </div>
            ))}
          </div>
        </div>

        {/* Daily Forecast */}
        <div className="bg-white rounded-[40px] md:rounded-[56px] p-8 md:p-14 shadow-sm border border-slate-100">
          <h3 className="text-slate-400 text-[10px] font-black uppercase tracking-[0.4em] mb-8">{t.upcoming}</h3>
          <div className="space-y-4">
            {weather?.daily.map((d, i) => (
              <div key={i} className="flex flex-wrap md:flex-nowrap items-center justify-between py-6 px-4 md:px-8 hover:bg-slate-50 rounded-[32px] transition-all group gap-4">
                <span className="w-24 md:w-40 font-black text-slate-800 text-xl md:text-2xl">{d.day}</span>
                <div className="flex items-center gap-4 md:gap-8 w-32 md:w-56">
                  <div className="text-slate-400 group-hover:text-blue-500 transition-all">
                    {d.condition.includes('Rain') || d.condition.includes('Showers') ? <Icons.CloudRain /> : <Icons.Sun />}
                  </div>
                  <span className={`text-[10px] md:text-xs font-black tracking-widest uppercase ${d.rainProb > 25 ? 'text-blue-500' : 'text-slate-300'}`}>
                    {d.rainProb}% <span className="hidden md:inline ml-1">Rain</span>
                  </span>
                </div>
                <div className="flex items-center gap-6 md:gap-12 flex-1 justify-end max-w-lg">
                  <span className="text-slate-300 font-black text-xl md:text-2xl tabular-nums w-10 md:w-16 text-right">{d.min}°</span>
                  <div className="h-3 md:h-4 flex-1 bg-slate-100 rounded-full relative overflow-hidden shadow-inner max-w-[200px]">
                     <div className="absolute h-full bg-gradient-to-r from-blue-400 via-sky-300 to-amber-300 rounded-full shadow-lg" style={{left: '10%', right: '10%'}}></div>
                  </div>
                  <span className="text-slate-800 font-black text-xl md:text-2xl tabular-nums w-10 md:w-16 text-right">{d.max}°</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-12">
          <MetricCard title={t.uvIndex} value={weather?.uvIndex.toFixed(1) || '0'} subtitle={weather?.uvIndex && weather.uvIndex < 3 ? 'Low' : 'Caution'} icon={<Icons.Sun />} />
          <MetricCard title={t.wind} value={`${weather?.windSpeed} km/h`} subtitle="Wind" icon={<Icons.Wind />} />
          <MetricCard title={t.humidity} value={`${weather?.humidity}%`} subtitle="Moisture" icon={<Icons.Droplets />} />
          <MetricCard title={t.pressure} value={`${weather?.pressure} hPa`} subtitle="Pressure" icon={<Icons.Thermometer />} />
        </div>
      </div>

      {error && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 backdrop-blur-3xl text-white px-8 py-5 rounded-full shadow-2xl flex items-center gap-4 animate-in slide-in-from-bottom-12">
          <Icons.AlertTriangle />
          <span className="font-bold tracking-tight text-sm md:text-base">{error}</span>
          <button onClick={() => setError(null)} className="ml-4 opacity-40 hover:opacity-100 font-black text-xl">✕</button>
        </div>
      )}
    </div>
  );
};

const PollutantMeter: React.FC<{ label: string; value: number; unit: string; max: number }> = ({ label, value, unit, max }) => (
  <div className="space-y-2">
    <div className="flex justify-between items-end">
      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
      <span className="text-xs font-bold text-slate-700 tabular-nums">{value}<span className="text-[8px] text-slate-300 ml-0.5">{unit}</span></span>
    </div>
    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
      <div 
        className="h-full bg-blue-400/80 transition-all duration-1000" 
        style={{ width: `${Math.min((value / max) * 100, 100)}%` }}
      ></div>
    </div>
  </div>
);

const InsightBlock: React.FC<{ label: string; text: string }> = ({ label, text }) => (
  <div className="space-y-3">
    <p className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">{label}</p>
    <p className="text-slate-800 leading-relaxed font-bold text-lg md:text-2xl tracking-tight">{text}</p>
  </div>
);

const MetricCard: React.FC<{ title: string; value: string; subtitle: string; icon: React.ReactNode }> = ({ title, value, subtitle, icon }) => (
  <div className="bg-white rounded-[32px] md:rounded-[48px] p-6 md:p-10 shadow-sm border border-slate-100 hover:shadow-lg transition-all duration-500 group cursor-default">
    <div className="flex items-center gap-3 text-slate-300 mb-6 md:mb-10 group-hover:text-blue-500 transition-colors">
      <div className="scale-110 md:scale-150">{icon}</div>
      <h3 className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] ml-1">{title}</h3>
    </div>
    <div className="text-3xl md:text-5xl font-black text-slate-800 mb-3 tabular-nums tracking-tighter">{value}</div>
    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{subtitle}</div>
  </div>
);

export default App;
