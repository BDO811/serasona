import { normalisePhone } from "./voice-checkin-client";
export const AGE_OPTIONS = { under30: "Under 30", "30-45": "30 to 45", "46-60": "46 to 60", "60+": "60 and over" };
export interface AccountProfile { fullName: string; phoneNumber: string; biologicalSex: string; ageRange: string }
export function validateProfile(profile: AccountProfile): AccountProfile {
  const fullName = profile.fullName.trim();
  if (!fullName || fullName.length > 120) throw new Error("Enter your name using 1 to 120 characters.");
  const phoneNumber = profile.phoneNumber.trim() ? normalisePhone(profile.phoneNumber) : "";
  if (phoneNumber === null) throw new Error("Enter a valid phone number, including the country code outside the US.");
  if (profile.biologicalSex && !["male", "female"].includes(profile.biologicalSex)) throw new Error("Choose a listed biological sex option.");
  if (profile.ageRange && !(profile.ageRange in AGE_OPTIONS)) throw new Error("Choose a listed age range.");
  return { fullName, phoneNumber, biologicalSex: profile.biologicalSex, ageRange: profile.ageRange };
}
