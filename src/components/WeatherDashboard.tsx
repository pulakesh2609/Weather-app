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
/*  Helpers (unchanged logic)                                          */
/* ------------------------------------------------------------------ */
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
    if (uv <= 2) return { label: 'Low', color: 'text-emerald-400' };
    if (uv <= 5) return { label: 'Moderate', color: 'text-yellow-400' };
    if (uv <= 7) return { label: 'High', color: 'text-orange-400' };
    if (uv <= 10) return { label: 'Very High', color: 'text-red-400' };
    return { label: 'Extreme', color: 'text-pink-400' };
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
        className={`
      bg-white/10 backdrop-blur-xl saturate-150
      border border-white/20 rounded-2xl
      glass-shadow
      ${className}
    `}
        style={{ animationDelay: `${delay}ms` }}
    >
        {children}
    </div>
);

const SkeletonBox = ({ className = '' }: { className?: string }) => (
    <div className={`bg-white/15 rounded-xl animate-skeleton ${className}`} />
);

const LoadingSkeleton = () => (
    <div className="w-full max-w-4xl mx-auto px-4 space-y-6 mt-8">
        {/* Main display skeleton */}
        <div className="bg-white/8 backdrop-blur-xl saturate-150 border border-white/15 rounded-2xl p-10 glass-shadow">
            <div className="flex flex-col items-center gap-5">
                <SkeletonBox className="w-28 h-28 rounded-full" />
                <SkeletonBox className="h-20 w-56" />
                <SkeletonBox className="h-6 w-72" />
                <SkeletonBox className="h-5 w-48" />
            </div>
        </div>
        {/* Details grid skeleton */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            {[...Array(4)].map((_, i) => (
                <div
                    key={i}
                    className="bg-white/8 backdrop-blur-xl saturate-150 border border-white/15 rounded-2xl p-6 glass-shadow"
                >
                    <SkeletonBox className="h-10 w-10 mb-4 rounded-full" />
                    <SkeletonBox className="h-4 w-16 mb-3" />
                    <SkeletonBox className="h-9 w-24" />
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
        error: 'bg-red-500/80 border-red-400/30',
        warning: 'bg-amber-500/80 border-amber-400/30',
        info: 'bg-cyan-500/80 border-cyan-400/30',
    };

    useEffect(() => {
        const timer = setTimeout(() => onClose(toast.id), 5000);
        return () => clearTimeout(timer);
    }, [toast.id, onClose]);

    return (
        <div
            className={`${bgMap[toast.type]} backdrop-blur-xl border text-white px-5 py-3.5 rounded-2xl glass-shadow flex items-center gap-3 animate-fade-in`}
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

            try {
                /* On localhost use direct HTTP; on HTTPS deployment use the server-side proxy */
                const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
                const url = isLocal
                    ? `http://api.weatherstack.com/current?access_key=${API_KEY}&query=${encodeURIComponent(q)}`
                    : `/api/weather?query=${encodeURIComponent(q)}`;

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
            } catch {
                addToast('Failed to fetch weather data. Please try again.');
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
    const WeatherIcon = weather ? getWeatherIcon(description) : Cloud;

    /* ---------------------------------------------------------------- */
    /*  Render                                                           */
    /* ---------------------------------------------------------------- */
    return (
        <>
            {/* ── Animated blob background ── */}
            <div className="bg-vibrant" aria-hidden="true">
                <div className="blob-purple" />
                <div className="blob-accent" />
            </div>

            {/* ── Content layer ── */}
            <div className="relative z-10 min-h-screen text-white">
                {/* Toast stack */}
                <div className="fixed top-5 right-5 z-50 flex flex-col gap-3 max-w-sm">
                    {toasts.map((t) => (
                        <ToastNotification key={t.id} toast={t} onClose={removeToast} />
                    ))}
                </div>

                <div className="max-w-4xl mx-auto px-5 py-10 md:py-16">
                    {/* ── Header ── */}
                    <header className="text-center mb-12 animate-fade-in">
                        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-2 bg-gradient-to-r from-white via-cyan-200 to-white bg-clip-text text-transparent">
                            🌍 Global Weather Insights
                        </h1>
                        <p className="text-white/50 text-sm font-medium tracking-wide">
                            Real-time weather data · Powered by Weatherstack
                        </p>
                    </header>

                    {/* ── Search capsule ── */}
                    <form
                        onSubmit={handleSearch}
                        className="flex flex-col sm:flex-row items-stretch gap-3 max-w-2xl mx-auto mb-12 animate-fade-in"
                        style={{ animationDelay: '120ms' }}
                    >
                        <div className="relative flex-1">
                            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                            <input
                                id="search-input"
                                type="text"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Search city, zip, or coordinates…"
                                className="
                  w-full pl-13 pr-5 py-3.5
                  bg-white/8 backdrop-blur-xl saturate-150
                  border border-white/20 rounded-full
                  text-white placeholder:text-white/35
                  focus:outline-none focus-cyan
                  transition-all duration-300
                  text-sm font-medium tracking-wide
                  glass-shadow
                "
                            />
                        </div>

                        <button
                            type="submit"
                            id="search-button"
                            className="
                px-7 py-3.5
                bg-white/10 hover:bg-white/20
                backdrop-blur-xl saturate-150
                border border-white/20 rounded-full
                font-semibold text-sm tracking-wide
                transition-all duration-300
                flex items-center justify-center gap-2
                cursor-pointer glass-shadow
                hover:-translate-y-0.5
              "
                        >
                            <Search className="w-4 h-4" />
                            Search
                        </button>

                        <button
                            type="button"
                            id="locate-button"
                            onClick={handleLocateMe}
                            disabled={locating}
                            className="
                px-6 py-3.5
                bg-white/10 hover:bg-white/20
                backdrop-blur-xl saturate-150
                border border-white/20 rounded-full
                font-semibold text-sm tracking-wide
                transition-all duration-300
                flex items-center justify-center gap-2
                disabled:opacity-40 cursor-pointer glass-shadow
                hover:-translate-y-0.5
              "
                        >
                            {locating ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Navigation className="w-4 h-4" />
                            )}
                            Locate Me
                        </button>
                    </form>

                    {/* ── Loading ── */}
                    {loading && <LoadingSkeleton />}

                    {/* ── Weather Data ── */}
                    {weather && !loading && (
                        <>
                            {/* Main display card */}
                            <GlassCard className="p-10 md:p-14 mb-8 animate-slide-up text-center">
                                <div className="flex flex-col items-center gap-4">
                                    {/* Weather icon with outer glow */}
                                    <div className="relative animate-float">
                                        <div className="absolute inset-0 bg-cyan-400/15 rounded-full blur-3xl scale-[1.8]" />
                                        <div className="relative bg-white/8 backdrop-blur-md border border-white/15 rounded-full p-6">
                                            <WeatherIcon className="w-18 h-18 md:w-22 md:h-22 icon-glow" />
                                        </div>
                                    </div>

                                    {/* Temperature */}
                                    <div className="mt-3">
                                        <span className="text-8xl md:text-9xl font-extrabold tracking-tighter leading-none">
                                            {weather.current.temperature}
                                        </span>
                                        <span className="text-3xl md:text-4xl font-light align-top ml-1 text-white/70">
                                            °C
                                        </span>
                                    </div>

                                    {/* Description */}
                                    <p className="text-xl md:text-2xl font-medium text-white/75 tracking-wide">
                                        {description}
                                    </p>

                                    {/* Feels like */}
                                    <div className="flex items-center gap-2 text-white/50 text-sm">
                                        <Thermometer className="w-4 h-4" />
                                        Feels like {weather.current.feelslike}°C
                                    </div>

                                    {/* Location */}
                                    <div className="flex items-center gap-2 text-white/65 mt-1">
                                        <MapPin className="w-5 h-5 text-[#D0001B]" />
                                        <span className="text-lg font-semibold">
                                            {weather.location.name}
                                            {weather.location.region ? `, ${weather.location.region}` : ''}
                                        </span>
                                        <span className="text-white/30 mx-1">—</span>
                                        <span className="text-white/45">{weather.location.country}</span>
                                    </div>

                                    {/* Local time */}
                                    <div className="flex items-center gap-2 text-white/40 text-sm">
                                        <Clock className="w-4 h-4" />
                                        Local time: {weather.location.localtime}
                                    </div>

                                    {/* Wind + Cloud bar */}
                                    <div className="flex items-center gap-3 mt-3 px-5 py-2.5 bg-white/5 backdrop-blur-md rounded-full border border-white/10 text-white/55 text-sm">
                                        <Wind className="w-4 h-4 text-cyan-400/80" />
                                        <span>{weather.current.wind_speed} km/h {weather.current.wind_dir}</span>
                                        <span className="text-white/20">|</span>
                                        <Cloud className="w-4 h-4 text-white/40" />
                                        <span>{weather.current.cloudcover}% cover</span>
                                    </div>
                                </div>
                            </GlassCard>

                            {/* ── Details grid ── */}
                            <div
                                className="grid grid-cols-2 md:grid-cols-4 gap-5 animate-slide-up"
                                style={{ animationDelay: '200ms' }}
                            >
                                {/* Humidity */}
                                <GlassCard
                                    className="p-6 hover:bg-white/20 transition-all duration-300 group hover:-translate-y-1"
                                    delay={250}
                                >
                                    <div className="bg-blue-500/15 rounded-xl p-2.5 w-fit mb-4 group-hover:bg-blue-500/25 transition-colors">
                                        <Droplets className="w-7 h-7 text-blue-400 group-hover:scale-110 transition-transform" />
                                    </div>
                                    <p className="text-white/45 text-xs font-semibold uppercase tracking-widest mb-1.5">
                                        Humidity
                                    </p>
                                    <p className="text-3xl font-bold tracking-tight">
                                        {weather.current.humidity}
                                        <span className="text-lg font-normal text-white/50 ml-0.5">%</span>
                                    </p>
                                    <p className="text-white/35 text-xs mt-2">
                                        {weather.current.humidity > 70
                                            ? 'High moisture'
                                            : weather.current.humidity > 40
                                                ? 'Comfortable'
                                                : 'Dry air'}
                                    </p>
                                </GlassCard>

                                {/* UV Index */}
                                <GlassCard
                                    className="p-6 hover:bg-white/20 transition-all duration-300 group hover:-translate-y-1"
                                    delay={350}
                                >
                                    <div className="bg-yellow-500/15 rounded-xl p-2.5 w-fit mb-4 group-hover:bg-yellow-500/25 transition-colors">
                                        <Sun className="w-7 h-7 text-yellow-400 group-hover:scale-110 transition-transform" />
                                    </div>
                                    <p className="text-white/45 text-xs font-semibold uppercase tracking-widest mb-1.5">
                                        UV Index
                                    </p>
                                    <p className="text-3xl font-bold tracking-tight">{weather.current.uv_index}</p>
                                    <p className={`text-xs mt-2 font-medium ${getUvLabel(weather.current.uv_index).color}`}>
                                        {getUvLabel(weather.current.uv_index).label}
                                    </p>
                                </GlassCard>

                                {/* Visibility */}
                                <GlassCard
                                    className="p-6 hover:bg-white/20 transition-all duration-300 group hover:-translate-y-1"
                                    delay={450}
                                >
                                    <div className="bg-cyan-500/15 rounded-xl p-2.5 w-fit mb-4 group-hover:bg-cyan-500/25 transition-colors">
                                        <Eye className="w-7 h-7 text-cyan-400 group-hover:scale-110 transition-transform" />
                                    </div>
                                    <p className="text-white/45 text-xs font-semibold uppercase tracking-widest mb-1.5">
                                        Visibility
                                    </p>
                                    <p className="text-3xl font-bold tracking-tight">
                                        {weather.current.visibility}
                                        <span className="text-lg font-normal text-white/50 ml-1">km</span>
                                    </p>
                                    <p className="text-white/35 text-xs mt-2">
                                        {weather.current.visibility >= 10
                                            ? 'Crystal clear'
                                            : weather.current.visibility >= 5
                                                ? 'Good'
                                                : 'Poor visibility'}
                                    </p>
                                </GlassCard>

                                {/* Pressure */}
                                <GlassCard
                                    className="p-6 hover:bg-white/20 transition-all duration-300 group hover:-translate-y-1"
                                    delay={550}
                                >
                                    <div className="bg-emerald-500/15 rounded-xl p-2.5 w-fit mb-4 group-hover:bg-emerald-500/25 transition-colors">
                                        <Gauge className="w-7 h-7 text-emerald-400 group-hover:scale-110 transition-transform" />
                                    </div>
                                    <p className="text-white/45 text-xs font-semibold uppercase tracking-widest mb-1.5">
                                        Pressure
                                    </p>
                                    <p className="text-3xl font-bold tracking-tight">
                                        {weather.current.pressure}
                                        <span className="text-lg font-normal text-white/50 ml-1">mb</span>
                                    </p>
                                    <p className="text-white/35 text-xs mt-2">
                                        {weather.current.pressure >= 1013 ? 'High pressure' : 'Low pressure'}
                                    </p>
                                </GlassCard>
                            </div>

                            {/* Footer */}
                            <footer className="text-center mt-12 text-white/25 text-xs tracking-wide">
                                Last updated · UTC {weather.location.utc_offset} · Weatherstack API
                            </footer>
                        </>
                    )}

                    {/* No data + not loading */}
                    {!weather && !loading && (
                        <div className="text-center mt-24 animate-fade-in">
                            <div className="relative inline-block">
                                <div className="absolute inset-0 bg-white/5 rounded-full blur-2xl scale-150" />
                                <Cloud className="relative w-24 h-24 mx-auto text-white/15 mb-5" />
                            </div>
                            <p className="text-white/35 text-lg font-medium">
                                Search for a city to get started
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
