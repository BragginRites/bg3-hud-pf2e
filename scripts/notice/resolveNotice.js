const MODULE_ID = 'bg3-hud-pf2e';

function adapterFlags(changes) {
    return changes?.flags?.[MODULE_ID] || null;
}

function hasOwn(obj, key) {
    return !!obj && Object.prototype.hasOwnProperty.call(obj, key);
}

function itemList(actor) {
    const items = actor?.items;
    if (!items) return [];
    if (typeof items.filter === 'function') return items.filter((item) => item);
    if (Array.isArray(items)) return items;
    if (Array.isArray(items.contents)) return items.contents;
    return [];
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
