/**
 * Shared PF2e weapon-handedness / managed-equipment rules.
 *
 * Pure, side-effect-free helpers used by both Pf2eAdapter (scripts/module.js)
 * and Pf2eWeaponSetContainer so the "is this item gear the weapon-set should
 * manage" and "how many hands does this weapon occupy" rules live in exactly
 * one place instead of being reimplemented in each file.
 */

/**
 * Whether this item is gear the weapon-set equip-sync should manage
 * (its carryType/handsHeld/inSlot should track grid slot membership).
 * - weapon/shield: always managed
 * - equipment: managed only if its usage mentions "hand" (e.g. held-in-one-hand)
 *   or it carries the "implement" trait
 * @param {Item} item
 * @returns {boolean}
 */
export function isManagedEquipment(item) {
    if (!item) return false;
    if (item.type === 'weapon' || item.type === 'shield') return true;
    if (item.type === 'equipment') {
        const usage = item.system?.usage?.value || '';
        if (typeof usage === 'string' && usage.includes('hand')) return true;
        const traits = item.system?.traits?.value || [];
        return Array.isArray(traits) && traits.includes('implement');
    }
    return false;
}

/**
 * Whether this item is natively two-handed: its usage is "held-in-two-hands"
 * (e.g. Maul) or its `hands` field is literally '2'. Distinct from
 * {@link isTwoHanded}, which checks for the "two-hand-dX" trait (e.g. War Axe)
 * that only *defaults* to a two-handed grip rather than requiring one.
 * @param {Item} item
 * @returns {boolean}
 */
export function isNativeTwoHanded(item) {
    if (!item) return false;
    return item.system?.usage?.value === 'held-in-two-hands' || item.hands === '2';
}

/**
 * Whether this item carries a "two-hand-dX" trait (e.g. War Axe) - the trait
 * that lets a weapon default to a two-handed grip even though it is not
 * natively two-hand-only (usage "held-in-two-hands", e.g. Maul).
 * @param {Item} item
 * @returns {boolean}
 */
export function isTwoHanded(item) {
    if (!item) return false;
    const traits = item.system?.traits?.value ?? [];
    return Array.isArray(traits) && traits.some(
        (trait) => typeof trait === 'string' && trait.startsWith('two-hand')
    );
}

/**
 * Real trait-aware hands-held computation for a weapon.
 * - Native 2H-only usage (Maul) or `hands === '2'`: always 2
 * - Already explicitly gripped 2H (`system.equipped.handsHeld === 2`): 2
 * - Two-hand-trait weapon (War Axe) not explicitly gripped 1H: defaults to 2
 * - Otherwise: 1
 * Non-weapon managed equipment (shields, implements) is always 1.
 * @param {Item} item
 * @returns {number} 0 if item is falsy, otherwise 1 or 2
 */
export function getHandsHeld(item) {
    if (!item) return 0;
    if (item.type !== 'weapon') return 1;

    if (isNativeTwoHanded(item)) return 2;

    const current = Number(item.system?.equipped?.handsHeld) || 0;
    if (current === 2) return 2;

    if (isTwoHanded(item) && current !== 1) return 2;

    return 1;
}
