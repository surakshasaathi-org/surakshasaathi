import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type * as schema from '../schema';

type Db = NodePgDatabase<typeof schema>;

/**
 * Day-1 insurance lines. NEW LINES = row inserts, never code changes.
 * See CLAUDE.md section 4 and ADR-0003.
 */
export async function seedInsuranceLines(db: Db, s: typeof schema) {
  const rows = [
    {
      id: 'health',
      displayNameI18n: { en: 'Health Insurance', hi: 'स्वास्थ्य बीमा', kn: 'ಆರೋಗ್ಯ ವಿಮೆ' },
      category: 'general',
      enabled: true,
      orderIndex: 10,
    },
    {
      id: 'life',
      displayNameI18n: { en: 'Life Insurance', hi: 'जीवन बीमा', kn: 'ಜೀವ ವಿಮೆ' },
      category: 'life',
      enabled: true,
      orderIndex: 20,
    },
    {
      id: 'motor',
      displayNameI18n: { en: 'Motor Insurance', hi: 'मोटर बीमा', kn: 'ವಾಹನ ವಿಮೆ' },
      category: 'general',
      enabled: true,
      orderIndex: 30,
    },
    {
      id: 'property',
      displayNameI18n: { en: 'Property Insurance', hi: 'संपत्ति बीमा', kn: 'ಆಸ್ತಿ ವಿಮೆ' },
      category: 'general',
      enabled: true,
      orderIndex: 40,
    },
    {
      id: 'travel',
      displayNameI18n: { en: 'Travel Insurance', hi: 'यात्रा बीमा', kn: 'ಪ್ರಯಾಣ ವಿಮೆ' },
      category: 'general',
      enabled: true,
      orderIndex: 50,
    },
    {
      id: 'cyber',
      displayNameI18n: { en: 'Cyber Insurance', hi: 'साइबर बीमा', kn: 'ಸೈಬರ್ ವಿಮೆ' },
      category: 'commercial',
      enabled: true,
      orderIndex: 60,
    },
    {
      id: 'group-health',
      displayNameI18n: { en: 'Group Health', hi: 'सामूहिक स्वास्थ्य', kn: 'ಗುಂಪು ಆರೋಗ್ಯ' },
      category: 'commercial',
      enabled: true,
      orderIndex: 70,
    },
    {
      id: 'fire',
      displayNameI18n: { en: 'Fire & Property', hi: 'अग्नि एवं संपत्ति', kn: 'ಬೆಂಕಿ ಮತ್ತು ಆಸ್ತಿ' },
      category: 'commercial',
      enabled: true,
      orderIndex: 80,
    },
    {
      id: 'public-liability',
      displayNameI18n: { en: 'Public Liability', hi: 'सार्वजनिक दायित्व', kn: 'ಸಾರ್ವಜನಿಕ ಹೊಣೆಗಾರಿಕೆ' },
      category: 'commercial',
      enabled: true,
      orderIndex: 90,
    },
    {
      id: 'key-man',
      displayNameI18n: { en: 'Key Man Life', hi: 'की-मैन जीवन', kn: 'ಕೀ-ಮ್ಯಾನ್ ಜೀವ' },
      category: 'commercial',
      enabled: true,
      orderIndex: 100,
    },
    {
      id: 'marine',
      displayNameI18n: { en: 'Marine', hi: 'समुद्री', kn: 'ಸಾಗರ' },
      category: 'commercial',
      enabled: false,
      orderIndex: 110,
    },
    {
      id: 'crop',
      displayNameI18n: { en: 'Crop Insurance', hi: 'फसल बीमा', kn: 'ಬೆಳೆ ವಿಮೆ' },
      category: 'general',
      enabled: false,
      orderIndex: 120,
    },
    {
      id: 'pet',
      displayNameI18n: { en: 'Pet Insurance', hi: 'पालतू पशु बीमा', kn: 'ಸಾಕುಪ್ರಾಣಿ ವಿಮೆ' },
      category: 'general',
      enabled: false,
      orderIndex: 130,
    },
  ];
  await db.insert(s.insuranceLine).values(rows).onConflictDoNothing();
  console.log(`[seed] insurance lines: ${rows.length}`);
}
