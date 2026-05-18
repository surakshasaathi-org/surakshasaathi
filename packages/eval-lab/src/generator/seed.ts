import seedrandom from 'seedrandom';
import { Faker, en, en_IN } from '@faker-js/faker';

/**
 * Construct a Faker instance bound to a deterministic PRNG. Two callers
 * with the same `seed` get identical sequences forever — the synthetic
 * dataset's regeneration guarantee depends on this.
 *
 * We layer en_IN over en so Indian names + addresses + phone formats win
 * for fields where they're available, falling back to en otherwise.
 */
export function seededFaker(seed: number): Faker {
  const prng = seedrandom(String(seed));
  const faker = new Faker({ locale: [en_IN, en] });
  // faker exposes its internal mersenne via faker.seed(); but the simplest
  // way to bind a custom PRNG is to monkey-patch its random source. v9's
  // public API doesn't expose this, so we route through `faker.seed(int)`
  // with a deterministic int derived from our seedrandom stream.
  faker.seed(Math.floor(prng() * 2 ** 32));
  return faker;
}

/**
 * Derive a stable per-case integer seed from a dataset seed + case index.
 * Pure function; same inputs → same output forever. Used to give each
 * generated golden case its own seed so editing one case doesn't cascade.
 */
export function caseSeed(datasetSeed: number, caseIndex: number): number {
  // Avalanche-style mixing — small input changes propagate. Avoids
  // adjacent caseIndex values producing nearly-identical outputs from
  // Faker's default Mersenne sequence.
  let h = datasetSeed | 0;
  h = Math.imul(h ^ (caseIndex | 0), 2654435761);
  h ^= h >>> 16;
  h = Math.imul(h, 0x45d9f3b);
  h ^= h >>> 16;
  return h >>> 0;
}
