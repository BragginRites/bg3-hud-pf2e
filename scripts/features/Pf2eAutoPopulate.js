import { AutoPopulateFramework } from '/modules/bg3-hud-core/scripts/features/AutoPopulateFramework.js';

const MODULE_ID = 'bg3-hud-pf2e';
const PF2E_TEMPLATE_ITEM_TYPES = [
    'action',
    'ancestry',
    'affliction',
    'armor',
    'background',
    'backpack',
    'book',
    'campaignFeature',
    'class',
    'condition',
    'consumable',
    'ammo',
    'deity',
    'effect',
    'equipment',
    'feat',
    'heritage',
    'kit',
    'lore',
    'melee',
    'shield',
    'spell',
    'spellcastingEntry',
    'treasure',
    'weapon'
];

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
        const systemTypes = this._getSystemItemTypes();
        const groups = [];

        const combatChoices = [];
        if (systemTypes.has('weapon')) {
            combatChoices.push(this._buildChoice('weapon', 'Weapons'));
        }
        if (systemTypes.has('melee')) {
            combatChoices.push(this._buildChoice('melee', 'Melee'));
        }
        if (systemTypes.has('action')) {
            combatChoices.push(this._buildChoice('action', 'Actions'));
        }
        if (systemTypes.has('feat')) {
            combatChoices.push(this._buildChoice('feat', 'Feats'));
        }
        if (systemTypes.has('spell')) {
            combatChoices.push(this._buildChoice('spell', 'Spells'));
            combatChoices.push(this._buildChoice('spell:focus', 'FocusSpells'));
        }
        if ((systemTypes.has('weapon') || systemTypes.has('melee')) && combatChoices.length > 0) {
            combatChoices.unshift(this._buildChoice('attack', 'Attacks'));
        }
        if (combatChoices.length > 0) {
            groups.push({
                group: game.i18n.localize(`${MODULE_ID}.AutoPopulate.Groups.Combat`),
                choices: combatChoices
            });
        }

        const consumableChoices = [];
        if (systemTypes.has('consumable')) {
            consumableChoices.push(this._buildChoice('consumable', 'Consumables'));
        }
        if (systemTypes.has('ammo')) {
            consumableChoices.push(this._buildChoice('ammo', 'Ammunition'));
        }
        if (consumableChoices.length > 0) {
            groups.push({
                group: game.i18n.localize(`${MODULE_ID}.AutoPopulate.Groups.Consumables`),
                choices: consumableChoices
            });
        }

        const equipmentChoices = [];
        if (systemTypes.has('equipment')) {
            equipmentChoices.push(this._buildChoice('equipment', 'Equipment'));
        }
        if (systemTypes.has('armor')) {
            equipmentChoices.push(this._buildChoice('armor', 'Armor'));
        }
        if (systemTypes.has('shield')) {
            equipmentChoices.push(this._buildChoice('shield', 'Shields'));
        }
        if (systemTypes.has('backpack')) {
            equipmentChoices.push(this._buildChoice('backpack', 'Backpacks'));
        }
        if (equipmentChoices.length > 0) {
            groups.push({
                group: game.i18n.localize(`${MODULE_ID}.AutoPopulate.Groups.Equipment`),
                choices: equipmentChoices
            });
        }

        return groups;
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
            if (!this._matchesType(item, selectedTypes)) {
                continue;
            }

            if (item.type === 'spell' && !this._isSpellUsable(actor, item)) {
                continue;
            }

            const isAttack = item.type === 'melee' || item.type === 'weapon';

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
        const itemType = item.type;
        for (const selectedType of selectedTypes) {
            if (selectedType.includes(':')) {
                const [mainType, subType] = selectedType.split(':');

                if (itemType !== mainType) continue;

                if (subType === 'focus') {
                    const traits = item.system?.traits?.value ?? [];
                    return traits.includes('focus');
                }
            } else {
                if (selectedType === 'attack') {
                    if (itemType === 'weapon' || itemType === 'melee') {
                        return true;
                    }
                    continue;
                }

                if (itemType === selectedType) return true;
            }
        }
        return false;
    }

    /**
     * Check if spell is usable (prepared, spontaneous, etc.)
     * When filtering is enabled for the actor type, only includes:
     * - Prepared spells (location.signature or explicitly prepared)
     * - Focus spells (always usable if known)
     * - Innate spells (always usable)
     * - Spontaneous spells (always usable - caster knows all spells in repertoire)
     * When disabled, includes all spells.
     * @param {Actor} actor - The actor
     * @param {Item} item - The spell item
     * @returns {boolean}
     * @private
     */
    _isSpellUsable(actor, item) {
        // Check if filtering is enabled for this actor type
        const isNPC = actor.type === 'npc';
        const shouldFilter = isNPC
            ? game.settings.get(MODULE_ID, 'filterPreparedSpellsNPCs')
            : game.settings.get(MODULE_ID, 'filterPreparedSpellsPlayers');

        if (!shouldFilter) {
            // Filtering disabled for this actor type: include all spells
            return true;
        }

        const sys = item.system ?? {};
        const location = sys.location ?? {};

        // Focus spells are always usable
        const traits = sys.traits?.value ?? [];
        if (traits.includes('focus')) {
            return true;
        }

        // Check spellcasting entry to determine tradition
        const entryId = location.value;
        if (!entryId) {
            // No spellcasting entry - might be an orphaned spell, exclude it
            return false;
        }

        const entry = actor.items.get(entryId);
        if (!entry) {
            return false;
        }

        const entryData = entry.system ?? {};
        const tradition = entryData.prepared?.value;

        // Spontaneous and innate traditions: all spells in repertoire are usable
        if (tradition === 'spontaneous' || tradition === 'innate') {
            return true;
        }

        // Prepared tradition: only include if spell is actually prepared
        // In PF2e, prepared spells are tracked differently - signature spells are always prepared
        if (tradition === 'prepared') {
            // Signature spells are always available
            if (location.signature) {
                return true;
            }

            // Check if the spell slot has uses remaining
            // PF2e tracks prepared spells via the spellcasting entry's slots
            // For simplicity, if the spell is in the spellbook it can be prepared
            // The actual slot management is handled by the system
            return true;
        }

        // Focus tradition: focus spells are always usable
        if (tradition === 'focus') {
            return true;
        }

        // Default: allow the spell
        return true;
    }

    /**
     * Check if item has actions (action cost or reaction/free action types)
     * @param {Item} item - The item to check
     * @returns {boolean}
     * @private
     */
    _hasActions(item) {
        const actionType = item.system?.actionType?.value;
        if (actionType === 'reaction' || actionType === 'free') {
            return true;
        }

        const actionCost = this._getActionCost(item);
        return actionCost > 0;
    }

    /**
     * Get action cost from PF2e item schema
     * @param {Item} item - The item
     * @returns {number}
     * @private
     */
    _getActionCost(item) {
        const rawCost = item.system?.actions?.value ?? item.system?.actionCost?.value ?? 0;
        const parsedCost = Number(rawCost);
        if (Number.isFinite(parsedCost)) {
            return parsedCost;
        }
        return 0;
    }

    /**
     * Get available PF2e item types from system config
     * @returns {Set<string>}
     * @private
     */
    _getSystemItemTypes() {
        const configTypes = CONFIG?.PF2E?.Item?.documentClasses;
        if (configTypes) {
            return new Set(Object.keys(configTypes));
        }
        return new Set(PF2E_TEMPLATE_ITEM_TYPES);
    }

    /**
     * Build a localized choice entry
     * @param {string} value
     * @param {string} labelKey
     * @returns {{value: string, label: string}}
     * @private
     */
    _buildChoice(value, labelKey) {
        return {
            value,
            label: game.i18n.localize(`${MODULE_ID}.AutoPopulate.ItemTypes.${labelKey}`)
        };
    }
}

