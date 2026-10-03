import { parseApiUrl } from '@ft/live-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

/** The API's default port (apps/api/.env.example). */
export const API_PORT = 4000;

const STORAGE_KEY = 'apiUrl';

/**
 * During development the phone loads JavaScript from the computer running `expo start`, which
 * usually runs the API too, so its address is a good first guess. `hostUri` is that computer's
 * `host:port` as the phone reached it; it is missing in standalone builds.
 */
export function apiUrlFromHostUri(hostUri: string | undefined): string | null {
  const host = hostUri?.replace(/:\d+$/, '');
  return host ? parseApiUrl(`${host}:${String(API_PORT)}`) : null;
}

export function devMachineApiUrl(): string | null {
  return apiUrlFromHostUri(Constants.expoConfig?.hostUri);
}

export async function loadApiUrl(): Promise<string | null> {
  const saved = await AsyncStorage.getItem(STORAGE_KEY);
  return saved === null ? null : parseApiUrl(saved);
}

export async function saveApiUrl(url: string): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, url);
}
