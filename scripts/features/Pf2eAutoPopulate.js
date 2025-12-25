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
     * Note: "Actions" combines strikes, action items, and feats with action costs
     * @returns {Promise<Array<{group: string, choices: Array<{value: string, label: string}>}>>}
     */
    async getItemTypeChoices() {
        const systemTypes = this._getSystemItemTypes();
        const groups = [];

        // Combat choices - "Actions" combines all usable combat things
        const combatChoices = [];
        // "Actions" includes: strikes from actor.system.actions + action items + feats with action costs
        combatChoices.push(this._buildChoice('actions', 'Actions'));
        if (systemTypes.has('spell')) {
            combatChoices.push(this._buildChoice('spell', 'Spells'));
            combatChoices.push(this._buildChoice('spell:focus', 'FocusSpells'));
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
     * For 'actions' type, gets weapon items (for strikes) + action items + feats with action costs
     * For prepared spells, creates individual cells per preparation slot
     * For other types, uses item filtering
     * @param {Actor} actor - The actor
     * @param {Array<string>} selectedTypes - Selected type values
     * @returns {Promise<Array<Object>>} Array of cell data objects
     */
    async getMatchingItems(actor, selectedTypes) {
        const items = [];
        const includeActions = selectedTypes.includes('actions');
        const includeSpells = selectedTypes.includes('spell');
        const includeFocusSpells = selectedTypes.includes('spell:focus');
        const addedUuids = new Set(); // Track to avoid duplicates
        const addedPreparedSlots = new Set(); // Track prepared slots

        // Handle 'actions' type - gets items that produce actions
        if (includeActions) {
            // 1. Add weapon items from strikes (using their item UUIDs)
            const actions = actor.system?.actions ?? [];
            for (const strike of actions) {
                // Skip non-visible strikes
                if (!strike.visible) continue;

                // Get the underlying item
                const item = strike.item;
                if (!item?.uuid || addedUuids.has(item.uuid)) continue;

                addedUuids.add(item.uuid);
                items.push({ uuid: item.uuid, type: 'Item', name: item.name, img: item.img });
            }

            // 2. Add action-type items with action costs
            for (const item of actor.items) {
                if (item.type !== 'action') continue;
                if (!this._hasActions(item)) continue;
                if (addedUuids.has(item.uuid)) continue;

                addedUuids.add(item.uuid);
                items.push({ uuid: item.uuid, type: 'Item', name: item.name, img: item.img });
            }

            // 3. Add feats with action costs
            for (const item of actor.items) {
                if (item.type !== 'feat') continue;
                if (!this._hasActions(item)) continue;
                if (addedUuids.has(item.uuid)) continue;

                addedUuids.add(item.uuid);
                items.push({ uuid: item.uuid, type: 'Item', name: item.name, img: item.img });
            }

            // 4. Add consumables with actions (potions, elixirs, etc.)
            for (const item of actor.items) {
                if (item.type !== 'consumable') continue;
                if (!this._hasActions(item)) continue;
                if (addedUuids.has(item.uuid)) continue;

                addedUuids.add(item.uuid);
                items.push({ uuid: item.uuid, type: 'Item', name: item.name, img: item.img });
            }
        }

        // Handle spells - for prepared casters, create individual cells per slot
        if (includeSpells || includeFocusSpells) {
            for (const entry of actor.items) {
                if (entry.type !== 'spellcastingEntry') continue;

                const entryData = entry.system ?? {};
                const tradition = entryData.prepared?.value;

                // PREPARED CASTERS: Consolidated approach - one cell per unique spell with uses counter
                if (tradition === 'prepared' && includeSpells) {
                    const slots = entryData.slots ?? {};
                    const spellCounts = new Map(); // spellId -> {spell, total, remaining, entryId}

                    // Count all preparations of each spell across all ranks
                    for (let rank = 0; rank <= 10; rank++) {
                        const slotKey = `slot${rank}`;
                        const slotData = slots[slotKey];
                        const preparedList = slotData?.prepared;
                        if (!preparedList) continue;

                        const preparedArray = Array.isArray(preparedList)
                            ? preparedList
                            : Object.values(preparedList);

                        for (const slot of preparedArray) {
                            if (!slot?.id) continue; // Empty slot

                            const spell = actor.items.get(slot.id);
                            if (!spell) continue;

                            // Aggregate counts per unique spell
                            if (!spellCounts.has(slot.id)) {
                                spellCounts.set(slot.id, {
                                    spell: spell,
                                    total: 0,
                                    remaining: 0,
                                    entryId: entry.id
                                });
                            }
                            const counts = spellCounts.get(slot.id);
                            counts.total++;
                            if (!slot.expended) {
                                counts.remaining++;
                            }
                        }
                    }

                    // Create one cell per unique spell with uses counter
                    for (const [spellId, data] of spellCounts) {
                        if (addedUuids.has(data.spell.uuid)) continue;
                        addedUuids.add(data.spell.uuid);

                        // Cantrips have unlimited casts - don't track uses
                        // PF2e uses the 'cantrip' trait to identify cantrips
                        const isCantrip = data.spell.system?.traits?.value?.includes('cantrip');

                        if (isCantrip) {
                            items.push({
                                type: 'Item',
                                uuid: data.spell.uuid,
                                name: data.spell.name,
                                img: data.spell.img
                            });
                        } else {
                            items.push({
                                type: 'Item',
                                uuid: data.spell.uuid,
                                entryId: data.entryId,
                                spellId: spellId,
                                name: data.spell.name,
                                img: data.spell.img,
                                uses: {
                                    value: data.remaining,
                                    max: data.total
                                },
                                depleted: data.remaining === 0
                            });
                        }
                    }
                }

                // FOCUS SPELLS: handled separately (use Focus Pool, not slots)
                if (tradition === 'focus' && includeFocusSpells) {
                    const collection = actor.spellcasting?.collections?.get(entry.id);
                    if (collection) {
                        for (const spell of collection) {
                            if (addedUuids.has(spell.uuid)) continue;
                            addedUuids.add(spell.uuid);
                            items.push({ uuid: spell.uuid, type: 'Item', name: spell.name, img: spell.img });
                        }
                    }
                }

                // SPONTANEOUS/INNATE: One cell per spell (standard behavior)
                if ((tradition === 'spontaneous' || tradition === 'innate') && includeSpells) {
                    const collection = actor.spellcasting?.collections?.get(entry.id);
                    if (collection) {
                        for (const spell of collection) {
                            if (addedUuids.has(spell.uuid)) continue;
                            addedUuids.add(spell.uuid);
                            items.push({ uuid: spell.uuid, type: 'Item', name: spell.name, img: spell.img });
                        }
                    }
                }
            }
        }

        // Handle other item types (consumables, equipment, etc.) - NOT spells
        for (const item of actor.items) {
            // Skip spells - handled above
            if (item.type === 'spell') continue;

            if (!this._matchesType(item, selectedTypes)) {
                continue;
            }

            items.push({ uuid: item.uuid, type: 'Item', name: item.name, img: item.img });
        }

        return items;
    }

    /**
     * Check if item matches any of the selected types
     * Note: 'actions' type is handled separately in getMatchingItems
     * @param {Item} item - The item to check
     * @param {Array<string>} selectedTypes - Selected type values
     * @returns {boolean}
     * @private
     */
    _matchesType(item, selectedTypes) {
        const itemType = item.type;
        for (const selectedType of selectedTypes) {
            // Skip 'actions' - handled separately (combines strikes + action items + feats)
            if (selectedType === 'actions') continue;

            if (selectedType.includes(':')) {
                const [mainType, subType] = selectedType.split(':');

                if (itemType !== mainType) continue;

                if (subType === 'focus') {
                    const traits = item.system?.traits?.value ?? [];
                    return traits.includes('focus');
                }
            } else {
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

        // Prepared tradition: only include if spell is actually prepared in a slot
        // In PF2e, prepared spells are tracked in entry.system.slots[slotX].prepared[]
        if (tradition === 'prepared') {
            // Signature spells are always available
            if (location.signature) {
                return true;
            }

            // Check if the spell is slotted in the prepared list
            const slots = entryData.slots ?? {};
            for (const slotKey of Object.keys(slots)) {
                const slotData = slots[slotKey];
                const preparedList = slotData?.prepared;

                // prepared can be array or object depending on slot usage
                if (!preparedList) continue;

                const preparedArray = Array.isArray(preparedList)
                    ? preparedList
                    : Object.values(preparedList);

                // Check if this spell's ID exists in any prepared slot
                for (const preparedSlot of preparedArray) {
                    if (preparedSlot?.id === item.id) {
                        return true;
                    }
                }
            }

            // Spell is not prepared in any slot
            return false;
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

