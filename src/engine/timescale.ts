/**
 * One clock for the whole simulation.
 *
 * Every long process in the engine had its own implicit idea of how long an age
 * is — the supercontinent period in `cycles.ts`, the Wilson drive's own copy of
 * it, the denudation rate's comment about the Appalachians — and nothing tied
 * them together, so any one could drift out of step with the rest without
 * anything noticing. They are expressed here in millions of years and converted
 * to ages in one place.
 *
 * The map is read as a scaled planet (CHANGES.md §33): at 40,000 km a 129 tile
 * is about 310 km, Earth's plates cover about 1.5 tiles in ten million years,
 * and that is what the default drift of 4 produces. So an age is ten million
 * years, and the constants below are Earth's.
 */

export const MYR_PER_AGE = 10;

export const ages = (myr: number) => myr / MYR_PER_AGE;

/**
 * Supercontinent cycle: assembly, break-up and reassembly. Earth's is 400 to
 * 600 million years (Rodinia to Pangaea to the next). The short end keeps two
 * full cycles inside a hundred-age history.
 */
export const SUPERCONTINENT_MYR = 400;
export const SUPERCONTINENT_AGES = ages(SUPERCONTINENT_MYR);

/**
 * Icehouse and greenhouse eras.
 *
 * At ten million years an age, a single glacial cycle (about 100 thousand
 * years) cannot be resolved — but whether the planet is in an ice age at all
 * can, and that state persists for tens of millions of years. Earth's
 * Phanerozoic record is mostly greenhouse, broken by a few long icehouses: the
 * Late Ordovician, the Late Paleozoic (about 100 Myr) and the present Cenozoic
 * one (34 Myr so far). Roughly a third of the time has been icehouse.
 *
 * Sampling the glacial state independently every age, as the engine did,
 * flipped the planet between ice age and hothouse every ten million years,
 * which no part of the record shows.
 */
export const GREENHOUSE_MYR = { min: 60, max: 140 };
export const ICEHOUSE_MYR = { min: 30, max: 80 };
