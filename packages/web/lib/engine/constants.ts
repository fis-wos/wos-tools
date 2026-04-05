/**
 * WOS Battle Simulator Constants
 * Copied from packages/data/src/constants.ts
 */

/** Generation-based base ATK/DEF */
export const GS: Record<number, number> = {
  1: 200.16,
  2: 240.19,
  3: 290.23,
  4: 370.29,
  5: 444.35,
  6: 540.43,
  7: 650.52,
  8: 780.62,
  9: 940.75,
  10: 1110.89,
  11: 1281.02,
  12: 1451.16,
};

/** Geronimo exception base stat */
export const JER_GS = 260.20;

/** Exclusive weapon +10 lethality/HP% by generation */
export const GL_WPN: Record<number, number> = {
  1: 50.04,
  2: 60.05,
  3: 72.56,
  4: 92.50,
  5: 111.09,
  6: 133.50,
  7: 160.50,
  8: 193.00,
  9: 232.00,
  10: 277.50,
  11: 320.00,
  12: 362.50,
};

/** Geronimo exception weapon value */
export const JER_GL_WPN = 65.05;

/** Hero gear base value per slot by generation */
export const GL_GEAR: Record<number, number> = {
  1: 21.6,
  2: 25.9,
  3: 31.3,
  4: 39.9,
  5: 47.9,
  6: 57.5,
  7: 70.1,
  8: 84.1,
  9: 100.0,
  10: 119.6,
  11: 137.9,
  12: 156.2,
};

/** Geronimo exception gear base value */
export const JER_GL_GEAR = 28.0;

/** Base ATK addition (Exclusive Killer) */
export const EK = 130;

/** Base DEF addition (Exclusive HP) */
export const EH = 190;

/** Troop type name mapping (Japanese) */
export const TN: Record<string, string> = {
  shield: '盾',
  spear: '槍',
  bow: '弓',
};

/** Troop type CSS color mapping */
export const TC: Record<string, string> = {
  shield: '#4a90d9',
  spear: '#d94a4a',
  bow: '#4ad94a',
};
