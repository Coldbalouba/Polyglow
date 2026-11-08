/** TutConnect is languages-only. Tutors can only teach languages from this list. */
export const LANGUAGES = [
  "Arabic", "Chinese (Mandarin)", "Dutch", "English", "French", "German", "Greek",
  "Hebrew", "Hindi", "Italian", "Japanese", "Korean", "Polish", "Portuguese",
  "Russian", "Spanish", "Swahili", "Swedish", "Turkish", "Ukrainian", "Vietnamese",
] as const;
export type Language = (typeof LANGUAGES)[number];

export const LANGUAGE_LEVELS = ["NATIVE", "C2", "C1"] as const;
export type LanguageLevel = (typeof LANGUAGE_LEVELS)[number];

export const ROLES = ["STUDENT", "TUTOR", "ADMIN"] as const;
export type Role = (typeof ROLES)[number];

export const TUTOR_STATUS = ["DRAFT", "SUBMITTED", "APPROVED", "REJECTED"] as const;
export const APPLICATION_STATUS = ["IN_PROGRESS", "SUBMITTED", "APPROVED", "REJECTED"] as const;
export const BOOKING_STATUS = ["PENDING_PAYMENT", "CONFIRMED", "COMPLETED", "CANCELLED"] as const;

export const SESSION_DURATIONS = [30, 45, 60, 90] as const;
export const MIN_HOURLY_RATE_CENTS = 500;
export const MAX_HOURLY_RATE_CENTS = 20_000;

export function isLanguage(value: string): value is Language {
  return (LANGUAGES as readonly string[]).includes(value);
}
