import { FilterContainer } from '/modules/bg3-hud-core/scripts/components/containers/FilterContainer.js';

const MODULE_ID = 'bg3-hud-pf2e';

/**
 * PF2e Filter Container
 * Provides action cost, trait, and spell level filters for PF2e
 */
export class Pf2eFilterContainer extends FilterContainer {
    /**
     * Create PF2e filter container
     * @param {Object} options - Container options
     */
    constructor(options = {}) {
        super({
            ...options,
            getFilters: () => this.getPf2eFilters()
        });
    }

    /**
     * Get PF2e-specific filter definitions
     * @returns {Array<Object>} Filter definitions
     */
    getPf2eFilters() {
        const filters = [];

        if (!this.actor) return filters;

        // Action economy tracking
        // Get actions used this turn (stored as a flag, default to 0)
        const actionsUsed = this.actor.getFlag(MODULE_ID, 'actionsUsed') ?? 0;
        const totalActions = 3; // PF2e standard is 3 actions per turn
        const actionsRemaining = Math.max(0, totalActions - actionsUsed);

        // Action cost filters (1-action, 2-action, 3-action)
        // Pips show remaining actions - if you've used 1 action, all filters lose 1 pip
        // alwaysShow: true means these filters always appear regardless of hotbar content
        const actionColor = '#2ecc71'; // Same green as dnd5e actions

        filters.push({
            id: 'action-1',
            label: game.i18n.localize(`${MODULE_ID}.Filters.Action`),
            short: '1',
            classes: ['action-cost-button'],
            color: actionColor,
            value: Math.min(actionsRemaining, 1), // 1 if any actions remain, 0 if none
            max: 1,
            data: { actionCost: 1 },
            alwaysShow: true // Always show action filters
        });

        filters.push({
            id: 'action-2',
            label: game.i18n.localize(`${MODULE_ID}.Filters.Actions`),
            short: '2',
            classes: ['action-cost-button'],
            color: actionColor,
            value: Math.min(actionsRemaining, 2), // 2 if 2+ remain, 1 if 1 remains, 0 if none
            max: 2,
            data: { actionCost: 2 },
            alwaysShow: true
        });

        filters.push({
            id: 'action-3',
            label: game.i18n.localize(`${MODULE_ID}.Filters.Actions`),
            short: '3',
            classes: ['action-cost-button'],
            color: actionColor,
            value: actionsRemaining, // Full remaining count (0-3)
            max: 3,
            data: { actionCost: 3 },
            alwaysShow: true
        });

        // Item type filters (after action pips, before spell filters)
        filters.push({
            id: 'weapon',
            label: game.i18n.localize(`${MODULE_ID}.Filters.Weapon`),
            symbol: 'fa-sword',
            classes: ['item-type-button'],
            color: '#e74c3c',
            data: { itemType: 'weapon' }
        });

        filters.push({
            id: 'action',
            label: game.i18n.localize(`${MODULE_ID}.Filters.Action`),
            symbol: 'fa-hand-fist',
            classes: ['item-type-button'],
            color: '#3498db',
            data: { itemType: 'action' }
        });

        filters.push({
            id: 'feat',
            label: game.i18n.localize(`${MODULE_ID}.Filters.Feat`),
            symbol: 'fa-star',
            classes: ['item-type-button'],
            color: '#f39c12',
            data: { itemType: 'feat' }
        });

        // Focus spell filter - check focus points (Focus IS a shared pool, keeps pips)
        const focusPool = this.actor.system?.resources?.focus;
        if (focusPool?.max > 0) {
            filters.push({
                id: 'focus-spell',
                label: game.i18n.localize(`${MODULE_ID}.Filters.FocusSpell`),
                short: 'F',
                classes: ['spell-level-button', 'focus-spell-button'],
                color: '#9b59b6',
                value: focusPool.value,
                max: focusPool.max,
                data: { isFocusSpell: true }
            });
        }

        // Detect which spell ranks the actor has spells for
        const spellRanks = new Set();
        for (const item of this.actor.items) {
            if (item.type !== 'spell') continue;
            // Cantrips have the 'cantrip' trait - treat as rank 0
            const isCantrip = item.system?.traits?.value?.includes('cantrip');
            const rank = isCantrip ? 0 : (item.system?.level?.value ?? item.system?.rank ?? 99);
            spellRanks.add(rank);
        }

        // Spell color - same blue as D&D5e spells
        const spellColor = '#3497d9';

        // Add cantrip filter if actor has cantrips (standalone - not grouped)
        if (spellRanks.has(0)) {
            filters.push({
                id: 'spell',
                label: game.i18n.localize(`${MODULE_ID}.Filters.Cantrip`),
                centerLabel: 'C',
                classes: ['spell-level-button', 'spell-cantrip-box'],
                color: spellColor,
                data: { level: 0 }
            });
        }

        // Build spell rank children for the group
        const spellRankChildren = [];

        // Spell rank filters (1-10) - centered label, NO PIPS
        // PF2e doesn't have spell slots - each prepared spell is cast once
        for (let rank = 1; rank <= 10; rank++) {
            if (!spellRanks.has(rank)) continue;

            spellRankChildren.push({
                id: `spell-${rank}`,
                label: game.i18n.localize(`${MODULE_ID}.Filters.SpellRank`),
                centerLabel: this._getRomanNumeral(rank),
                classes: ['spell-level-button'],
                color: spellColor,
                data: { level: rank }
            });
        }

        // Add spell ranks group if there are any spell ranks (icon only, no label)
        if (spellRankChildren.length > 0) {
            filters.push({
                id: 'spell-ranks-group',
                type: 'group',
                symbol: 'fa-hat-wizard',
                color: spellColor,
                children: spellRankChildren
            });
        }

        return filters;
    }

    /**
     * Convert number to Roman numeral
     * @param {number} num
     * @returns {string}
     * @private
     */
    _getRomanNumeral(num) {
        const numerals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
        return numerals[num - 1] || num.toString();
    }

    /**
     * Check if a cell matches a filter (PF2e-specific logic)
     * @param {FilterButton} filter - The filter button
     * @param {HTMLElement} cell - The cell element
     * @returns {boolean}
     */
    matchesFilter(filter, cell) {
        if (!filter || !cell) return false;

        const filterData = filter.data;

        // Handle focus spell filtering
        if (filterData.isFocusSpell) {
            return cell.dataset.isFocusSpell === 'true';
        }

        // Handle spell level filtering
        if (filterData.level !== undefined) {
            const itemType = cell.dataset.itemType;
            if (itemType !== 'spell') return false;

            // Spell level/rank filter
            const cellLevel = parseInt(cell.dataset.level);
            return cellLevel === filterData.level;
        }

        // Handle item type filtering
        if (filterData.itemType) {
            return cell.dataset.itemType === filterData.itemType;
        }

        // Handle action cost filtering
        if (filterData.actionCost !== undefined) {
            const cellActionCost = parseInt(cell.dataset.actionCost);
            return cellActionCost === filterData.actionCost;
        }

        return false;
    }
}
