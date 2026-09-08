import { createLogger } from '/modules/bg3-hud-core/scripts/utils/logger.js';

const MODULE_ID = 'bg3-hud-pf2e';
const log = createLogger('bg3-hud-pf2e');

/**
 * PF2e rest fill for the named Rest HUD part.
 * @param {{ actor?: Actor, token?: Token }} ctx
 * @returns {Array<Object>}
 */
export function getPf2eRests({ actor } = {}) {
    if (!actor) return [];

    return [
        {
            key: 'rest',
            classes: ['rest-button'],
            icon: 'fas fa-bed',
            label: game.i18n.localize('BG3HUD.Rest') || 'Rest',
            tooltip: game.i18n.localize('BG3HUD.RestTooltip') || 'Rest (8 hours)',
            tooltipDirection: 'LEFT',
            visible: () => !game.combat?.started,
            onClick: async (event) => {
                try {
                    if (!game.pf2e?.actions?.restForTheNight) {
                        throw new Error('PF2e restForTheNight action not available. Ensure PF2e system is loaded.');
                    }
                    await game.pf2e.actions.restForTheNight({
                        actors: [actor],
                        event
                    });
                } catch (error) {
                    log.error('Pf2e Rest | Rest failed:', error);
                    ui.notifications.error(game.i18n.localize(`${MODULE_ID}.Notifications.FailedToPerformRest`));
                }
            }
        }
    ];
}
