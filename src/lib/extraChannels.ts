// Extra IPTV channels scraped from free public sources
// NOTE: Sports channels like Sky Sports Premier League require the iptv-org
// community sports playlist which is auto-loaded dynamically

// Dynamic playlist URLs — loaded at runtime for always-fresh streams
export const DYNAMIC_PLAYLISTS = [
  {
    id: "iptv-org-sports",
    name: "Sports (iptv-org)",
    url: "https://iptv-org.github.io/iptv/categories/sports.m3u",
    category: "Sports",
  },
  {
    id: "iptv-org-movies",
    name: "Movies (iptv-org)",
    url: "https://iptv-org.github.io/iptv/categories/movies.m3u",
    category: "Movies",
  },
  {
    id: "free-tv",
    name: "Free TV Global",
    url: "https://raw.githubusercontent.com/Free-TV/IPTV/master/playlist.m3u8",
    category: "General",
  },
  {
    id: "sky-sports-pl",
    name: "Sky Sports Premier League",
    url: "https://live20.bozztv.com/trn03/gin-skysportspl/index.m3u8",
    category: "Football",
  },
];

// Extra IPTV channels scraped from free public sources
// Football, Sports, Movies, News — direct m3u8 streams

export type ExtraChannel = {
  id: string;
  name: string;
  url: string;
  logo?: string;
  country: string;
  category: string;
};

export const EXTRA_CHANNELS: ExtraChannel[] = [
  // ── SPORTS / FOOTBALL ──
  {
    id: "nba-tv",
    name: "NBA TV",
    url: "http://fl2.moveonjoy.com/NBA_TV/index.m3u8",
    logo: "https://upload.wikimedia.org/wikipedia/en/thumb/0/03/National_Basketball_Association_logo.svg/200px-National_Basketball_Association_logo.svg.png",
    country: "US",
    category: "Sports",
  },
  {
    id: "nbc-sports",
    name: "NBC Sports",
    url: "https://xumo-xumoent-vc-122-sjv70.fast.nbcuni.com/live/master.m3u8",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/48/NBC_Sports_logo_2012.svg/200px-NBC_Sports_logo_2012.svg.png",
    country: "US",
    category: "Sports",
  },
  {
    id: "ct-sport",
    name: "CT Sport",
    url: "http://88.212.15.27/live/test_ctsport_25p/playlist.m3u8",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/72/%C4%8CT_sport_logo.png/200px-%C4%8CT_sport_logo.png",
    country: "CZ",
    category: "Sports",
  },
  {
    id: "stirr-cricket",
    name: "Cricket TV Gold",
    url: "https://d382r3rgbxdixq.cloudfront.net/v1/manifest/9d062541f2ff39b5c0f48b743c6411d25f62fc25/STIRR-MuxIP-CricketGold/a65cfa82-5804-440f-89bb-e82085655f1e/4.m3u8",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5b/International_Cricket_Council_Logo.svg/200px-International_Cricket_Council_Logo.svg.png",
    country: "US",
    category: "Sports",
  },
  {
    id: "eurosport1",
    name: "Eurosport 1",
    url: "https://iptv-org.github.io/iptv/categories/sports.m3u",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/Eurosport_1_logo.svg/200px-Eurosport_1_logo.svg.png",
    country: "EU",
    category: "Sports",
  },

  // ── NEWS ──
  {
    id: "al-jazeera",
    name: "Al Jazeera English",
    url: "https://live-hls-web-aje.getaj.net/AJE/03.m3u8",
    logo: "https://upload.wikimedia.org/wikipedia/en/thumb/f/f2/Al_Jazeera_English.svg/200px-Al_Jazeera_English.svg.png",
    country: "QA",
    category: "News",
  },
  {
    id: "dw-news",
    name: "DW News",
    url: "https://dwamdstream102.akamaized.net/hls/live/2015525/dwstream102/index.m3u8",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/75/Deutsche_Welle_symbol_2012.svg/200px-Deutsche_Welle_symbol_2012.svg.png",
    country: "DE",
    category: "News",
  },
  {
    id: "france24-en",
    name: "France 24 English",
    url: "https://stream.france24.com/hls/live/2037026/F24_EN_HI_HLS/master.m3u8",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/bf/France_24_Logo.svg/200px-France_24_Logo.svg.png",
    country: "FR",
    category: "News",
  },
  {
    id: "rt-news",
    name: "RT News",
    url: "https://rt-news.secure2.footprint.net/dtv/6c0cc7cc-ed5b-41c8-adb0-7ad8c3498fc0/RTINT_720p_5tile.m3u8",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/83/RT_logo.svg/200px-RT_logo.svg.png",
    country: "RU",
    category: "News",
  },
  {
    id: "cgtn",
    name: "CGTN",
    url: "https://news.cgtn.com/resource/live/english/cgtn-news.m3u8",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b7/CGTN_logo.svg/200px-CGTN_logo.svg.png",
    country: "CN",
    category: "News",
  },
  {
    id: "bloomberg-tv",
    name: "Bloomberg TV",
    url: "https://cdn-videos.anyclip.com/live-news-stream/bloomberg-live-us.m3u8",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5d/Bloomberg_Television_logo.svg/200px-Bloomberg_Television_logo.svg.png",
    country: "US",
    category: "News",
  },

  // ── NASA / SCIENCE ──
  {
    id: "nasa-tv",
    name: "NASA TV Public",
    url: "https://ntv1.akamaized.net/hls/live/2014075/NASA-NTV1-HLS/master_2000.m3u8",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/NASA_logo.svg/200px-NASA_logo.svg.png",
    country: "US",
    category: "Science",
  },
  {
    id: "nasa-tv-media",
    name: "NASA TV Media",
    url: "https://ntv2.akamaized.net/hls/live/2014076/NASA-NTV2-HLS/master_2000.m3u8",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/NASA_logo.svg/200px-NASA_logo.svg.png",
    country: "US",
    category: "Science",
  },

  // ── MOVIES / ENTERTAINMENT ──
  {
    id: "pluto-movies",
    name: "Pluto TV Movies",
    url: "https://raw.githubusercontent.com/BuddyChewChew/app-m3u-generator/refs/heads/main/playlists/plutotv_us.m3u",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4b/Pluto_TV_Logo.svg/200px-Pluto_TV_Logo.svg.png",
    country: "US",
    category: "Movies",
  },
  {
    id: "roku-free",
    name: "Roku Free TV",
    url: "https://raw.githubusercontent.com/BuddyChewChew/app-m3u-generator/refs/heads/main/playlists/roku_all.m3u",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5f/Roku_logo.svg/200px-Roku_logo.svg.png",
    country: "US",
    category: "Entertainment",
  },

  // ── MUSIC ──
  {
    id: "mtv-hits",
    name: "MTV Hits",
    url: "https://mtvnlive.akamaized.net/hls/live/2087926/MTVhits/master.m3u8",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/13/MTV_2021.svg/200px-MTV_2021.svg.png",
    country: "US",
    category: "Music",
  },
  {
    id: "mezzo-live-hd",
    name: "Mezzo Live HD",
    url: "https://stream.mezzo.tv/live/mezzo/mezzo.isml/manifest(format=m3u8-aapl).m3u8",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7c/Mezzo_Live_HD_Logo.png/200px-Mezzo_Live_HD_Logo.png",
    country: "FR",
    category: "Music",
  },
];
