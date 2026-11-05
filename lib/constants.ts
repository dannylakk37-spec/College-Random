export const BRAND = {
  name: 'CollegeRandom',
  tagline: 'Random Chats. Real College Students.',
  domain: 'CollegeRandom.com',
};

export const REPORT_REASONS = [
  { value: 'nudity_sexual', label: 'Nudity or sexual content' },
  { value: 'harassment', label: 'Harassment or bullying' },
  { value: 'hate_speech', label: 'Hate speech or slurs' },
  { value: 'underage', label: 'Appears to be under 18' },
  { value: 'not_a_student', label: 'Not a college student' },
  { value: 'violence_threats', label: 'Violence or threats' },
  { value: 'spam_scam', label: 'Spam, scam or advertising' },
  { value: 'other', label: 'Something else' },
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number]['value'];

export const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ageFromDob(dob: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob);
  if (!m) return null;
  const birth = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  const beforeBirthday =
    now.getUTCMonth() < birth.getUTCMonth() ||
    (now.getUTCMonth() === birth.getUTCMonth() && now.getUTCDate() < birth.getUTCDate());
  if (beforeBirthday) age--;
  return age;
}
