/**
 * Auto-populate Configuration Menu
 * FormApplication that directly opens the existing AutoPopulateConfigDialog
 */
const MODULE_ID = 'bg3-hud-pf2e';

class AutoPopulateConfigMenu extends FormApplication {
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: 'bg3-hud-auto-populate-config',
            title: game.i18n.localize(`${MODULE_ID}.Settings.AutoPopulateConfiguration`),
            width: 0,
            height: 0,
            closeOnSubmit: true
        });
    }

    async _render(force = false, options = {}) {
        // Don't render anything - just open the dialog directly
        
        // Get the adapter's autoPopulate instance
        const adapter = ui.BG3HOTBAR?.registry?.activeAdapter;
        if (!adapter || !adapter.autoPopulate) {
            ui.notifications.error(game.i18n.localize(`${MODULE_ID}.Notifications.AutoPopulateSystemNotAvailable`));
            this.close();
            return;
        }

        // Get current configuration
        const currentConfig = game.settings.get(MODULE_ID, 'autoPopulateConfiguration');
        
        // Get item type choices from the adapter
        const choices = await adapter.autoPopulate.getItemTypeChoices();
        if (!choices || choices.length === 0) {
            ui.notifications.warn(game.i18n.localize(`${MODULE_ID}.Notifications.NoItemTypesAvailable`));
            this.close();
            return;
        }

        // Close this form immediately
        this.close();

        // Import and show the dialog directly
        const { AutoPopulateConfigDialog } = await import('/modules/bg3-hud-core/scripts/components/ui/AutoPopulateConfigDialog.js');
        
        const dialog = new AutoPopulateConfigDialog({
            title: game.i18n.localize(`${MODULE_ID}.Settings.ConfigureAutoPopulateGrids`),
            choices: choices,
            configuration: currentConfig
        });

        const result = await dialog.render();
        
        // Save if not cancelled
        if (result) {
            await game.settings.set(MODULE_ID, 'autoPopulateConfiguration', result);
            ui.notifications.info(game.i18n.localize(`${MODULE_ID}.Notifications.AutoPopulateConfigurationSaved`));
        }
    }
}

/**
 * Register PF2e adapter module settings
 */
export function registerSettings() {
    // Auto-populate configuration menu
    game.settings.registerMenu(MODULE_ID, 'autoPopulateConfigurationMenu', {
        name: `${MODULE_ID}.Settings.ConfigureAutoPopulateGrids`,
        label: `${MODULE_ID}.Settings.ConfigureGrids`,
        hint: `${MODULE_ID}.Settings.ConfigureGridsHint`,
        icon: 'fas fa-grid-2',
        type: AutoPopulateConfigMenu,
        restricted: true
    });

    // Auto-populate passives setting
    game.settings.register(MODULE_ID, 'autoPopulatePassivesEnabled', {
        name: `${MODULE_ID}.Settings.AutoPopulatePassives`,
        hint: `${MODULE_ID}.Settings.AutoPopulatePassivesHint`,
        scope: 'world',
        config: true,
        type: Boolean,
        default: true
    });

    // Display item names setting
    game.settings.register(MODULE_ID, 'showItemNames', {
        name: `${MODULE_ID}.Settings.ShowItemNames`,
        hint: `${MODULE_ID}.Settings.ShowItemNamesHint`,
        scope: 'client',
        config: true,
        type: Boolean,
        default: false
    });

    // Display item uses setting
    game.settings.register(MODULE_ID, 'showItemUses', {
        name: `${MODULE_ID}.Settings.ShowItemUses`,
        hint: `${MODULE_ID}.Settings.ShowItemUsesHint`,
        scope: 'client',
        config: true,
        type: Boolean,
        default: true
    });

    // Auto-populate on token creation setting
    game.settings.register(MODULE_ID, 'autoPopulateEnabled', {
        name: `${MODULE_ID}.Settings.AutoPopulateOnTokenCreation`,
        hint: `${MODULE_ID}.Settings.AutoPopulateOnTokenCreationHint`,
        scope: 'world',
        config: true,
        type: Boolean,
        default: false
    });

    // Auto-populate configuration setting
    game.settings.register(MODULE_ID, 'autoPopulateConfiguration', {
        name: `${MODULE_ID}.Settings.AutoPopulateConfiguration`,
        hint: `${MODULE_ID}.Settings.AutoPopulateConfigurationHint`,
        restricted: true,
        scope: 'world',
        config: false,
        type: Object,
        default: {
            grid0: ['weapon', 'attack', 'action'],  // Main combat: weapons, attacks, and actions
            grid1: ['feat', 'spell'],     // Abilities: feats and spells
            grid2: ['consumable']         // Consumables: potions, elixirs, etc.
        }
    });
}

