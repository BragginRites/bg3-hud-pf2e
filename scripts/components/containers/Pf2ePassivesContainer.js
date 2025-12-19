// Import showSelectionDialog from core utilities
const { showSelectionDialog } = await import('/modules/bg3-hud-core/scripts/utils/dialogs.js');

const MODULE_ID = 'bg3-hud-pf2e';

/**
 * Create PF2e Passives Container
 * Factory function to avoid import issues with core
 */
export async function createPf2ePassivesContainer() {
    // Import core PassivesContainer dynamically
    const { PassivesContainer } = await import('/modules/bg3-hud-core/scripts/components/containers/PassivesContainer.js');

    /**
     * PF2e Passives Container
     * Displays passive features/feats for PF2e
     * Shows ALL feats (ancestry, class, skill, general) that have no action cost
     */
    class Pf2ePassivesContainer extends PassivesContainer {
        /**
         * Get all passive items (feat-type items WITHOUT actions)
         * @returns {Array<Item>} Array of passive feat items
         */
        getPassiveItems() {
            if (!this.actor) return [];

            // Return only feat items that have NO action cost
            return this.actor.items.filter(item => {
                if (item.type !== 'feat') return false;

                // PF2e feats have action cost in system.actions.value
                const actionCost = item.system?.actions?.value ?? 0;
                return actionCost === 0; // No action cost = passive
            });
        }

        /**
         * Get the set of selected passive UUIDs
         * Stored in actor flags
         * @returns {Set<string>} Set of item UUIDs that should be displayed
         */
        getSelectedPassives() {
            const saved = this.actor.getFlag(MODULE_ID, 'selectedPassives');
            if (saved && Array.isArray(saved)) {
                return new Set(saved);
            }

            // Default: show nothing (user must configure)
            return new Set();
        }

        /**
         * Save selected passives to actor flags
         * @param {Array<string>} uuids - Array of selected UUIDs
         * @private
         */
        async _saveSelectedPassives(uuids) {
            await this.actor.setFlag(MODULE_ID, 'selectedPassives', uuids);
        }

        /**
         * Show configuration dialog to select which passives to display
         * @param {Event} event - The triggering event
         */
        async showConfigurationDialog(event) {
            const allFeatures = this.getPassiveItems();
            const selected = this.getSelectedPassives();

            // Build items array for dialog
            const items = allFeatures.map(feature => ({
                id: feature.uuid,
                label: feature.name,
                img: feature.img,
                selected: selected.has(feature.uuid)
            }));

            // Show dialog using core utility
            const selectedIds = await showSelectionDialog({
                title: game.i18n.localize('bg3-hud-pf2e.PF2E.SelectPassiveFeats'),
                items: items
            });

            // If user confirmed (not cancelled), save the selection
            if (selectedIds !== null) {
                await this._saveSelectedPassives(selectedIds);
                // Don't call render() here - the actor flag update will trigger
                // a refresh via the updateActor hook, which will efficiently
                // update only the passives container
            }
        }
    }

    return Pf2ePassivesContainer;
}


