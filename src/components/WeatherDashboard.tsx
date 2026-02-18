import { useState, useEffect, useCallback } from 'react';
import {
    Search,
    MapPin,
    Droplets,
    Sun,
    Eye,
    Gauge,
    CloudRain,
    CloudSnow,
    Cloud,
    CloudLightning,
    CloudFog,
    Wind,
    Thermometer,
    Clock,
    Navigation,
    AlertTriangle,
    X,
    Loader2,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface WeatherData {
    request: { query: string };
    location: {
        name: string;
        country: string;
        region: string;
        localtime: string;
        utc_offset: string;
    };
    current: {
        temperature: number;
        weather_descriptions: string[];
        weather_icons: string[];
        weather_code: number;
        wind_speed: number;
        wind_dir: string;
        humidity: number;
        feelslike: number;
        uv_index: number;
        visibility: number;
        pressure: number;
        cloudcover: number;
        is_day: string;
    };
}

interface ApiError {
    success: false;
    error: { code: number; type: string; info: string };
}

interface Toast {
    id: number;
    message: string;
    type: 'error' | 'warning' | 'info';
}

/* ------------------------------------------------------------------ */
/*  Gradient Map                                                       */
/* ------------------------------------------------------------------ */
const getBackgroundGradient = (description: string, isDay: boolean): string => {
    const desc = description.toLowerCase();
    if (desc.includes('thunder') || desc.includes('storm'))
        return 'from-gray-800 via-slate-800 to-gray-900';
    if (desc.includes('snow') || desc.includes('blizzard') || desc.includes('sleet'))
        return 'from-indigo-300 via-blue-200 to-slate-300';
    if (desc.includes('rain') || desc.includes('drizzle') || desc.includes('shower'))
        return 'from-slate-600 via-gray-600 to-slate-800';
    if (desc.includes('fog') || desc.includes('mist') || desc.includes('haze'))
        return 'from-gray-400 via-slate-400 to-gray-500';
    if (desc.includes('overcast') || desc.includes('cloudy'))
        return 'from-slate-700 via-gray-700 to-slate-900';
    if (desc.includes('partly cloudy'))
        return isDay ? 'from-sky-400 via-blue-400 to-slate-500' : 'from-indigo-800 via-slate-800 to-gray-900';
    if (desc.includes('clear') || desc.includes('sunny'))
        return isDay ? 'from-blue-400 via-sky-400 to-blue-600' : 'from-indigo-900 via-purple-900 to-slate-900';
    return isDay ? 'from-sky-500 via-blue-500 to-cyan-500' : 'from-slate-800 via-indigo-900 to-gray-900';
};

const getWeatherIcon = (description: string) => {
    const desc = description.toLowerCase();
    if (desc.includes('thunder') || desc.includes('storm')) return CloudLightning;
    if (desc.includes('snow') || desc.includes('blizzard') || desc.includes('sleet')) return CloudSnow;
    if (desc.includes('rain') || desc.includes('drizzle') || desc.includes('shower')) return CloudRain;
    if (desc.includes('fog') || desc.includes('mist') || desc.includes('haze')) return CloudFog;
    if (desc.includes('overcast') || desc.includes('cloudy')) return Cloud;
    if (desc.includes('clear') || desc.includes('sunny')) return Sun;
    return Cloud;
};

const getUvLabel = (uv: number): { label: string; color: string } => {
    if (uv <= 2) return { label: 'Low', color: 'text-green-300' };
    if (uv <= 5) return { label: 'Moderate', color: 'text-yellow-300' };
    if (uv <= 7) return { label: 'High', color: 'text-orange-300' };
    if (uv <= 10) return { label: 'Very High', color: 'text-red-300' };
    return { label: 'Extreme', color: 'text-pink-300' };
};

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */
const GlassCard = ({
    children,
    className = '',
    delay = 0,
}: {
    children: React.ReactNode;
    className?: string;
    delay?: number;
}) => (
    <div
        className={`bg-white/15 backdrop-blur-lg border border-white/20 rounded-2xl shadow-lg ${className}`}
        style={{ animationDelay: `${delay}ms` }}
    >
        {children}
    </div>
);

const SkeletonBox = ({ className = '' }: { className?: string }) => (
    <div className={`bg-white/20 rounded-xl animate-skeleton ${className}`} />
);

const LoadingSkeleton = () => (
    <div className="w-full max-w-4xl mx-auto px-4 space-y-6 mt-8">
        {/* Main display skeleton */}
        <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-8">
            <div className="flex flex-col items-center gap-4">
                <SkeletonBox className="w-24 h-24 rounded-full" />
                <SkeletonBox className="h-16 w-48" />
                <SkeletonBox className="h-6 w-64" />
                <SkeletonBox className="h-5 w-40" />
            </div>
        </div>
        {/* Details grid skeleton */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
                <div
                    key={i}
                    className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-5"
                >
                    <SkeletonBox className="h-8 w-8 mb-3 rounded-full" />
                    <SkeletonBox className="h-4 w-16 mb-2" />
                    <SkeletonBox className="h-8 w-20" />
                </div>
            ))}
        </div>
    </div>
);

