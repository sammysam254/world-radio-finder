import { useEffect, useMemo, useRef, useState } from "react";
import Hls from "hls.js";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Play, Pause, Search, Radio, Volume2, VolumeX, Globe2, Loader2, Tv, Newspaper, Trophy, Music2, Sparkles, Layers, MapPin, SkipBack, SkipForward, Maximize2, Minimize2, ChevronUp, ChevronDown, Wifi, WifiOff } from "lucide-react";

type Country = { name: string; iso_3166_1: string; stationcount: number };
type Station = {
  stationuuid: string;
  name: string;
  url: string;
  url_resolved: string;
  favicon: string;
  tags: string;
  bitrate: number;
  codec: string;
  country: string;
  countrycode: string;
  language: string;
};

type TvChannel = {
  id: string;
  name: string;
  country: string;
  categories: string[];
  logo: string;
  urls: string[];
};
type TvCountry = { code: string; name: string; flag: string; count: number };

const API_BASES = [
  "https://de1.api.radio-browser.info",
  "https://nl1.api.radio-browser.info",
  "https://at1.api.radio-browser.info",
];

const RADIO_CATEGORIES = [
  { id: "all", label: "All", icon: Sparkles, tags: [] as string[] },
  { id: "news", label: "News", icon: Newspaper, tags: ["news", "talk", "info", "politics"] },
  { id: "sports", label: "Sports", icon: Trophy, tags: ["sport", "sports", "football", "soccer"] },
  { id: "music", label: "Music", icon: Music2, tags: ["music", "pop", "rock", "hits", "dance", "jazz", "classical"] },
];

// Worldwide-browsable category tags
const RADIO_GLOBAL_CATEGORIES: { id: string; label: string; tag: string }[] = [
  { id: "news", label: "News", tag: "news" },
  { id: "talk", label: "Talk", tag: "talk" },
  { id: "sports", label: "Sports", tag: "sports" },
  { id: "pop", label: "Pop", tag: "pop" },
  { id: "rock", label: "Rock", tag: "rock" },
  { id: "dance", label: "Dance", tag: "dance" },
  { id: "electronic", label: "Electronic", tag: "electronic" },
  { id: "jazz", label: "Jazz", tag: "jazz" },
  { id: "classical", label: "Classical", tag: "classical" },
  { id: "hiphop", label: "Hip-Hop", tag: "hiphop" },
  { id: "reggae", label: "Reggae", tag: "reggae" },
  { id: "country", label: "Country", tag: "country" },
  { id: "latin", label: "Latin", tag: "latin" },
  { id: "oldies", label: "Oldies", tag: "oldies" },
  { id: "religious", label: "Religious", tag: "religious" },
  { id: "christian", label: "Christian", tag: "christian" },
];

const flag = (iso: string) =>
  iso
    .toUpperCase()
    .replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));

// ===== URL cache (last successfully playing URL per station/channel) =====
const URL_CACHE_KEY = "wavebox.urlCache.v1";
const loadUrlCache = (): Record<string, string> => {
  try { return JSON.parse(localStorage.getItem(URL_CACHE_KEY) || "{}"); } catch { return {}; }
};
const saveCachedUrl = (id: string, url: string) => {
  try {
    const c = loadUrlCache();
    c[id] = url;
    localStorage.setItem(URL_CACHE_KEY, JSON.stringify(c));
  } catch {}
};
const orderUrlsWithCache = (id: string, urls: string[]) => {
  const cached = loadUrlCache()[id];
  if (!cached || !urls.includes(cached)) return urls;
  return [cached, ...urls.filter((u) => u !== cached)];
};

// ===== Network quality detection =====
type NetQuality = "low" | "mid" | "high";
const detectNetQuality = (): NetQuality => {
  const c: any = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
  if (!c) return "high";
  const t = c.effectiveType as string | undefined;
  if (c.saveData) return "low";
  if (t === "slow-2g" || t === "2g") return "low";
  if (t === "3g") return "mid";
  if (typeof c.downlink === "number") {
    if (c.downlink < 1) return "low";
    if (c.downlink < 3) return "mid";
  }
  return "high";
};

