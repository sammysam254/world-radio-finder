export type KenyaYtChannel = { name: string; channelId: string };

export const KENYA_YT_CHANNELS: KenyaYtChannel[] = [
  { name: "Citizen TV",       channelId: "UChBQgieUidXV1CmDxSdRm3g" },
  { name: "NTV Kenya",        channelId: "UCqBJ47FjJcl61fmSbcadAVg" },
  { name: "KTN News",         channelId: "UCKVsdeoHExltrWMuK0hOWmg" },
  { name: "KTN Home",         channelId: "UCkWr5PLM8hp8M4WNIkjpKsQ" },
  { name: "K24 TV",           channelId: "UCt3SE-Mvs3WwP7UW-PiFdqQ" },
  { name: "KBC Channel 1",    channelId: "UCypNjM5hP1qcUqQZe57jNfg" },
  { name: "TV47 Kenya",       channelId: "UC_zA9UIWE1fB-jfFk_DBSYw" },
  { name: "Kameme TV",        channelId: "UCd9nkc2XA77NMxBvQz35I2Q" },
  { name: "Ramogi TV",        channelId: "UCE0YXdRyT9WC96KZfn7C9mQ" },
];

export const YT_PREFIX = "yt:";
export const isYouTubeStream = (url: string) => url.startsWith(YT_PREFIX);
export const ytChannelIdFromUrl = (url: string) => url.startsWith(YT_PREFIX) ? url.slice(YT_PREFIX.length) : null;