const ToastNotification = ({
    toast,
    onClose,
}: {
    toast: Toast;
    onClose: (id: number) => void;
}) => {
    const bgMap = {
        error: 'bg-red-500/90',
        warning: 'bg-amber-500/90',
        info: 'bg-blue-500/90',
    };

    useEffect(() => {
        const timer = setTimeout(() => onClose(toast.id), 5000);
        return () => clearTimeout(timer);
    }, [toast.id, onClose]);

    return (
        <div
            className={`${bgMap[toast.type]} backdrop-blur-md text-white px-5 py-3 rounded-xl shadow-xl flex items-center gap-3 animate-fade-in`}
        >
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm font-medium flex-1">{toast.message}</span>
            <button
                onClick={() => onClose(toast.id)}
                className="hover:bg-white/20 rounded-full p-1 transition-colors cursor-pointer"
            >
                <X className="w-4 h-4" />
            </button>
        </div>
    );
};

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */
export default function WeatherDashboard() {
    const [weather, setWeather] = useState<WeatherData | null>(null);
    const [loading, setLoading] = useState(false);
    const [query, setQuery] = useState('');
    const [toasts, setToasts] = useState<Toast[]>([]);
    const [locating, setLocating] = useState(false);

    const API_KEY = import.meta.env.VITE_WEATHER_KEY;

    /* ---------- helpers ---------- */
    const addToast = useCallback(
        (message: string, type: Toast['type'] = 'error') => {
            setToasts((prev) => [...prev, { id: Date.now(), message, type }]);
        },
        [],
    );

    const removeToast = useCallback((id: number) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    /* ---------- fetch ---------- */
    const fetchWeather = useCallback(
        async (q: string) => {
            if (!q.trim()) return;
            setLoading(true);
            setWeather(null);

            /* Mixed-content warning */
            if (window.location.protocol === 'https:') {
                addToast(
                    'Weatherstack free tier uses HTTP. Your browser may block this request on HTTPS. Run locally or use a proxy.',
                    'warning',
                );
            }

            try {
                const url = `http://api.weatherstack.com/current?access_key=${API_KEY}&query=${encodeURIComponent(q)}`;
                const res = await fetch(url);
                const data = await res.json();

                if (data.success === false) {
                    const err = data as ApiError;
                    if (err.error.code === 615) {
                        addToast('City not found. Please check the name and try again.');
                    } else if (err.error.code === 101) {
                        addToast('Invalid API key. Please check your .env configuration.');
                    } else {
                        addToast(err.error.info || 'An unknown API error occurred.');
                    }
                    setLoading(false);
                    return;
                }

                setWeather(data as WeatherData);
                localStorage.setItem('weather_last_city', q.trim());
            } catch (err: unknown) {
                const errMsg = err instanceof TypeError && err.message.includes('fetch')
                    ? 'Network error — the request was likely blocked due to mixed content (HTTP on HTTPS). Try running on localhost.'
                    : 'Failed to fetch weather data. Please try again.';
                addToast(errMsg);
            } finally {
                setLoading(false);
            }
        },
        [API_KEY, addToast],
    );

    /* ---------- geolocation ---------- */
    const handleLocateMe = () => {
        if (!navigator.geolocation) {
            addToast('Geolocation is not supported by your browser.', 'warning');
            return;
        }
        setLocating(true);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const coords = `${pos.coords.latitude},${pos.coords.longitude}`;
                setQuery(coords);
                fetchWeather(coords);
                setLocating(false);
            },
            () => {
                addToast('Location access denied. Please allow location permissions.', 'warning');
                setLocating(false);
            },
            { timeout: 10000 },
        );
    };

    /* ---------- submit ---------- */
    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        fetchWeather(query);
    };

    /* ---------- init ---------- */
    useEffect(() => {
        const saved = localStorage.getItem('weather_last_city');
        const initial = saved || 'London';
        setQuery(initial);
        fetchWeather(initial);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /* ---------- derived ---------- */
    const description = weather?.current.weather_descriptions[0] ?? '';
    const isDay = weather?.current.is_day === 'yes';
    const gradient = weather
        ? getBackgroundGradient(description, isDay)
        : 'from-slate-700 via-gray-700 to-slate-900';
    const WeatherIcon = weather ? getWeatherIcon(description) : Cloud;

    /* ---------------------------------------------------------------- */
    /*  Render                                                           */
    /* ---------------------------------------------------------------- */
    return (
        <div
            className={`min-h-screen bg-gradient-to-br ${gradient} transition-all duration-1000 ease-in-out text-white`}
        >
            {/* Toast stack */}
            <div className="fixed top-4 right-4 z-50 flex flex-col gap-3 max-w-sm">
                {toasts.map((t) => (
                    <ToastNotification key={t.id} toast={t} onClose={removeToast} />
                ))}
            </div>

            <div className="max-w-4xl mx-auto px-4 py-8 md:py-12">
                {/* ---------- Header ---------- */}
                <header className="text-center mb-10 animate-fade-in">
                    <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-1">
                        🌍 Global Weather Insights
                    </h1>
                    <p className="text-white/60 text-sm font-medium">
                        Real-time weather data · Powered by Weatherstack
                    </p>
                </header>

                {/* ---------- Search ---------- */}
                <form
                    onSubmit={handleSearch}
                    className="flex flex-col sm:flex-row items-stretch gap-3 max-w-xl mx-auto mb-10 animate-fade-in"
                    style={{ animationDelay: '100ms' }}
                >
                    <div className="relative flex-1">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/50" />
                        <input
                            id="search-input"
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search city, zip, or coordinates…"
                            className="w-full pl-12 pr-4 py-3 bg-white/15 backdrop-blur-lg border border-white/25 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/40 transition-all text-sm font-medium"
                        />
                    </div>

                    <button
                        type="submit"
                        id="search-button"
                        className="px-6 py-3 bg-white/20 hover:bg-white/30 backdrop-blur-lg border border-white/25 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                        <Search className="w-4 h-4" />
                        Search
                    </button>

                    <button
                        type="button"
                        id="locate-button"
                        onClick={handleLocateMe}
                        disabled={locating}
                        className="px-5 py-3 bg-white/20 hover:bg-white/30 backdrop-blur-lg border border-white/25 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                    >
                        {locating ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Navigation className="w-4 h-4" />
                        )}
                        Locate Me
                    </button>
                </form>

                {/* ---------- Loading ---------- */}
                {loading && <LoadingSkeleton />}

                {/* ---------- Weather Data ---------- */}
                {weather && !loading && (
                    <>
                        {/* Main display */}
                        <GlassCard className="p-8 md:p-10 mb-6 animate-slide-up text-center">
                            <div className="flex flex-col items-center gap-3">
                                {/* Weather icon */}
                                <div className="relative">
                                    <div className="absolute inset-0 bg-white/10 rounded-full blur-2xl scale-150" />
                                    <div className="relative bg-white/10 rounded-full p-5">
                                        <WeatherIcon className="w-16 h-16 md:w-20 md:h-20 drop-shadow-lg" />
                                    </div>
                                </div>

                                {/* Temperature */}
                                <div className="mt-2">
                                    <span className="text-7xl md:text-8xl font-extrabold tracking-tighter leading-none">
                                        {weather.current.temperature}
                                    </span>
                                    <span className="text-3xl md:text-4xl font-light align-top ml-1">°C</span>
                                </div>

                                {/* Description */}
                                <p className="text-lg md:text-xl font-medium text-white/80">{description}</p>

                                {/* Feels like */}
                                <div className="flex items-center gap-2 text-white/60 text-sm">
                                    <Thermometer className="w-4 h-4" />
                                    Feels like {weather.current.feelslike}°C
                                </div>

                                {/* Location */}
                                <div className="flex items-center gap-2 text-white/70 mt-2">
                                    <MapPin className="w-5 h-5" />
                                    <span className="text-lg font-semibold">
                                        {weather.location.name}
                                        {weather.location.region ? `, ${weather.location.region}` : ''}
                                    </span>
                                    <span className="text-white/50">—</span>
                                    <span className="text-white/50">{weather.location.country}</span>
                                </div>

                                {/* Local time */}
                                <div className="flex items-center gap-2 text-white/50 text-sm">
                                    <Clock className="w-4 h-4" />
                                    Local time: {weather.location.localtime}
                                </div>

                                {/* Wind */}
                                <div className="flex items-center gap-2 mt-2 text-white/60 text-sm">
                                    <Wind className="w-4 h-4" />
                                    Wind {weather.current.wind_speed} km/h {weather.current.wind_dir}
                                    <span className="mx-1 text-white/30">•</span>
                                    <Cloud className="w-4 h-4" />
                                    Cloud cover {weather.current.cloudcover}%
                                </div>
                            </div>
                        </GlassCard>

                        {/* Details grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-slide-up" style={{ animationDelay: '150ms' }}>
                            {/* Humidity */}
                            <GlassCard className="p-5 hover:bg-white/20 transition-colors group" delay={200}>
                                <Droplets className="w-8 h-8 mb-3 text-blue-300 group-hover:scale-110 transition-transform" />
                                <p className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-1">
                                    Humidity
                                </p>
                                <p className="text-2xl md:text-3xl font-bold">{weather.current.humidity}%</p>
                                <p className="text-white/40 text-xs mt-1">
                                    {weather.current.humidity > 70
                                        ? 'High moisture'
                                        : weather.current.humidity > 40
                                            ? 'Comfortable'
                                            : 'Dry air'}
                                </p>
                            </GlassCard>

                            {/* UV Index */}
                            <GlassCard className="p-5 hover:bg-white/20 transition-colors group" delay={300}>
                                <Sun className="w-8 h-8 mb-3 text-yellow-300 group-hover:scale-110 transition-transform" />
                                <p className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-1">
                                    UV Index
                                </p>
                                <p className="text-2xl md:text-3xl font-bold">{weather.current.uv_index}</p>
                                <p className={`text-xs mt-1 ${getUvLabel(weather.current.uv_index).color}`}>
                                    {getUvLabel(weather.current.uv_index).label}
                                </p>
                            </GlassCard>

                            {/* Visibility */}
                            <GlassCard className="p-5 hover:bg-white/20 transition-colors group" delay={400}>
                                <Eye className="w-8 h-8 mb-3 text-cyan-300 group-hover:scale-110 transition-transform" />
                                <p className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-1">
                                    Visibility
                                </p>
                                <p className="text-2xl md:text-3xl font-bold">{weather.current.visibility} km</p>
                                <p className="text-white/40 text-xs mt-1">
                                    {weather.current.visibility >= 10
                                        ? 'Crystal clear'
                                        : weather.current.visibility >= 5
                                            ? 'Good'
                                            : 'Poor visibility'}
                                </p>
                            </GlassCard>

                            {/* Pressure */}
                            <GlassCard className="p-5 hover:bg-white/20 transition-colors group" delay={500}>
                                <Gauge className="w-8 h-8 mb-3 text-emerald-300 group-hover:scale-110 transition-transform" />
                                <p className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-1">
                                    Pressure
                                </p>
                                <p className="text-2xl md:text-3xl font-bold">{weather.current.pressure} mb</p>
                                <p className="text-white/40 text-xs mt-1">
                                    {weather.current.pressure >= 1013
                                        ? 'High pressure'
                                        : 'Low pressure'}
                                </p>
                            </GlassCard>
                        </div>

                        {/* Footer */}
                        <footer className="text-center mt-10 text-white/30 text-xs">
                            Last updated · UTC {weather.location.utc_offset} · Weatherstack API
                        </footer>
                    </>
                )}

                {/* No data + not loading */}
                {!weather && !loading && (
                    <div className="text-center mt-20 animate-fade-in">
                        <Cloud className="w-20 h-20 mx-auto text-white/20 mb-4" />
                        <p className="text-white/40 text-lg">
                            Search for a city to get started
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
