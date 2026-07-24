import { MenuBuilder } from '/modules/bg3-hud-core/scripts/components/ui/MenuBuilder.js';
import { resolveUseTokenImage } from '/modules/bg3-hud-core/scripts/utils/portraitImage.js';

const MODULE_ID = 'bg3-hud-pf2e';

/**
 * PF2e Menu Builder
 * Provides PF2e specific menu items for portrait, abilities, settings, and lock menus
 */
export class Pf2eMenuBuilder extends MenuBuilder {
    /**
     * Build portrait menu items for PF2e
     * @param {PortraitContainer} portraitContainer - The portrait container instance
     * @param {MouseEvent} event - The triggering event
     * @returns {Promise<Array>} Menu items array
     */
    async buildPortraitMenu(portraitContainer, event) {
        const actor = portraitContainer.actor;
        if (!actor) return [];

        const useTokenImage = resolveUseTokenImage(actor, MODULE_ID);
        const items = [];

        // Token image option
        items.push({
            key: 'token',
            label: game.i18n.localize(`${MODULE_ID}.Menu.UseTokenImage`),
            icon: useTokenImage ? 'fas fa-check' : 'fas fa-chess-pawn',
            onClick: async () => {
                if (!useTokenImage) {
                    await actor.setFlag(MODULE_ID, 'useTokenImage', true);
                }
            }
        });

        // Character portrait option
        items.push({
            key: 'portrait',
            label: game.i18n.localize(`${MODULE_ID}.Menu.UseCharacterPortrait`),
            icon: !useTokenImage ? 'fas fa-check' : 'fas fa-user',
            onClick: async () => {
                if (useTokenImage) {
                    await actor.setFlag(MODULE_ID, 'useTokenImage', false);
                }
            }
        });

        return items;
    }

    /**
     * Build ability menu items for PF2e
     * @param {InfoContainer} infoContainer - The info container instance
     * @param {MouseEvent} event - The triggering event
     * @returns {Promise<Array>} Menu items array
     */
    async buildAbilityMenu(infoContainer, event) {
        // PF2e doesn't use ability menus in the same way as D&D 5e
        // Return empty array to use core/default behavior
        return [];
    }

    /**
     * Build settings menu items for PF2e
     * @param {ControlContainer} controlContainer - The control container instance
     * @param {MouseEvent} event - The triggering event
     * @returns {Promise<Array>} Menu items array
     */
    async buildSettingsMenu(controlContainer, event) {
        // Return empty array to use core settings menu
        return [];
    }

    /**
     * Build lock menu items for PF2e
     * @param {ControlContainer} controlContainer - The control container instance
     * @param {MouseEvent} event - The triggering event
     * @returns {Promise<Array>} Menu items array
     */
    async buildLockMenu(controlContainer, event) {
        // Return empty array to use core lock menu
        return [];
    }
}

