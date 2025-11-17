/**
 * PF2e Tooltip Renderer
 * Handles rendering tooltips for items, actions, and macros
 */

/**
 * Render tooltip HTML for PF2e items/macros
 * @param {Object} data - Item or Macro document
 * @param {Object} options - Rendering options
 * @returns {Promise<Object>} Object with { content: string, classes: string[], direction: string }
 */
export async function renderPf2eTooltip(data, options = {}) {
    try {
        let cardData;
        let templatePath;

        // Determine what type of data we have
        if (data instanceof Item) {
            // PF2e Item
            cardData = await getItemCardData(data, options);
            templatePath = 'modules/bg3-hud-pf2e/templates/tooltips/item-tooltip.hbs';
        } else if (data.documentName === 'Macro' || data instanceof Macro) {
            // Macro
            cardData = {
                name: data.name,
                img: data.img
            };
            templatePath = 'modules/bg3-hud-pf2e/templates/tooltips/macro-tooltip.hbs';
        } else {
            // Fallback
            cardData = {
                name: data.name || 'Unknown',
                img: data.img || ''
            };
            templatePath = 'modules/bg3-hud-pf2e/templates/tooltips/item-tooltip.hbs';
        }

        // Render template
        const html = await foundry.applications.handlebars.renderTemplate(templatePath, cardData);

        if (!html) {
            console.warn('BG3 HUD PF2e | Template rendered empty HTML');
            return null;
        }

        return {
            content: html,
            classes: ['pf2e-tooltip', 'item-tooltip'],
            direction: 'UP'
        };
    } catch (error) {
        console.error('BG3 HUD PF2e | Error rendering tooltip:', error);
        console.error('BG3 HUD PF2e | Error stack:', error.stack);
        return null;
    }
}

/**
 * Get card data for a PF2e item
 * @param {Item} item - Foundry Item document
 * @param {Object} options - Rendering options
 * @returns {Promise<Object>} Card data object
 */
async function getItemCardData(item, options = {}) {
    const name = item.name;
    const img = item.img;
    const type = item.type;
    
    // Get action cost
    const actionCost = item.system?.actions?.value ?? 0;
    const actionCostLabel = actionCost > 0 ? `${actionCost} Action${actionCost > 1 ? 's' : ''}` : null;
    
    // Get traits
    const traits = item.system?.traits?.value ?? [];
    
    // Get description
    const description = item.system?.description?.value || '';
    const enrichedDescription = await foundry.applications.ux.TextEditor.implementation.enrichHTML(description, {
        rollData: item.getRollData(),
        relativeTo: item,
        ...options
    });
    
    // Build subtitle
    let subtitle = type.charAt(0).toUpperCase() + type.slice(1);
    
    // Spell-specific data
    let level = null;
    let school = null;
    let traditions = null;
    const isSpell = type === 'spell';
    
    if (isSpell) {
        level = item.system?.level?.value ?? 0;
        school = item.system?.school?.value || '';
        const traditionsArray = item.system?.traditions?.value ?? [];
        traditions = traditionsArray.length > 0 ? traditionsArray.join(', ') : null;
    }
    
    return {
        name,
        img,
        subtitle,
        type,
        actionCostLabel,
        traits,
        description: enrichedDescription,
        isSpell,
        level,
        school,
        traditions
    };
}

