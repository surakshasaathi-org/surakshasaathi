import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type * as schema from '../schema';

type Db = NodePgDatabase<typeof schema>;

export async function seedLocales(db: Db, s: typeof schema) {
  const rows = [
    { code: 'en' as const, nativeName: 'English', englishName: 'English', scriptFamily: 'Latin', rtl: false, launchPhase: 1, enabled: true },
    { code: 'hi' as const, nativeName: 'हिन्दी', englishName: 'Hindi', scriptFamily: 'Devanagari', rtl: false, launchPhase: 1, enabled: true },
    { code: 'kn' as const, nativeName: 'ಕನ್ನಡ', englishName: 'Kannada', scriptFamily: 'Kannada', rtl: false, launchPhase: 1, enabled: true },
    { code: 'ta' as const, nativeName: 'தமிழ்', englishName: 'Tamil', scriptFamily: 'Tamil', rtl: false, launchPhase: 1, enabled: false },
    { code: 'te' as const, nativeName: 'తెలుగు', englishName: 'Telugu', scriptFamily: 'Telugu', rtl: false, launchPhase: 1, enabled: false },
    { code: 'bn' as const, nativeName: 'বাংলা', englishName: 'Bengali', scriptFamily: 'Bengali', rtl: false, launchPhase: 1, enabled: false },
    { code: 'mr' as const, nativeName: 'मराठी', englishName: 'Marathi', scriptFamily: 'Devanagari', rtl: false, launchPhase: 2, enabled: false },
    { code: 'gu' as const, nativeName: 'ગુજરાતી', englishName: 'Gujarati', scriptFamily: 'Gujarati', rtl: false, launchPhase: 2, enabled: false },
    { code: 'ml' as const, nativeName: 'മലയാളം', englishName: 'Malayalam', scriptFamily: 'Malayalam', rtl: false, launchPhase: 2, enabled: false },
    { code: 'pa' as const, nativeName: 'ਪੰਜਾਬੀ', englishName: 'Punjabi', scriptFamily: 'Gurmukhi', rtl: false, launchPhase: 3, enabled: false },
    { code: 'or' as const, nativeName: 'ଓଡ଼ିଆ', englishName: 'Odia', scriptFamily: 'Odia', rtl: false, launchPhase: 3, enabled: false },
    { code: 'as' as const, nativeName: 'অসমীয়া', englishName: 'Assamese', scriptFamily: 'Bengali', rtl: false, launchPhase: 3, enabled: false },
    { code: 'ur' as const, nativeName: 'اردو', englishName: 'Urdu', scriptFamily: 'Arabic', rtl: true, launchPhase: 3, enabled: false },
  ];
  await db.insert(s.localeMeta).values(rows).onConflictDoNothing();
  console.log(`[seed] locales: ${rows.length}`);
}
