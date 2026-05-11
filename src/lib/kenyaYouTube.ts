export type KenyaYtChannel = { name: string; channelId: string; country?: string; category?: string };

export const KENYA_YT_CHANNELS: KenyaYtChannel[] = [
  // Kenya
  { name: "Citizen TV",        channelId: "UChBQgieUidXV1CmDxSdRm3g", country: "KE", category: "News" },
  { name: "NTV Kenya",         channelId: "UCqBJ47FjJcl61fmSbcadAVg", country: "KE", category: "News" },
  { name: "KTN News",          channelId: "UCKVsdeoHExltrWMuK0hOWmg", country: "KE", category: "News" },
  { name: "KTN Home",          channelId: "UCkWr5PLM8hp8M4WNIkjpKsQ", country: "KE", category: "Entertainment" },
  { name: "K24 TV",            channelId: "UCt3SE-Mvs3WwP7UW-PiFdqQ", country: "KE", category: "News" },
  { name: "KBC Channel 1",     channelId: "UCypNjM5hP1qcUqQZe57jNfg", country: "KE", category: "Entertainment" },
  { name: "TV47 Kenya",        channelId: "UC_zA9UIWE1fB-jfFk_DBSYw", country: "KE", category: "News" },
  { name: "Kameme TV",         channelId: "UCd9nkc2XA77NMxBvQz35I2Q", country: "KE", category: "Entertainment" },
  { name: "Ramogi TV",         channelId: "UCE0YXdRyT9WC96KZfn7C9mQ", country: "KE", category: "Entertainment" },
  { name: "Inooro TV",         channelId: "UCbLJiMiSX8R-mFAW6_FfBTQ", country: "KE", category: "Entertainment" },
  { name: "Spice FM Kenya",    channelId: "UCBSvIQlhpkEBPEYXnFRRtXg", country: "KE", category: "Music" },
  { name: "Switch TV Kenya",   channelId: "UCBnQ5NbIkwGkDQN81GJHkTg", country: "KE", category: "Entertainment" },
  // Africa
  { name: "CGTN Africa",       channelId: "UCTJhJBE8DYqS6tXZ0SfFiuA", country: "ZA", category: "News" },
  { name: "TVC News Nigeria",  channelId: "UCOXdIcTB6QL3GbCHQ8dZuHw", country: "NG", category: "News" },
  { name: "Channels TV",       channelId: "UCDQNnRGSVJoQSIv-1JOH6Tg", country: "NG", category: "News" },
  { name: "SABC News",         channelId: "UCfGHVH3YFbPv0YJCS_EqWZg", country: "ZA", category: "News" },
  { name: "DW Africa",         channelId: "UCQq-8oyQnAqlUAZxl3JxZOg", country: "DE", category: "News" },
  { name: "Al Jazeera English",channelId: "UCNye-wNBqNL5ZzHSJj3l8Bg", country: "QA", category: "News" },
  // Sports & Football
  { name: "beIN Sports",       channelId: "UCEr-1uMGSBQMVQZ4nVLAj9g", country: "QA", category: "Sports" },
  { name: "Sky Sports News",   channelId: "UCNAf1k0yIjyGu3k9BwAg3lg", country: "GB", category: "Sports" },
  { name: "ESPN FC",           channelId: "UCLLjuCopVJFpGEsGhRMrL8Q", country: "US", category: "Sports" },
  // Movies & Entertainment
  { name: "FilmRise Movies",   channelId: "UCOGnQBpKifYsBmCMeVMbvjQ", country: "US", category: "Movies" },
  { name: "Maverick Movies",   channelId: "UCqNnLs6kXAr9mQIkjPLs5OQ", country: "US", category: "Movies" },
  { name: "Popcornflix",       channelId: "UCo-YCkQHOlqLX7fqIDPRjqA", country: "US", category: "Movies" },
  // Music
  { name: "MTV Live",          channelId: "UCajuPBPBkETp5GsyGFkXbog", country: "US", category: "Music" },
  { name: "Trace Africa",      channelId: "UCS_b1_kUiR_CMLd7gOFdmcw", country: "ZA", category: "Music" },
];

export const YT_PREFIX = "yt:";
export const isYouTubeStream = (url: string) => url.startsWith(YT_PREFIX);
export const ytChannelIdFromUrl = (url: string) => url.startsWith(YT_PREFIX) ? url.slice(YT_PREFIX.length) : null;
