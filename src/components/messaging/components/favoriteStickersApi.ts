/// <reference types="vite/client" />
import useSWR from "swr";
import { fetcherMessages, fetcherMessagesPost } from "../fetcher";
import { getChatToken } from "../../../utils/storage";

export type StickerEntry = { url: string };

export function useFavoriteStickers() {
  return useSWR(
    '/stickers/favorites',
    fetcherMessages,
    { focusThrottleInterval: 60 * 60 * 1000, dedupingInterval: 5000, keepPreviousData: true },
  );
}

export async function addFavorite(url: string): Promise<void> {
  await fetcherMessagesPost('/stickers/favorites/add', { url });
}

export async function removeFavorite(url: string): Promise<void> {
  await fetcherMessagesPost('/stickers/favorites/remove', { url });
}

export async function createCustomSticker(file: File): Promise<{ url: string }> {
  const formData = new FormData();
  formData.append('sticker', file);
  const response = await fetch(`${import.meta.env.VITE_PUBLIC_BACKEND}/upload/upload-custom-sticker`, {
    method: 'POST',
    body: formData,
    headers: { token: await getChatToken(undefined) },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Upload failed');
  return data;
}

export async function removeCustomSticker(url: string): Promise<void> {
  await fetcherMessagesPost('/stickers/custom/remove', { url });
}
