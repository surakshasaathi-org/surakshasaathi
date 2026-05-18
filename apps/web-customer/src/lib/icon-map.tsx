import {
  Activity,
  Briefcase,
  FileWarning,
  Heart,
  Languages,
  MapPin,
  ShieldCheck,
  Users,
  type LucideIcon,
} from 'lucide-react';

/**
 * Map `product_module.iconSlug` to lucide-react icons. Slug values are in the seed data.
 * Adding a new module with a new icon = append a slug→component pair here OR reuse one.
 */
const MAP: Record<string, LucideIcon> = {
  'shield-check': ShieldCheck,
  activity: Activity,
  'map-pin': MapPin,
  users: Users,
  languages: Languages,
  briefcase: Briefcase,
  heart: Heart,
  'file-warning': FileWarning,
};

export function iconFor(slug: string | null | undefined, fallback: LucideIcon = ShieldCheck) {
  if (!slug) return fallback;
  return MAP[slug] ?? fallback;
}
