import { AutoSortFramework, compareByTypeThenKey } from '/modules/bg3-hud-core/scripts/features/AutoSortFramework.js';
import { createLogger } from '/modules/bg3-hud-core/scripts/utils/logger.js';

const log = createLogger('bg3-hud-pf2e');

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
                log.warn(`Failed to fetch item data for ${item.uuid}:`, error);
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

        // Secondary tie-break within a type: spells by level (1-10), actions/feats by
        // action cost (1, 2, 3). Every other type falls straight through to name.
        const secondaryKeyFns = {
            spell: (item) => item.sortData?.spellLevel ?? 99,
            action: (item) => item.sortData?.actionCost ?? 0,
            feat: (item) => item.sortData?.actionCost ?? 0
        };

        items.sort(compareByTypeThenKey(typeOrder, secondaryKeyFns, {
            getName: (item) => item.name || item.sortData?.name || ''
        }));
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

