/**
 * Shared PF2e shield/cover classification rule.
 *
 * Pure, side-effect-free helper extracted out of ShieldCoverService so the
 * "which cover tier does this shield grant" decision can be unit tested in
 * isolation from the actor-mutating effect-application logic (and from that
 * service's Foundry-global dependencies).
 */

/**
 * Classify a (possibly absent) shield into the cover tier it grants: tower
 * shields (identified by baseItem or the "tower"/"tower-shield" trait) grant
 * greater cover, any other (or missing) shield grants standard cover.
 * @param {Item|null|undefined} shield
 * @returns {{bonus: number, level: 'greater'|'standard', isTowerShield: boolean}}
 */
export function classifyShieldCover(shield) {
    const baseItem = shield?.system?.baseItem ?? '';
    const hasTowerTrait = !!shield?.system?.traits?.value?.some?.((t) => t === 'tower' || t === 'tower-shield');
    const isTowerShield = hasTowerTrait || ['tower-shield', 'fortress-shield'].includes(baseItem);
    const coverSelection = isTowerShield ? { bonus: 4, level: 'greater' } : { bonus: 2, level: 'standard' };
    return { ...coverSelection, isTowerShield };
}
