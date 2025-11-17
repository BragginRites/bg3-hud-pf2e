import { ActionButtonsContainer } from '/modules/bg3-hud-core/scripts/components/containers/ActionButtonsContainer.js';

/**
 * PF2e Action Buttons Container
 * Provides rest and turn buttons specific to PF2e
 */
export class Pf2eActionButtonsContainer extends ActionButtonsContainer {
    /**
     * Create PF2e action buttons container
     * @param {Object} options - Container options
     * @param {Actor} options.actor - The actor
     * @param {Token} options.token - The token
     */
    constructor(options = {}) {
        super({
            ...options,
            getButtons: () => this.getPf2eButtons()
        });
    }

    /**
     * Get PF2e-specific button definitions
     * @returns {Array<Object>} Button definitions
     */
    getPf2eButtons() {
        const buttons = [];

        if (!this.actor) return buttons;

        // End Turn button (visible during combat when it's the actor's turn)
        buttons.push({
            key: 'end-turn',
            classes: ['end-turn-button'],
            icon: 'fas fa-clock-rotate-left',
            label: game.i18n.localize('BG3HUD.EndTurn'),
            tooltip: game.i18n.localize('BG3HUD.EndTurn'),
            tooltipDirection: 'LEFT',
            visible: () => {
                return !!game.combat?.started && 
                       game.combat?.combatant?.actor?.id === this.actor.id;
            },
            onClick: async () => {
                if (game.combat) {
                    await game.combat.nextTurn();
                }
            }
        });

        // Action Counter Display (shows remaining actions during combat)
        buttons.push({
            key: 'action-counter',
            classes: ['action-counter-button'],
            icon: 'fas fa-hand-fist',
            label: () => {
                const actionsRemaining = this.actor.system.actionsRemaining?.value ?? 3;
                return `${actionsRemaining}/3`;
            },
            tooltip: () => {
                const actionsRemaining = this.actor.system.actionsRemaining?.value ?? 3;
                return `Actions Remaining: ${actionsRemaining}/3`;
            },
            tooltipDirection: 'LEFT',
            visible: () => {
                return !!game.combat?.started && 
                       game.combat?.combatant?.actor?.id === this.actor.id;
            },
            onClick: null // Display only, not clickable
        });

        // Rest button (visible outside combat)
        // PF2e uses 8-hour rest for daily preparations
        buttons.push({
            key: 'rest',
            classes: ['rest-button'],
            icon: 'fas fa-bed',
            label: game.i18n.localize('BG3HUD.Rest') || 'Rest',
            tooltip: game.i18n.localize('BG3HUD.RestTooltip') || 'Rest (8 hours)',
            tooltipDirection: 'LEFT',
            visible: () => {
                return !game.combat?.started;
            },
            onClick: async (event) => {
                await this._performRest();
            }
        });

        return buttons;
    }

    /**
     * Perform a rest (8-hour rest for daily preparations)
     * PF2e uses the actor sheet's rest action handler
     * @private
     */
    async _performRest() {
        if (!this.actor) return;

        try {
            // Try to use PF2e's built-in rest functionality
            // PF2e actors have a rest method that handles daily preparations
            const actorDocument = this.actor;
            
            // Check if PF2e has a rest method on the actor document
            if (typeof actorDocument.rest === 'function') {
                await actorDocument.rest();
                return;
            }
            
            // Try to trigger through the actor sheet's action handler
            const sheet = this.actor.sheet;
            if (sheet && typeof sheet._onAction === 'function') {
                // Create a mock click event and element to trigger the rest action
                const mockEvent = {
                    currentTarget: {
                        dataset: { action: 'rest' },
                        classList: { contains: () => true }
                    },
                    preventDefault: () => {},
                    stopPropagation: () => {}
                };
                await sheet._onAction(mockEvent);
                return;
            }
            
            // Fallback: Use PF2e rest mechanics directly
            await this._performPf2eRest();
        } catch (error) {
            console.error('Pf2e Action Buttons | Rest failed:', error);
            // Try fallback if primary method fails
            try {
                await this._performPf2eRest();
            } catch (fallbackError) {
                console.error('Pf2e Action Buttons | Fallback rest also failed:', fallbackError);
                ui.notifications.error('Failed to perform rest');
            }
        }
    }

    /**
     * Perform PF2e rest mechanics
     * Restores HP based on Constitution modifier * level
     * Triggers daily preparations
     * @private
     */
    async _performPf2eRest() {
        if (!this.actor) return;

        const conMod = this.actor.system.abilities?.con?.mod || 0;
        const level = this.actor.level || 1;
        const hpRestored = Math.max(1, conMod * level);
        const currentHP = this.actor.system.attributes?.hp?.value || 0;
        const maxHP = this.actor.system.attributes?.hp?.max || 1;
        const newHP = Math.min(maxHP, currentHP + hpRestored);

        // Update HP
        await this.actor.update({
            'system.attributes.hp.value': newHP
        });

        // Trigger daily preparations if available
        // This would restore spell slots, focus points, etc.
        if (typeof this.actor.prepareData === 'function') {
            this.actor.prepareData();
        }

        ui.notifications.info(
            game.i18n.format('PF2E.Actor.Character.Rest.Complete', {
                actor: this.actor.name,
                hp: hpRestored
            }) || `${this.actor.name} rested and recovered ${hpRestored} HP.`
        );
    }
}

