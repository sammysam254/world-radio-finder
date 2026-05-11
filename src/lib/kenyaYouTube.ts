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
  { name: "Switch TV Kenya",   channelId: "UCBnQ5NbIkwGkDQN81GJHkTg", country: "KE", category: "Entertainment" },
  // NASA only from YouTube
  { name: "NASA TV",           channelId: "UCLA_DiR1FfKNvjuUpBHmylQ", country: "US", category: "Science" },
];

export const YT_PREFIX = "yt:";
export const isYouTubeStream = (url: string) => url.startsWith(YT_PREFIX);
export const ytChannelIdFromUrl = (url: string) => url.startsWith(YT_PREFIX) ? url.slice(YT_PREFIX.length) : null;
