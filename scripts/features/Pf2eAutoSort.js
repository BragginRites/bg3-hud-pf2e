import { AutoSortFramework } from '/modules/bg3-hud-core/scripts/features/AutoSortFramework.js';

/**
 * PF2e Auto Sort Implementation
 * Provides PF2e-specific item sorting logic
 */
export class Pf2eAutoSort extends AutoSortFramework {
    /**
     * Enrich items with PF2e-specific sort data
     * @param {Array<Object>} items - Array of items to enrich
     * @returns {Promise<void>}
     */
    async enrichItemsForSort(items) {
        for (const item of items) {
            try {
                if (!item.uuid) continue;
                const itemData = await fromUuid(item.uuid);
                if (itemData) {
                    // Store basic data
                    item.name = itemData.name;
                    item.type = itemData.type;

                    // Build PF2e-specific sort data
                    // Cantrips (with 'cantrip' trait) should sort as rank 0 (first)
                    const isCantrip = itemData.system?.traits?.value?.includes('cantrip');
                    item.sortData = {
                        name: itemData.name,
                        type: itemData.type,
                        actionCost: this._getActionCost(itemData),
                        spellLevel: itemData.type === 'spell'
                            ? (isCantrip ? 0 : (itemData.system?.level?.value ?? 99))
                            : 99,
                        featType: itemData.type === 'feat' ? (itemData.system?.category ?? '') : ''
                    };
                } else {
                    // Fallback if item not found
                    item.sortData = {
                        name: item.name || '',
                        type: item.type || '',
                        actionCost: 0,
                        spellLevel: 99,
                        featType: ''
                    };
                }
            } catch (error) {
                console.warn(`BG3 HUD PF2e | Failed to fetch item data for ${item.uuid}:`, error);
                item.sortData = {
                    name: item.name || '',
                    type: item.type || '',
                    actionCost: 0,
                    spellLevel: 99,
                    featType: ''
                };
            }
        }
    }

    /**
     * Sort items using PF2e priority rules
     * Priority: weapon > action > feat > spell > consumable > equipment
     * @param {Array<Object>} items - Array of items to sort in place
     * @returns {Promise<void>}
     */
    async sortItems(items) {
        // Define PF2e item type order (first to last)
        const typeOrder = ['weapon', 'melee', 'action', 'feat', 'spell', 'consumable', 'ammo', 'equipment', 'armor', 'shield', 'backpack'];

        items.sort((a, b) => {
            // First, sort by item type according to our defined order
            const typeIndexA = typeOrder.indexOf(a.type);
            const typeIndexB = typeOrder.indexOf(b.type);

            // Handle different type priorities
            if (typeIndexA !== typeIndexB) {
                if (typeIndexA === -1) return 1;  // Unknown types go to the end
                if (typeIndexB === -1) return -1;
                return typeIndexA - typeIndexB;
            }

            // Then apply PF2e type-specific sorting
            switch (a.type) {
                case 'spell':
                    // Sort by spell level first (1-10)
                    const levelA = a.sortData?.spellLevel ?? 99;
                    const levelB = b.sortData?.spellLevel ?? 99;
                    if (levelA !== levelB) {
                        return levelA - levelB;
                    }
                    // If same level, sort alphabetically
                    return (a.name || a.sortData?.name || '').localeCompare(b.name || b.sortData?.name || '');

                case 'action':
                case 'feat':
                    // Sort by action cost first (1, 2, 3)
                    const costA = a.sortData?.actionCost ?? 0;
                    const costB = b.sortData?.actionCost ?? 0;
                    if (costA !== costB) {
                        return costA - costB;
                    }
                    // If same action cost, sort alphabetically
                    return (a.name || a.sortData?.name || '').localeCompare(b.name || b.sortData?.name || '');

                default:
                    // All other items sort alphabetically within their type
                    return (a.name || a.sortData?.name || '').localeCompare(b.name || b.sortData?.name || '');
            }
        });
    }

    /**
     * Normalize action cost across PF2e items
     * @param {Item} itemData - The item
     * @returns {number}
     * @private
     */
    _getActionCost(itemData) {
        const rawCost = itemData.system?.actions?.value ?? itemData.system?.actionCost?.value ?? 0;
        const parsedCost = Number(rawCost);

        if (Number.isFinite(parsedCost) && parsedCost > 0) {
            return parsedCost;
        }

        const actionType = itemData.system?.actionType?.value;
        if (actionType === 'reaction') {
            return 0.5;
        }
        if (actionType === 'free') {
            return 0;
        }

        return 0;
    }
}

