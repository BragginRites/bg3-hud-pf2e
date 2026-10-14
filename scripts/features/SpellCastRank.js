/**
 * Pure decision logic for picking which rank/slot a PF2e spell should be
 * cast at, plus the shared slot-iteration helper it (and several display
 * code paths in Pf2eAdapter) depend on.
 *
 * Nothing here touches `game`/`ui`/`canvas` or calls `entry.cast()` - callers
 * gather the plain slot/tradition data from a live spellcasting entry, pass
 * it in, and use the returned cast options to actually invoke `entry.cast()`.
 */

/** Highest spell rank in PF2e (0 = cantrips through 10). */
export const MAX_SPELL_RANK = 10;

/**
 * Iterate the prepared-spell slots of a PF2e spellcasting entry.
 * Walks ranks 0..MAX_SPELL_RANK and yields each occupied preparation with its
 * real slot id. PF2e may store `prepared` as an array OR as an object keyed by
 * slot index - Object.values() alone loses those keys and breaks entry.cast().
 * @param {Object} slots - `entry.system.slots` (keyed `slot0`..`slot10`)
 * @yields {{rank: number, slotId: number, prep: Object}}
 */
export function* iteratePreparedSlots(slots) {
    if (!slots) return;
    for (let rank = 0; rank <= MAX_SPELL_RANK; rank++) {
        const preparedList = slots[`slot${rank}`]?.prepared;
        if (!preparedList) continue;

        if (Array.isArray(preparedList)) {
            for (let slotId = 0; slotId < preparedList.length; slotId++) {
                const prep = preparedList[slotId];
                if (prep) yield { rank, slotId, prep };
            }
        } else {
            for (const [key, prep] of Object.entries(preparedList)) {
                if (!prep) continue;
                const slotId = Number(key);
                yield { rank, slotId: Number.isFinite(slotId) ? slotId : key, prep };
            }
        }
    }
}

/**
 * Summarize a prepared caster's preparations of a specific spell across all
 * slot ranks: how many times it's prepared in total, how many of those are
 * still usable (not expended), and the first (lowest) rank it's prepared at.
 * Shared by display code paths that need a prepared spell's uses/level info
 * without duplicating the `iteratePreparedSlots` scan.
 * @param {Object} params
 * @param {Object} params.slots - `entry.system.slots` (keyed `slot0`..`slot10`)
 * @param {string} params.spellId - The spell item's id to match preparations against
 * @returns {{rank: number|null, totalPreps: number, remainingCasts: number}}
 *   `rank` is the first (lowest) rank the spell is prepared at, or `null` if
 *   it isn't prepared anywhere. Callers that need an expended count can
 *   derive it as `totalPreps - remainingCasts`.
 */
export function summarizePreparedSpell({ slots, spellId }) {
    let rank = null;
    let totalPreps = 0;
    let remainingCasts = 0;

    for (const { rank: slotRank, prep } of iteratePreparedSlots(slots)) {
        if (prep?.id !== spellId) continue;
        if (rank === null) rank = slotRank;
        totalPreps++;
        if (!prep.expended) remainingCasts++;
    }

    return { rank, totalPreps, remainingCasts };
}

/**
 * Decide which rank (and, for prepared casters, which real slot id) a spell
 * should be cast at, given a plain/readonly view of its spellcasting entry's
 * tradition and slot data.
 *
 * - Prepared casters: find the FIRST non-expended slot that holds this spell
 *   (uses real slot ids so heightened ranks consume correctly). Returns
 *   `null` if every preparation of this spell has been expended.
 * - Spontaneous/innate casters: cast at the highest affordable rank at or
 *   above the spell's base rank that still has an available slot, so a
 *   heightened-into-a-higher-slot spell casts at that higher rank; otherwise
 *   falls back to the base rank.
 *
 * @param {Object} params
 * @param {string|undefined} params.tradition - `entry.system.prepared.value`
 *   (e.g. 'prepared', 'spontaneous', 'innate', 'focus')
 * @param {Object} params.slots - `entry.system.slots` (keyed `slot0`..`slot10`)
 * @param {string} params.itemId - The spell item's id, used to find its own
 *   preparation among a prepared caster's slots
 * @param {number} params.baseRank - The spell's own rank/level, used as the
 *   floor rank for spontaneous/innate casting
 * @returns {{rank: number, slotId?: number, consume: true} | null} Cast
 *   options to pass straight to `entry.cast(item, options)`, or `null` when
 *   a prepared caster has no remaining (non-expended) slot for this spell.
 */
export function resolveCastRank({ tradition, slots, itemId, baseRank }) {
    if (tradition === 'prepared') {
        for (const { rank, slotId, prep } of iteratePreparedSlots(slots)) {
            if (prep?.id === itemId && !prep.expended) {
                return { rank, slotId, consume: true };
            }
        }
        // All slots expended
        return null;
    }

    // Spontaneous/innate: cast at the highest affordable rank when the spell
    // was heightened into a higher slot, else base rank.
    let castRank = baseRank;
    for (let r = MAX_SPELL_RANK; r >= baseRank; r--) {
        const slot = slots?.[`slot${r}`];
        if (slot && (slot.value ?? 0) > 0) {
            castRank = r;
            break;
        }
    }
    return { rank: castRank, consume: true };
}
