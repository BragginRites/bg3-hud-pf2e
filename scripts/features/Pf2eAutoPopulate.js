import { AutoPopulateFramework } from '/modules/bg3-hud-core/scripts/features/AutoPopulateFramework.js';

const MODULE_ID = 'bg3-hud-pf2e';

/**
 * PF2e Auto Populate Implementation
 * Provides PF2e-specific item filtering and population logic
 */
export class Pf2eAutoPopulate extends AutoPopulateFramework {
    /**
     * Get PF2e item type choices (grouped)
     * @returns {Promise<Array<{group: string, choices: Array<{value: string, label: string}>}>>}
     */
    async getItemTypeChoices() {
        return [
            {
                group: game.i18n.localize(`${MODULE_ID}.AutoPopulate.Groups.Combat`),
                choices: [
                    { value: 'weapon', label: game.i18n.localize(`${MODULE_ID}.AutoPopulate.ItemTypes.Weapons`) },
                    { value: 'attack', label: game.i18n.localize(`${MODULE_ID}.AutoPopulate.ItemTypes.Attacks`) },
                    { value: 'action', label: game.i18n.localize(`${MODULE_ID}.AutoPopulate.ItemTypes.Actions`) },
                    { value: 'feat', label: game.i18n.localize(`${MODULE_ID}.AutoPopulate.ItemTypes.Feats`) },
                    { value: 'spell', label: game.i18n.localize(`${MODULE_ID}.AutoPopulate.ItemTypes.Spells`) }
                ]
            },
            {
                group: game.i18n.localize(`${MODULE_ID}.AutoPopulate.Groups.Consumables`),
                choices: [
                    { value: 'consumable', label: game.i18n.localize(`${MODULE_ID}.AutoPopulate.ItemTypes.Consumables`) }
                ]
            },
            {
                group: game.i18n.localize(`${MODULE_ID}.AutoPopulate.Groups.Equipment`),
                choices: [
                    { value: 'equipment', label: game.i18n.localize(`${MODULE_ID}.AutoPopulate.ItemTypes.Equipment`) },
                    { value: 'armor', label: game.i18n.localize(`${MODULE_ID}.AutoPopulate.ItemTypes.Armor`) },
                    { value: 'shield', label: game.i18n.localize(`${MODULE_ID}.AutoPopulate.ItemTypes.Shields`) }
                ]
            },
            {
                group: game.i18n.localize(`${MODULE_ID}.AutoPopulate.Groups.Spellcasting`),
                choices: [
                    { value: 'spell:focus', label: game.i18n.localize(`${MODULE_ID}.AutoPopulate.ItemTypes.FocusSpells`) }
                ]
            }
        ];
    }

    /**
     * Get items from actor that match selected types
     * Includes PF2e-specific filtering (action cost, spell preparation, etc.)
     * @param {Actor} actor - The actor
     * @param {Array<string>} selectedTypes - Selected type values
     * @returns {Promise<Array<{uuid: string}>>}
     */
    async getMatchingItems(actor, selectedTypes) {
        const items = [];

        for (const item of actor.items) {
            // Check if item matches any selected type
            if (!this._matchesType(item, selectedTypes)) {
                continue;
            }

            // For spells, check if they're prepared/available
            if (item.type === 'spell' && !this._isSpellUsable(actor, item)) {
                continue;
            }

            // Check if this is an attack (melee/ranged item with action: strike)
            const isAttack = (item.type === 'melee' || item.type === 'ranged') && item.system?.action === 'strike';
            
            // For actions/feats, check if they have action cost (exclude passives)
            // Attacks are always included regardless of action cost
            if (!isAttack && (item.type === 'action' || item.type === 'feat') && !this._hasActions(item)) {
                continue;
            }

            items.push({ uuid: item.uuid });
        }

        return items;
    }

    /**
     * Check if item matches any of the selected types
     * @param {Item} item - The item to check
     * @param {Array<string>} selectedTypes - Selected type values
     * @returns {boolean}
     * @private
     */
    _matchesType(item, selectedTypes) {
        for (const selectedType of selectedTypes) {
            if (selectedType.includes(':')) {
                // Handle subtype (e.g., "spell:focus")
                const [mainType, subType] = selectedType.split(':');

                if (item.type !== mainType) continue;

                // Check for focus spell trait
                if (subType === 'focus') {
                    const traits = item.system?.traits?.value ?? [];
                    return traits.includes('focus');
                }
            } else {
                // Handle special type: "attack" (melee/ranged items with action: strike)
                if (selectedType === 'attack') {
                    return (item.type === 'melee' || item.type === 'ranged') && item.system?.action === 'strike';
                }
                
                // Handle main type (e.g., "weapon", "feat", "spell")
                if (item.type === selectedType) return true;
            }
        }
        return false;
    }

    /**
     * Check if spell is usable (prepared, spontaneous, etc.)
     * @param {Actor} actor - The actor
     * @param {Item} item - The spell item
     * @returns {boolean}
     * @private
     */
    _isSpellUsable(actor, item) {
        // PF2e spells are usable if they're in a spellcasting entry
        // For now, include all spells - the system handles preparation
        return true;
    }

    /**
     * Check if item has actions (action cost > 0)
     * @param {Item} item - The item to check
     * @returns {boolean}
     * @private
     */
    _hasActions(item) {
        const actionCost = item.system?.actions?.value ?? 0;
        return actionCost > 0;
    }
}

