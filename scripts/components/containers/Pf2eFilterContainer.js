import { FilterContainer } from '/modules/bg3-hud-core/scripts/components/containers/FilterContainer.js';

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

        // Action cost filters (1-action, 2-action, 3-action)
        // Use dots like spell slots, with green color matching dnd5e actions
        const actionColor = '#2ecc71'; // Same green as dnd5e actions
        
        filters.push({
            id: 'action-1',
            label: 'Action',
            short: '1',
            classes: ['action-cost-button'],
            color: actionColor,
            value: 1,
            max: 1,
            data: { actionCost: 1 }
        });

        filters.push({
            id: 'action-2',
            label: 'Actions',
            short: '2',
            classes: ['action-cost-button'],
            color: actionColor,
            value: 2,
            max: 2,
            data: { actionCost: 2 }
        });

        filters.push({
            id: 'action-3',
            label: 'Actions',
            short: '3',
            classes: ['action-cost-button'],
            color: actionColor,
            value: 3,
            max: 3,
            data: { actionCost: 3 }
        });

        // Trait filters (common traits)
        const commonTraits = ['attack', 'manipulate', 'concentrate', 'move', 'exploration'];
        const traitColors = {
            attack: '#ff6b6b',
            manipulate: '#feca57',
            concentrate: '#48dbfb',
            move: '#ff9ff3',
            exploration: '#54a0ff'
        };

        // Check which traits are actually present in actor's items
        const actorTraits = new Set();
        for (const item of this.actor.items) {
            const traits = item.system?.traits?.value ?? [];
            traits.forEach(trait => actorTraits.add(trait));
        }

        for (const trait of commonTraits) {
            if (actorTraits.has(trait)) {
                filters.push({
                    id: `trait-${trait}`,
                    label: trait.charAt(0).toUpperCase() + trait.slice(1),
                    symbol: 'fa-tag',
                    classes: ['trait-button'],
                    color: traitColors[trait] || '#95a5a6',
                    data: { trait: trait }
                });
            }
        }

        // Focus spell filter
        const hasFocusSpells = this.actor.items.some(item => 
            item.type === 'spell' && item.system?.traits?.value?.includes('focus')
        );
        if (hasFocusSpells) {
            filters.push({
                id: 'focus-spell',
                label: 'Focus Spell',
                symbol: 'fa-star',
                classes: ['spell-type-button'],
                color: '#9b59b6',
                data: { isFocusSpell: true }
            });
        }

        // Spell level filters (1-10)
        const spellSlots = this.actor.system.spells;
        for (let level = 1; level <= 10; level++) {
            const spellLevelKey = `spell${level}`;
            const spellLevel = spellSlots?.[spellLevelKey];

            if (spellLevel?.max > 0) {
                filters.push({
                    id: 'spell',
                    label: 'Spell Level',
                    short: this._getRomanNumeral(level),
                    classes: ['spell-level-button'],
                    color: '#8e44ad',
                    data: { level: level, value: spellLevel.value, max: spellLevel.max },
                    value: spellLevel.value,
                    max: spellLevel.max
                });
            }
        }

        // Item type filters
        filters.push({
            id: 'weapon',
            label: 'Weapon',
            symbol: 'fa-sword',
            classes: ['item-type-button'],
            color: '#e74c3c',
            data: { itemType: 'weapon' }
        });

        filters.push({
            id: 'action',
            label: 'Action',
            symbol: 'fa-hand-fist',
            classes: ['item-type-button'],
            color: '#3498db',
            data: { itemType: 'action' }
        });

        filters.push({
            id: 'feat',
            label: 'Feat',
            symbol: 'fa-star',
            classes: ['item-type-button'],
            color: '#f39c12',
            data: { itemType: 'feat' }
        });

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

        // Handle spell level filtering
        if (filterData.level !== undefined) {
            const itemType = cell.dataset.itemType;
            if (itemType !== 'spell') return false;

            // Focus spell filter
            if (filterData.isFocusSpell) {
                return cell.dataset.isFocusSpell === 'true';
            }

            // Spell level filter
            const cellLevel = parseInt(cell.dataset.level);
            return cellLevel === filterData.level;
        }

        // Handle focus spell filtering
        if (filterData.isFocusSpell) {
            return cell.dataset.isFocusSpell === 'true';
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

        // Handle trait filtering
        if (filterData.trait) {
            const cellTraits = cell.dataset.traits?.split(',') || [];
            return cellTraits.includes(filterData.trait);
        }

        return false;
    }
}

