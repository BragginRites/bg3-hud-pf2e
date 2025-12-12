import { ActionButtonsContainer } from '/modules/bg3-hud-core/scripts/components/containers/ActionButtonsContainer.js';

const MODULE_ID = 'bg3-hud-pf2e';

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
            icon: 'fas fa-stopwatch',
            label: '', // icon-only
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

        // Rest button (visible outside combat)
        // PF2e uses the \"Rest for the Night\" action for daily preparations
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
                if (!this.actor) return;
                try {
                    // Use PF2e's restForTheNight action for daily preparations
                    if (!game.pf2e?.actions?.restForTheNight) {
                        throw new Error('PF2e restForTheNight action not available. Ensure PF2e system is loaded.');
                    }

                    // PF2e system actions are functions taking an options object
                    await game.pf2e.actions.restForTheNight({
                        actors: [this.actor],
                        event
                    });
                } catch (error) {
                    console.error('Pf2e Action Buttons | Rest failed:', error);
                    ui.notifications.error(game.i18n.localize(`${MODULE_ID}.Notifications.FailedToPerformRest`));
                }
            }
        });

        return buttons;
    }
}

