import { writable } from 'svelte/store';
import type { SMSEntry } from '../../../my-sms-forwarder/src/types'; // Adjust path as necessary

export const smsMessages = writable<SMSEntry[]>([]);
export const isLoading = writable<boolean>(false);
export const error = writable<string | null>(null);
export const isTurnstileVerified = writable<boolean>(false); // True after successful /api/verify-captcha
export const isAutoRefreshPaused = writable<boolean>(false); // True if JWT expired, or other reasons
export const lastSuccessfulData = writable<SMSEntry[]>([]); // For UI stability during cooldown

// You might want to add a type for the backend SMSEntry if it differs or for clarity
// For now, assuming the SMSEntry type from backend is directly usable.
// If the path to `../../../my-sms-forwarder/src/types` is problematic for your setup,
// consider duplicating the SMSEntry type definition here or in a shared lib. 