// Relative, not the usual `/modules/bg3-hud-core/...` form: this file is
// Foundry-free and unit-tested directly under `node --test`, and that
// absolute form only resolves inside a live Foundry runtime.
import { hasOwn, itemList } from '../../../bg3-hud-core/scripts/notice/resolveNotice.js';

const MODULE_ID = 'bg3-hud-pf2e';

function adapterFlags(changes) {
    return changes?.flags?.[MODULE_ID] || null;
}

function isFocusSpell(item) {
    return item?.type === 'spell' && item.system?.traits?.value?.includes('focus');
}

/**
 * System-specific notice. Core unions this with the default.
 * @param {Object} [changes]
 * @param {Object} [actor]
 */
export function resolvePf2eNotice(changes = {}, actor = null) {
    const fills = [];
    const flags = adapterFlags(changes);

    if (hasOwn(flags, 'selectedPassives')) {
        fills.push('passives');
    }
    if (hasOwn(flags, 'useTokenImage')) {
        fills.push('portrait:face');
    }

    let cells;
    if (changes?.system?.resources?.focus !== undefined) {
        fills.push('filter');
        const parked = itemList(actor)
            .filter((item) => isFocusSpell(item) && item.uuid)
            .map((item) => item.uuid);
        if (parked.length) cells = { parked };
    }

    return { fills, extras: [], cells };
}
