import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Play, Pause, Search, Radio, Volume2, VolumeX, Globe2, Loader2 } from "lucide-react";

type Country = { name: string; iso_3166_1: string; stationcount: number };
type Station = {
  stationuuid: string;
  name: string;
  url_resolved: string;
  favicon: string;
  tags: string;
  bitrate: number;
  codec: string;
  country: string;
  language: string;
};

const API_BASES = [
  "https://de1.api.radio-browser.info",
  "https://nl1.api.radio-browser.info",
  "https://at1.api.radio-browser.info",
];

const flag = (iso: string) =>
  iso
    .toUpperCase()
    .replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));

const Index = () => {
  const [countries, setCountries] = useState<Country[]>([]);
  const [country, setCountry] = useState<Country | null>(null);
  const [stations, setStations] = useState<Station[]>([]);
  const [search, setSearch] = useState("");
  const [countrySearch, setCountrySearch] = useState("");
  const [loadingCountries, setLoadingCountries] = useState(true);
  const [loadingStations, setLoadingStations] = useState(false);
  const [current, setCurrent] = useState<Station | null>(null);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(80);
  const [muted, setMuted] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const apiBase = useRef(API_BASES[Math.floor(Math.random() * API_BASES.length)]);

  useEffect(() => {
    document.title = "Wavebox · Free Internet Radio from Around the World";
    (async () => {
      try {
        const r = await fetch(`${apiBase.current}/json/countries?hidebroken=true&order=stationcount&reverse=true`);
        const data: Country[] = await r.json();
        setCountries(data.filter((c) => c.iso_3166_1 && c.stationcount > 0));
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingCountries(false);
      }
    })();
  }, []);

  const loadStations = async (c: Country) => {
    setCountry(c);
    setStations([]);
    setLoadingStations(true);
    try {
      const r = await fetch(
        `${apiBase.current}/json/stations/search?countrycode=${c.iso_3166_1}&hidebroken=true&order=clickcount&reverse=true&limit=400`
      );
      const data: Station[] = await r.json();
      setStations(data.filter((s) => s.url_resolved));
    } finally {
      setLoadingStations(false);
    }
  };

  const filteredCountries = useMemo(
    () => countries.filter((c) => c.name.toLowerCase().includes(countrySearch.toLowerCase())),
    [countries, countrySearch]
  );
  const filteredStations = useMemo(
    () =>
      stations.filter(
        (s) =>
          s.name.toLowerCase().includes(search.toLowerCase()) ||
          s.tags.toLowerCase().includes(search.toLowerCase())
      ),
    [stations, search]
  );

  const play = (s: Station) => {
    if (!audioRef.current) return;
    if (current?.stationuuid === s.stationuuid && playing) {
      audioRef.current.pause();
      setPlaying(false);
      return;
    }
    setCurrent(s);
    setBuffering(true);
    audioRef.current.src = s.url_resolved;
    audioRef.current.play().then(() => setPlaying(true)).catch(() => {
      setPlaying(false);
      setBuffering(false);
    });
    fetch(`${apiBase.current}/json/url/${s.stationuuid}`).catch(() => {});
  };

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = muted ? 0 : volume / 100;
  }, [volume, muted]);

  return (
    <div className="min-h-screen pb-40">
      <audio
        ref={audioRef}
        onPlaying={() => { setPlaying(true); setBuffering(false); }}
        onPause={() => setPlaying(false)}
        onWaiting={() => setBuffering(true)}
        onError={() => { setPlaying(false); setBuffering(false); }}
      />

      {/* Header */}
      <header className="container py-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative h-11 w-11 rounded-2xl grid place-items-center" style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}>
            <Radio className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight">Wavebox</h1>
            <p className="text-xs text-muted-foreground">Free internet radio · worldwide</p>
          </div>
        </div>
        <a href="https://www.radio-browser.info" target="_blank" rel="noreferrer" className="text-xs text-muted-foreground hover:text-foreground transition-colors hidden sm:block">
          Powered by Radio-Browser
        </a>
      </header>

      {/* Hero */}
      {!country && (
        <section className="container text-center pt-8 pb-12">
          <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-muted-foreground mb-6">
            <span className="h-px w-8 bg-border" /> Tune the planet <span className="h-px w-8 bg-border" />
          </div>
          <h2 className="text-5xl md:text-7xl font-black tracking-tight leading-[0.95] mb-4">
            Listen to the world,<br />
            <span className="bg-clip-text text-transparent" style={{ backgroundImage: "var(--gradient-primary)" }}>
              one country at a time.
            </span>
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Pick a country and instantly browse thousands of free internet radio stations, ready to play.
          </p>
        </section>
      )}

      <div className="container">
        {!country ? (
          <>
            <div className="relative max-w-md mx-auto mb-8">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search countries..."
                value={countrySearch}
                onChange={(e) => setCountrySearch(e.target.value)}
                className="pl-11 h-12 rounded-full glass border-border/60"
              />
            </div>

            {loadingCountries ? (
              <div className="flex justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {filteredCountries.map((c) => (
                  <button
                    key={c.iso_3166_1}
                    onClick={() => loadStations(c)}
                    className="group relative overflow-hidden rounded-2xl p-5 text-left transition-all hover:-translate-y-1 hover:shadow-[var(--shadow-card)]"
                    style={{ background: "var(--gradient-card)" }}
                  >
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: "var(--gradient-primary)", mixBlendMode: "overlay" }} />
                    <div className="text-3xl mb-2">{flag(c.iso_3166_1)}</div>
                    <div className="font-semibold truncate">{c.name}</div>
                    <div className="text-xs text-muted-foreground">{c.stationcount.toLocaleString()} stations</div>
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="sm" onClick={() => { setCountry(null); setStations([]); setSearch(""); }}>
                  <Globe2 className="h-4 w-4 mr-2" /> All countries
                </Button>
                <div className="flex items-center gap-2">
                  <span className="text-3xl">{flag(country.iso_3166_1)}</span>
                  <div>
                    <div className="font-bold leading-tight">{country.name}</div>
                    <div className="text-xs text-muted-foreground">{stations.length} stations available</div>
                  </div>
                </div>
              </div>
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Filter stations or genres..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-11 h-11 rounded-full glass border-border/60"
                />
              </div>
            </div>

            {loadingStations ? (
              <div className="flex justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredStations.map((s) => {
                  const isCur = current?.stationuuid === s.stationuuid;
                  return (
                    <Card
                      key={s.stationuuid}
                      onClick={() => play(s)}
                      className={`group cursor-pointer p-4 flex items-center gap-3 border-border/50 transition-all hover:border-primary/60 hover:-translate-y-0.5 ${isCur ? "ring-1 ring-primary" : ""}`}
                      style={{ background: "var(--gradient-card)" }}
                    >
                      <div className="relative shrink-0">
                        <div className="h-14 w-14 rounded-xl bg-secondary grid place-items-center overflow-hidden">
                          {s.favicon ? (
                            <img src={s.favicon} alt="" className="h-full w-full object-cover" onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} />
                          ) : (
                            <Radio className="h-6 w-6 text-muted-foreground" />
                          )}
                        </div>
                        <div className="absolute inset-0 grid place-items-center bg-background/70 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl">
                          {isCur && playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold truncate">{s.name.trim() || "Unknown"}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {s.tags?.split(",").slice(0, 3).join(" · ") || s.codec}
                          {s.bitrate ? ` · ${s.bitrate}kbps` : ""}
                        </div>
                      </div>
                      {isCur && playing && (
                        <div className="flex items-end h-5">
                          <span className="equalizer-bar" />
                          <span className="equalizer-bar" style={{ animationDelay: "0.15s" }} />
                          <span className="equalizer-bar" style={{ animationDelay: "0.3s" }} />
                          <span className="equalizer-bar" style={{ animationDelay: "0.45s" }} />
                        </div>
                      )}
                    </Card>
                  );
                })}
                {filteredStations.length === 0 && (
                  <div className="col-span-full text-center text-muted-foreground py-16">No stations match your search.</div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Player */}
      {current && (
        <div className="fixed bottom-0 inset-x-0 z-50 glass border-t border-border/60">
          <div className="container py-4 flex items-center gap-4">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="relative h-12 w-12 rounded-xl bg-secondary overflow-hidden shrink-0 grid place-items-center">
                {current.favicon ? (
                  <img src={current.favicon} alt="" className="h-full w-full object-cover" onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} />
                ) : (
                  <Radio className="h-5 w-5" />
                )}
              </div>
              <div className="min-w-0">
                <div className="font-semibold truncate">{current.name.trim()}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {flag(country?.iso_3166_1 || current.country.slice(0, 2))} {current.country} · {current.codec} {current.bitrate ? `${current.bitrate}kbps` : ""}
                </div>
              </div>
            </div>

            <Button
              size="icon"
              onClick={() => play(current)}
              className="h-12 w-12 rounded-full shrink-0"
              style={{ background: "var(--gradient-primary)", animation: playing ? "pulse-ring 1.6s infinite" : undefined }}
            >
              {buffering ? <Loader2 className="h-5 w-5 animate-spin" /> : playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
            </Button>

            <div className="hidden sm:flex items-center gap-2 w-40">
              <Button variant="ghost" size="icon" onClick={() => setMuted((m) => !m)}>
                {muted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </Button>
              <Slider value={[muted ? 0 : volume]} max={100} step={1} onValueChange={(v) => { setVolume(v[0]); setMuted(false); }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Index;