const Index = () => {
  // shared player
  const [mode, setMode] = useState<"radio" | "tv">("radio");
  const [volume, setVolume] = useState(80);
  const [muted, setMuted] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [playError, setPlayError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);

  // playback retry control
  const playbackRef = useRef<{
    type: "radio" | "tv";
    urls: string[];
    idx: number;
    timer?: number;
    stationTimer?: number;
    startedAt: number;
    attempt: number;
  } | null>(null);

  // RADIO state
  const [browseRadioBy, setBrowseRadioBy] = useState<"country" | "category">("country");
  const [countries, setCountries] = useState<Country[]>([]);
  const [country, setCountry] = useState<Country | null>(null);
  const [radioCategory, setRadioCategory] = useState<{ id: string; label: string; tag: string } | null>(null);
  const [stations, setStations] = useState<Station[]>([]);
  const [search, setSearch] = useState("");
  const [countrySearch, setCountrySearch] = useState("");
  const [loadingCountries, setLoadingCountries] = useState(true);
  const [loadingStations, setLoadingStations] = useState(false);
  const [category, setCategory] = useState("all");
  const [currentRadio, setCurrentRadio] = useState<Station | null>(null);
  const apiBase = useRef(API_BASES[0]);

  // TV state
  const [browseTvBy, setBrowseTvBy] = useState<"country" | "category">("country");
  const [tvCountries, setTvCountries] = useState<TvCountry[]>([]);
  const [tvCountry, setTvCountry] = useState<TvCountry | null>(null);
  const [tvCategoryList, setTvCategoryList] = useState<{ id: string; name: string; count: number }[]>([]);
  const [tvCategory, setTvCategory] = useState<{ id: string; name: string; count: number } | null>(null);
  const [tvChannels, setTvChannels] = useState<TvChannel[]>([]);
  const [tvAll, setTvAll] = useState<TvChannel[]>([]);
  const [tvSearch, setTvSearch] = useState("");
  const [tvCountrySearch, setTvCountrySearch] = useState("");
  const [loadingTv, setLoadingTv] = useState(false);
  const [currentTv, setCurrentTv] = useState<TvChannel | null>(null);

  // Big player / fullscreen
  const [bigPlayer, setBigPlayer] = useState(false);
  const playerWrapRef = useRef<HTMLDivElement | null>(null);
  const skipStationRef = useRef<((dir: 1 | -1) => void) | null>(null);

  // Network quality (auto)
  const [netQuality, setNetQuality] = useState<NetQuality>(detectNetQuality());
  useEffect(() => {
    const c: any = (navigator as any).connection;
    if (!c) return;
    const handler = () => setNetQuality(detectNetQuality());
    c.addEventListener?.("change", handler);
    return () => c.removeEventListener?.("change", handler);
  }, []);

  const fetchWithFallback = async (path: string) => {
    let lastErr: unknown;
    for (const base of API_BASES) {
      try {
        const r = await fetch(`${base}${path}`);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        apiBase.current = base;
        return await r.json();
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr;
  };

  useEffect(() => {
    document.title = "Wavebox · Free Radio & TV from Around the World";
    (async () => {
      try {
        const data: Country[] = await fetchWithFallback(
          `/json/countries?hidebroken=true&order=stationcount&reverse=true`
        );
        setCountries(data.filter((c) => c.iso_3166_1 && c.stationcount > 0));
      } catch (e) {
        console.error("Failed to load countries", e);
      } finally {
        setLoadingCountries(false);
      }
    })();
  }, []);

  // Lazy-load TV data on first switch to TV
  useEffect(() => {
    if (mode !== "tv" || tvAll.length > 0) return;
    setLoadingTv(true);
    (async () => {
      try {
        const [channelsRes, streamsRes, countriesRes] = await Promise.all([
          fetch("https://iptv-org.github.io/api/channels.json").then((r) => r.json()),
          fetch("https://iptv-org.github.io/api/streams.json").then((r) => r.json()),
          fetch("https://iptv-org.github.io/api/countries.json").then((r) => r.json()),
        ]);
        // Multiple streams per channel — collect them all for fallback retry
        const streamMap = new Map<string, string[]>();
        for (const s of streamsRes) {
          if (!s.channel || !s.url) continue;
          const arr = streamMap.get(s.channel) || [];
          if (!arr.includes(s.url)) arr.push(s.url);
          streamMap.set(s.channel, arr);
        }
        const countryMap = new Map<string, { name: string; flag: string }>();
        for (const c of countriesRes) countryMap.set(c.code, { name: c.name, flag: c.flag });

        const channels: TvChannel[] = channelsRes
          .filter((c: any) => !c.is_nsfw && streamMap.has(c.id) && c.country)
          .map((c: any) => ({
            id: c.id,
            name: c.name,
            country: c.country,
            categories: c.categories || [],
            logo: c.logo,
            urls: streamMap.get(c.id)!,
          }));

        const counts = new Map<string, number>();
        for (const c of channels) counts.set(c.country, (counts.get(c.country) || 0) + 1);
        const cList: TvCountry[] = [];
        for (const [code, count] of counts.entries()) {
          const meta = countryMap.get(code);
          if (meta) cList.push({ code, name: meta.name, flag: meta.flag, count });
        }
        cList.sort((a, b) => b.count - a.count);

        // Build category list
        const catCounts = new Map<string, number>();
        for (const ch of channels) {
          const cats = ch.categories.length ? ch.categories : ["general"];
          for (const cat of cats) catCounts.set(cat, (catCounts.get(cat) || 0) + 1);
        }
        const catList = Array.from(catCounts.entries())
          .map(([id, count]) => ({ id, name: id.charAt(0).toUpperCase() + id.slice(1), count }))
          .sort((a, b) => b.count - a.count);

        setTvAll(channels);
        setTvCountries(cList);
        setTvCategoryList(catList);
      } catch (e) {
        console.error("Failed to load TV data", e);
      } finally {
        setLoadingTv(false);
      }
    })();
  }, [mode, tvAll.length]);

  const loadStations = async (c: Country) => {
    setCountry(c);
    setRadioCategory(null);
    setStations([]);
    setLoadingStations(true);
    setCategory("all");
    try {
      const data: Station[] = await fetchWithFallback(
        `/json/stations/search?countrycode=${c.iso_3166_1}&hidebroken=true&order=clickcount&reverse=true&limit=600`
      );
      setStations(data.filter((s) => s.url_resolved));
    } catch (e) {
      console.error("Failed to load stations", e);
    } finally {
      setLoadingStations(false);
    }
  };

  const loadStationsByCategory = async (cat: { id: string; label: string; tag: string }) => {
    setRadioCategory(cat);
    setCountry(null);
    setStations([]);
    setLoadingStations(true);
    setCategory("all");
    setSearch("");
    try {
      const data: Station[] = await fetchWithFallback(
        `/json/stations/search?tag=${encodeURIComponent(cat.tag)}&hidebroken=true&order=clickcount&reverse=true&limit=600`
      );
      setStations(data.filter((s) => s.url_resolved));
    } catch (e) {
      console.error("Failed to load category stations", e);
    } finally {
      setLoadingStations(false);
    }
  };

  const loadTvCountry = (c: TvCountry) => {
    setTvCountry(c);
    setTvCategory(null);
    setTvChannels(tvAll.filter((ch) => ch.country === c.code));
    setTvSearch("");
  };

  const loadTvCategory = (cat: { id: string; name: string; count: number }) => {
    setTvCategory(cat);
    setTvCountry(null);
    setTvChannels(
      tvAll.filter((ch) =>
        cat.id === "general"
          ? ch.categories.length === 0 || ch.categories.includes("general")
          : ch.categories.includes(cat.id)
      )
    );
    setTvSearch("");
  };

  const filteredCountries = useMemo(
    () => countries.filter((c) => c.name.toLowerCase().includes(countrySearch.toLowerCase())),
    [countries, countrySearch]
  );

  const filteredStations = useMemo(() => {
    const cat = RADIO_CATEGORIES.find((c) => c.id === category);
    const q = search.toLowerCase();
    return stations.filter((s) => {
      const hay = `${s.name} ${s.tags}`.toLowerCase();
      const matchSearch = !q || hay.includes(q);
      const matchCat = !cat || cat.tags.length === 0 || cat.tags.some((t) => hay.includes(t));
      return matchSearch && matchCat;
    });
  }, [stations, search, category]);

  const filteredTvCountries = useMemo(
    () => tvCountries.filter((c) => c.name.toLowerCase().includes(tvCountrySearch.toLowerCase())),
    [tvCountries, tvCountrySearch]
  );
  const filteredTvChannels = useMemo(() => {
    const q = tvSearch.toLowerCase();
    return tvChannels.filter(
      (c) => !q || c.name.toLowerCase().includes(q) || c.categories.join(" ").toLowerCase().includes(q)
    );
  }, [tvChannels, tvSearch]);

  // ===== Playback with multi-URL fallback retry =====
  const clearPlaybackTimer = () => {
    if (playbackRef.current?.timer) {
      clearTimeout(playbackRef.current.timer);
      playbackRef.current.timer = undefined;
    }
  };

  const clearStationTimer = () => {
    if (playbackRef.current?.stationTimer) {
      clearTimeout(playbackRef.current.stationTimer);
      playbackRef.current.stationTimer = undefined;
    }
  };

  const skipAfterThirtySeconds = (reason?: string) => {
    const p = playbackRef.current;
    if (!p) return;
    clearPlaybackTimer();
    clearStationTimer();
    setPlaying(false);
    setBuffering(false);
    setPlayError(`No playback after 30s${reason ? ` (${reason})` : ""}. Skipping…`);
    window.setTimeout(() => skipStationRef.current?.(1), 250);
  };

  const stopAll = () => {
    clearPlaybackTimer();
    clearStationTimer();
    audioRef.current?.pause();
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.removeAttribute("src");
      videoRef.current.load();
    }
  };

  const armReadinessCheck = (kind: "radio" | "tv") => {
    clearPlaybackTimer();
    const el = kind === "radio" ? audioRef.current : videoRef.current;
    if (!el || !playbackRef.current) return;
    // Retry the next mirror before the 30s station/channel timeout expires.
    playbackRef.current.timer = window.setTimeout(() => {
      const isReady = el && !el.paused && el.readyState >= 2;
      if (!isReady) tryNextSource("Stream not ready");
    }, 10000);
  };

  const armStationTimeout = (kind: "radio" | "tv") => {
    clearStationTimer();
    const startedAt = playbackRef.current?.startedAt ?? Date.now();
    const remaining = Math.max(0, 30000 - (Date.now() - startedAt));
    playbackRef.current!.stationTimer = window.setTimeout(() => {
      const el = kind === "radio" ? audioRef.current : videoRef.current;
      const isReady = el && !el.paused && el.readyState >= 2;
      if (!isReady) skipAfterThirtySeconds("timeout");
    }, remaining);
  };

  const tryNextSource = (reason?: string) => {
    const p = playbackRef.current;
    if (!p) return;
    clearPlaybackTimer();
    if (p.idx + 1 >= p.urls.length) {
      const remaining = 30000 - (Date.now() - p.startedAt);
      if (remaining <= 0) {
        skipAfterThirtySeconds(reason || "all mirrors failed");
      } else {
        setPlayError(`All mirrors failed${reason ? ` (${reason})` : ""}. Waiting 30s before skipping…`);
        clearStationTimer();
        p.stationTimer = window.setTimeout(() => skipAfterThirtySeconds(reason || "all mirrors failed"), remaining);
      }
      return;
    }
    p.idx += 1;
    p.attempt += 1;
    setPlayError(`Retrying… (${p.idx + 1}/${p.urls.length})`);
    if (p.type === "radio") startRadioUrl(p.urls[p.idx]);
    else startTvUrl(p.urls[p.idx]);
  };

  const startRadioUrl = (url: string) => {
    const a = audioRef.current;
    if (!a) return;
    setBuffering(true);
    a.src = url;
    a.load();
    a.play().catch(() => tryNextSource("autoplay blocked or bad source"));
    armReadinessCheck("radio");
  };

  const startTvUrl = (url: string) => {
    const video = videoRef.current;
    if (!video) return;
    setBuffering(true);
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    // Start conservatively on weak connections, but keep ABR free to climb so TV is not blurred.
    const startLevel = netQuality === "low" ? 0 : netQuality === "mid" ? 1 : -1;
    if (url.includes(".m3u8") && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        manifestLoadingMaxRetry: 1,
        fragLoadingMaxRetry: 2,
        capLevelToPlayerSize: false,
        startLevel,
        maxMaxBufferLength: netQuality === "low" ? 12 : 30,
        abrEwmaDefaultEstimate: netQuality === "low" ? 650_000 : netQuality === "mid" ? 1_600_000 : 4_000_000,
      });
      hlsRef.current = hls;
      hls.autoLevelCapping = -1;
      hls.loadSource(url);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        hls.currentLevel = -1;
        hls.nextLevel = -1;
        video.play().catch(() => tryNextSource("autoplay blocked"));
      });
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) tryNextSource(data.details || "HLS error");
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl") || !url.includes(".m3u8")) {
      video.src = url;
      video.play().catch(() => tryNextSource("autoplay blocked or bad source"));
    } else {
      tryNextSource("HLS unsupported");
      return;
    }
    armReadinessCheck("tv");
  };

  const playRadio = (s: Station) => {
    if (!audioRef.current) return;
    if (currentRadio?.stationuuid === s.stationuuid && playing) {
      audioRef.current.pause();
      setPlaying(false);
      return;
    }
    stopAll();
    setCurrentTv(null);
    setCurrentRadio(s);
    setPlayError(null);
    const baseUrls = Array.from(new Set([s.url_resolved, s.url].filter(Boolean)));
    const urls = orderUrlsWithCache(s.stationuuid, baseUrls);
    playbackRef.current = { type: "radio", urls, idx: 0, attempt: 1, startedAt: Date.now() };
    armStationTimeout("radio");
    startRadioUrl(urls[0]);
    fetch(`${apiBase.current}/json/url/${s.stationuuid}`).catch(() => {});
  };

  const playTv = (ch: TvChannel) => {
    if (!videoRef.current) return;
    if (currentTv?.id === ch.id && playing) {
      videoRef.current.pause();
      setPlaying(false);
      return;
    }
    stopAll();
    setCurrentRadio(null);
    setCurrentTv(ch);
    setPlayError(null);
    const baseUrls = ch.urls.length ? ch.urls : [];
    const urls = orderUrlsWithCache(ch.id, baseUrls);
    if (!urls.length) {
      setPlayError("No stream URLs available.");
      return;
    }
    playbackRef.current = { type: "tv", urls, idx: 0, attempt: 1, startedAt: Date.now() };
    armStationTimeout("tv");
    setBigPlayer(true);
    startTvUrl(urls[0]);
  };

  const togglePlay = () => {
    if (currentRadio) playRadio(currentRadio);
    else if (currentTv) playTv(currentTv);
  };

  // Skip to next/prev station/channel within the current filtered list
  const skipStation = (dir: 1 | -1) => {
    if (currentRadio) {
      const list = filteredStations;
      const i = list.findIndex((s) => s.stationuuid === currentRadio.stationuuid);
      if (i < 0 || list.length === 0) return;
      const next = list[(i + dir + list.length) % list.length];
      playRadio(next);
    } else if (currentTv) {
      const list = filteredTvChannels;
      const i = list.findIndex((c) => c.id === currentTv.id);
      if (i < 0 || list.length === 0) return;
      const next = list[(i + dir + list.length) % list.length];
      playTv(next);
    }
  };
  skipStationRef.current = skipStation;

  const toggleFullscreen = () => {
    const el = playerWrapRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
    } else {
      el.requestFullscreen?.();
    }
  };

  const onPlayingSuccess = () => {
    setPlaying(true);
    setBuffering(false);
    setPlayError(null);
    clearPlaybackTimer();
    clearStationTimer();
    // Cache the URL that successfully started playing
    const p = playbackRef.current;
    if (p) {
      const url = p.urls[p.idx];
      if (currentRadio) saveCachedUrl(currentRadio.stationuuid, url);
      else if (currentTv) saveCachedUrl(currentTv.id, url);
    }
  };

  useEffect(() => {
    const v = muted ? 0 : volume / 100;
    if (audioRef.current) audioRef.current.volume = v;
    if (videoRef.current) videoRef.current.volume = v;
  }, [volume, muted]);

  const inRadioBrowse = !country && !radioCategory;
  const inTvBrowse = !tvCountry && !tvCategory;

  return (
    <div className="min-h-screen pb-40">
      <audio
        ref={audioRef}
        onPlaying={onPlayingSuccess}
        onPause={() => setPlaying(false)}
        onWaiting={() => setBuffering(true)}
        onError={() => tryNextSource("audio error")}
        onStalled={() => { /* let readiness timer handle */ }}
      />

      {/* Header */}
      <header className="container py-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative h-11 w-11 rounded-2xl grid place-items-center" style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}>
            <Radio className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight">Wavebox</h1>
            <p className="text-xs text-muted-foreground">Free radio & TV · worldwide</p>
          </div>
        </div>
        <a href="https://www.radio-browser.info" target="_blank" rel="noreferrer" className="text-xs text-muted-foreground hover:text-foreground transition-colors hidden sm:block">
          Powered by Radio-Browser & IPTV-Org
        </a>
      </header>

      <div className="container">
        <Tabs value={mode} onValueChange={(v) => setMode(v as "radio" | "tv")} className="w-full">
          <div className="flex justify-center mb-6">
            <TabsList className="glass">
              <TabsTrigger value="radio" className="gap-2"><Radio className="h-4 w-4" /> Radio</TabsTrigger>
              <TabsTrigger value="tv" className="gap-2"><Tv className="h-4 w-4" /> TV</TabsTrigger>
            </TabsList>
          </div>

          {/* RADIO */}
          <TabsContent value="radio">
            {inRadioBrowse && (
              <section className="text-center pt-4 pb-8">
                <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-muted-foreground mb-6">
                  <span className="h-px w-8 bg-border" /> Tune the planet <span className="h-px w-8 bg-border" />
                </div>
                <h2 className="text-4xl md:text-6xl font-black tracking-tight leading-[0.95] mb-4">
                  Listen to the world,<br />
                  <span className="bg-clip-text text-transparent" style={{ backgroundImage: "var(--gradient-primary)" }}>
                    by country or by vibe.
                  </span>
                </h2>
                <p className="text-muted-foreground max-w-xl mx-auto">
                  Pick a country, or browse by category — thousands of free stations, ready to play.
                </p>
              </section>
            )}

            {inRadioBrowse && (
              <div className="flex justify-center mb-6">
                <div className="inline-flex rounded-full border border-border/60 p-1 glass">
                  <button
                    onClick={() => setBrowseRadioBy("country")}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${browseRadioBy === "country" ? "text-primary-foreground" : "text-muted-foreground"}`}
                    style={browseRadioBy === "country" ? { background: "var(--gradient-primary)" } : undefined}
                  >
                    <MapPin className="h-3.5 w-3.5" /> By Country
                  </button>
                  <button
                    onClick={() => setBrowseRadioBy("category")}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${browseRadioBy === "category" ? "text-primary-foreground" : "text-muted-foreground"}`}
                    style={browseRadioBy === "category" ? { background: "var(--gradient-primary)" } : undefined}
                  >
                    <Layers className="h-3.5 w-3.5" /> By Category
                  </button>
                </div>
              </div>
            )}

            {inRadioBrowse ? (
              browseRadioBy === "country" ? (
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
                    <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
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
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {RADIO_GLOBAL_CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => loadStationsByCategory(cat)}
                      className="group relative overflow-hidden rounded-2xl p-5 text-left transition-all hover:-translate-y-1 hover:shadow-[var(--shadow-card)]"
                      style={{ background: "var(--gradient-card)" }}
                    >
                      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: "var(--gradient-primary)", mixBlendMode: "overlay" }} />
                      <Layers className="h-6 w-6 mb-2 text-primary" />
                      <div className="font-semibold truncate">{cat.label}</div>
                      <div className="text-xs text-muted-foreground">Worldwide stations</div>
                    </button>
                  ))}
                </div>
              )
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                  <div className="flex items-center gap-3">
                    <Button variant="ghost" size="sm" onClick={() => { setCountry(null); setRadioCategory(null); setStations([]); setSearch(""); }}>
                      <Globe2 className="h-4 w-4 mr-2" /> Browse all
                    </Button>
                    <div className="flex items-center gap-2">
                      {country ? (
                        <>
                          <span className="text-3xl">{flag(country.iso_3166_1)}</span>
                          <div>
                            <div className="font-bold leading-tight">{country.name}</div>
                            <div className="text-xs text-muted-foreground">{filteredStations.length} stations</div>
                          </div>
                        </>
                      ) : radioCategory ? (
                        <>
                          <Layers className="h-7 w-7 text-primary" />
                          <div>
                            <div className="font-bold leading-tight">{radioCategory.label}</div>
                            <div className="text-xs text-muted-foreground">{filteredStations.length} stations · worldwide</div>
                          </div>
                        </>
                      ) : null}
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

                {/* Sub-category chips (only relevant when browsing by country) */}
                {country && (
                  <div className="flex flex-wrap gap-2 mb-6">
                    {RADIO_CATEGORIES.map((cat) => {
                      const Icon = cat.icon;
                      const active = category === cat.id;
                      return (
                        <button
                          key={cat.id}
                          onClick={() => setCategory(cat.id)}
                          className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border transition-all ${
                            active
                              ? "border-primary text-primary-foreground"
                              : "border-border/60 text-muted-foreground hover:text-foreground hover:border-border"
                          }`}
                          style={active ? { background: "var(--gradient-primary)" } : undefined}
                        >
                          <Icon className="h-3.5 w-3.5" /> {cat.label}
                        </button>
                      );
                    })}
                  </div>
                )}

                {loadingStations ? (
                  <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {filteredStations.map((s) => {
                      const isCur = currentRadio?.stationuuid === s.stationuuid;
                      return (
                        <Card
                          key={s.stationuuid}
                          onClick={() => playRadio(s)}
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
                              {s.countrycode ? `${flag(s.countrycode)} ` : ""}
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
                      <div className="col-span-full text-center text-muted-foreground py-16">No stations match your filter.</div>
                    )}
                  </div>
                )}
              </>
            )}
          </TabsContent>

          {/* TV */}
          <TabsContent value="tv">
            {inTvBrowse && (
              <section className="text-center pt-4 pb-8">
                <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-muted-foreground mb-6">
                  <span className="h-px w-8 bg-border" /> Watch the planet <span className="h-px w-8 bg-border" />
                </div>
                <h2 className="text-4xl md:text-6xl font-black tracking-tight leading-[0.95] mb-4">
                  Free TV channels,<br />
                  <span className="bg-clip-text text-transparent" style={{ backgroundImage: "var(--gradient-primary)" }}>
                    by country or by genre.
                  </span>
                </h2>
                <p className="text-muted-foreground max-w-xl mx-auto">
                  Browse free over-the-air & online TV channels — pick a country, or jump straight to a category.
                </p>
              </section>
            )}

            {inTvBrowse && !loadingTv && (
              <div className="flex justify-center mb-6">
                <div className="inline-flex rounded-full border border-border/60 p-1 glass">
                  <button
                    onClick={() => setBrowseTvBy("country")}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${browseTvBy === "country" ? "text-primary-foreground" : "text-muted-foreground"}`}
                    style={browseTvBy === "country" ? { background: "var(--gradient-primary)" } : undefined}
                  >
                    <MapPin className="h-3.5 w-3.5" /> By Country
                  </button>
                  <button
                    onClick={() => setBrowseTvBy("category")}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${browseTvBy === "category" ? "text-primary-foreground" : "text-muted-foreground"}`}
                    style={browseTvBy === "category" ? { background: "var(--gradient-primary)" } : undefined}
                  >
                    <Layers className="h-3.5 w-3.5" /> By Category
                  </button>
                </div>
              </div>
            )}

            {loadingTv ? (
              <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : inTvBrowse ? (
              browseTvBy === "country" ? (
                <>
                  <div className="relative max-w-md mx-auto mb-8">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search countries..."
                      value={tvCountrySearch}
                      onChange={(e) => setTvCountrySearch(e.target.value)}
                      className="pl-11 h-12 rounded-full glass border-border/60"
                    />
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    {filteredTvCountries.map((c) => (
                      <button
                        key={c.code}
                        onClick={() => loadTvCountry(c)}
                        className="group relative overflow-hidden rounded-2xl p-5 text-left transition-all hover:-translate-y-1 hover:shadow-[var(--shadow-card)]"
                        style={{ background: "var(--gradient-card)" }}
                      >
                        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: "var(--gradient-primary)", mixBlendMode: "overlay" }} />
                        <div className="text-3xl mb-2">{c.flag || flag(c.code)}</div>
                        <div className="font-semibold truncate">{c.name}</div>
                        <div className="text-xs text-muted-foreground">{c.count.toLocaleString()} channels</div>
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {tvCategoryList.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => loadTvCategory(cat)}
                      className="group relative overflow-hidden rounded-2xl p-5 text-left transition-all hover:-translate-y-1 hover:shadow-[var(--shadow-card)]"
                      style={{ background: "var(--gradient-card)" }}
                    >
                      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: "var(--gradient-primary)", mixBlendMode: "overlay" }} />
                      <Layers className="h-6 w-6 mb-2 text-primary" />
                      <div className="font-semibold truncate">{cat.name}</div>
                      <div className="text-xs text-muted-foreground">{cat.count.toLocaleString()} channels</div>
                    </button>
                  ))}
                </div>
              )
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                  <div className="flex items-center gap-3">
                    <Button variant="ghost" size="sm" onClick={() => { setTvCountry(null); setTvCategory(null); setTvChannels([]); }}>
                      <Globe2 className="h-4 w-4 mr-2" /> Browse all
                    </Button>
                    <div className="flex items-center gap-2">
                      {tvCountry ? (
                        <>
                          <span className="text-3xl">{tvCountry.flag || flag(tvCountry.code)}</span>
                          <div>
                            <div className="font-bold leading-tight">{tvCountry.name}</div>
                            <div className="text-xs text-muted-foreground">{filteredTvChannels.length} channels</div>
                          </div>
                        </>
                      ) : tvCategory ? (
                        <>
                          <Layers className="h-7 w-7 text-primary" />
                          <div>
                            <div className="font-bold leading-tight">{tvCategory.name}</div>
                            <div className="text-xs text-muted-foreground">{filteredTvChannels.length} channels · worldwide</div>
                          </div>
                        </>
                      ) : null}
                    </div>
                  </div>
                  <div className="relative w-full sm:w-72">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Filter channels..."
                      value={tvSearch}
                      onChange={(e) => setTvSearch(e.target.value)}
                      className="pl-11 h-11 rounded-full glass border-border/60"
                    />
                  </div>
                </div>

                {/* TV video lives inside the global player below */}


                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filteredTvChannels.map((c) => {
                    const isCur = currentTv?.id === c.id;
                    return (
                      <Card
                        key={c.id}
                        onClick={() => playTv(c)}
                        className={`group cursor-pointer p-4 flex items-center gap-3 border-border/50 transition-all hover:border-primary/60 hover:-translate-y-0.5 ${isCur ? "ring-1 ring-primary" : ""}`}
                        style={{ background: "var(--gradient-card)" }}
                      >
                        <div className="relative shrink-0">
                          <div className="h-14 w-14 rounded-xl bg-secondary grid place-items-center overflow-hidden">
                            {c.logo ? (
                              <img src={c.logo} alt="" className="h-full w-full object-contain p-1" onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} />
                            ) : (
                              <Tv className="h-6 w-6 text-muted-foreground" />
                            )}
                          </div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold truncate">{c.name}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            {flag(c.country)} {c.categories.slice(0, 2).join(" · ") || "general"}
                            {c.urls.length > 1 ? ` · ${c.urls.length} mirrors` : ""}
                          </div>
                        </div>
                        {isCur && playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 opacity-60" />}
                      </Card>
                    );
                  })}
                  {filteredTvChannels.length === 0 && (
                    <div className="col-span-full text-center text-muted-foreground py-16">No channels match your filter.</div>
                  )}
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Persistent video element for TV (always mounted so ref is stable) */}
      <video
        ref={videoRef}
        playsInline
        controls={bigPlayer && !!currentTv}
        className={
          currentTv && bigPlayer
            ? "fixed z-40 left-0 right-0 top-0 bottom-[72px] w-full h-[calc(100vh-72px)] object-contain bg-black"
            : "hidden"
        }
        onPlaying={onPlayingSuccess}
        onPause={() => setPlaying(false)}
        onWaiting={() => setBuffering(true)}
        onError={() => tryNextSource("video error")}
      />

      {/* Player */}
      {(currentRadio || currentTv) && (
        <div
          ref={playerWrapRef}
          className={`fixed z-50 transition-all ${
            bigPlayer ? "inset-0 flex flex-col pointer-events-none" : "bottom-0 inset-x-0 glass border-t border-border/60"
          }`}
        >
          {bigPlayer && (
            <div className="flex-1 min-h-0 grid place-items-center relative pointer-events-none">
              {!currentTv && (
                <div className="text-center px-6">
                  <div className="mx-auto h-56 w-56 sm:h-72 sm:w-72 rounded-3xl overflow-hidden grid place-items-center" style={{ background: "var(--gradient-card)", boxShadow: "var(--shadow-glow)" }}>
                    {currentRadio?.favicon ? (
                      <img src={currentRadio.favicon} alt="" className="h-full w-full object-cover" onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} />
                    ) : (
                      <Radio className="h-24 w-24 text-primary" />
                    )}
                  </div>
                  <h3 className="mt-6 text-2xl font-black">{currentRadio?.name?.trim()}</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {currentRadio?.countrycode ? flag(currentRadio.countrycode) + " " : ""}
                    {currentRadio?.country} · {currentRadio?.codec}
                    {currentRadio?.bitrate ? ` · ${currentRadio.bitrate}kbps` : ""}
                  </p>
                  {playing && (
                    <div className="flex items-end justify-center h-8 mt-4 gap-0.5">
                      {Array.from({ length: 18 }).map((_, i) => (
                        <span key={i} className="equalizer-bar" style={{ animationDelay: `${i * 0.07}s` }} />
                      ))}
                    </div>
                  )}
                </div>
              )}
              <button
                onClick={() => setBigPlayer(false)}
                className="absolute top-4 right-4 h-10 w-10 rounded-full glass grid place-items-center pointer-events-auto"
                aria-label="Collapse player"
              >
                <ChevronDown className="h-5 w-5" />
              </button>
            </div>
          )}

          <div className={`container py-4 flex items-center gap-2 sm:gap-4 ${bigPlayer ? "pointer-events-auto glass border-t border-border/60" : ""}`}>
            <div
              className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
              onClick={() => !bigPlayer && setBigPlayer(true)}
            >
              <div className="relative h-12 w-12 rounded-xl bg-secondary overflow-hidden shrink-0 grid place-items-center">
                {currentRadio?.favicon ? (
                  <img src={currentRadio.favicon} alt="" className="h-full w-full object-cover" onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} />
                ) : currentTv?.logo ? (
                  <img src={currentTv.logo} alt="" className="h-full w-full object-contain p-1" onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} />
                ) : currentTv ? (
                  <Tv className="h-5 w-5" />
                ) : (
                  <Radio className="h-5 w-5" />
                )}
              </div>
              <div className="min-w-0">
                <div className="font-semibold truncate">{(currentRadio?.name || currentTv?.name || "").trim()}</div>
                <div className="text-xs text-muted-foreground truncate flex items-center gap-1">
                  {netQuality === "low" ? <WifiOff className="h-3 w-3" /> : <Wifi className="h-3 w-3" />}
                  <span className="uppercase tracking-wider">{netQuality}</span>
                  <span>·</span>
                  {playError ? (
                    <span className="text-destructive truncate">{playError}</span>
                  ) : currentRadio ? (
                    <span className="truncate">{currentRadio.countrycode ? flag(currentRadio.countrycode) + " " : ""}{currentRadio.country} · {currentRadio.codec}{currentRadio.bitrate ? ` · ${currentRadio.bitrate}kbps` : ""}</span>
                  ) : currentTv ? (
                    <span className="truncate">{flag(currentTv.country)} {currentTv.categories.slice(0, 2).join(" · ") || "TV"}{currentTv.urls.length > 1 ? ` · mirror ${(playbackRef.current?.idx ?? 0) + 1}/${currentTv.urls.length}` : ""}</span>
                  ) : null}
                </div>
              </div>
            </div>

            <Button variant="ghost" size="icon" onClick={() => skipStation(-1)} className="shrink-0" aria-label="Previous">
              <SkipBack className="h-5 w-5" />
            </Button>

            <Button
              size="icon"
              onClick={togglePlay}
              className="h-12 w-12 rounded-full shrink-0"
              style={{ background: "var(--gradient-primary)", animation: playing ? "pulse-ring 1.6s infinite" : undefined }}
            >
              {buffering ? <Loader2 className="h-5 w-5 animate-spin" /> : playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
            </Button>

            <Button variant="ghost" size="icon" onClick={() => skipStation(1)} className="shrink-0" aria-label="Next">
              <SkipForward className="h-5 w-5" />
            </Button>

            <Button variant="ghost" size="icon" onClick={() => setBigPlayer((b) => !b)} className="shrink-0 hidden sm:inline-flex" aria-label="Expand">
              {bigPlayer ? <ChevronDown className="h-5 w-5" /> : <ChevronUp className="h-5 w-5" />}
            </Button>

            <Button variant="ghost" size="icon" onClick={toggleFullscreen} className="shrink-0 hidden sm:inline-flex" aria-label="Fullscreen">
              <Maximize2 className="h-4 w-4" />
            </Button>

            <div className="hidden md:flex items-center gap-2 w-40">
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
