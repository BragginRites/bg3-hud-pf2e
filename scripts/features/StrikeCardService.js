/**
 * PF2e Strike Card Service
 * Posts PF2e strikes directly to chat: a quick-roll shortcut for modifier-held
 * clicks, otherwise PF2e's inline strike chat card (bypassing the AttackPopout
 * dialog) with inline MAP buttons.
 */
export class StrikeCardService {
    /**
     * Post a strike: quick-roll a variant if a modifier key is held on the
     * triggering event, otherwise post the inline strike chat card.
     * @param {Actor} actor - The actor making the strike
     * @param {Object} strike - The strike action from actor.system.actions
     * @param {MouseEvent} event - The triggering event
     * @returns {Promise<unknown>}
     */
    async postStrike(actor, strike, event) {
        const quickRoll = this._tryQuickStrikeRoll(strike, event);
        if (quickRoll) return quickRoll;

        await this._postStrikeChatCard(actor, strike);
    }

    /**
     * Quick-roll a strike variant when a modifier key is held (Shift = strike 0,
     * Ctrl = strike 1 / first MAP, Alt = strike 2 / second MAP).
     * Passes a sanitized event so PF2e does not reinterpret the modifier as a
     * Roll Mode override (e.g. Ctrl = Blind roll).
     * @param {Object} strike - The strike action from actor.system.actions
     * @param {MouseEvent} event - The triggering event
     * @returns {Promise|null} The variant roll promise if a modifier matched, else null
     * @private
     */
    _tryQuickStrikeRoll(strike, event) {
        if (!event.shiftKey && !event.ctrlKey && !event.altKey) return null;

        const options = {
            event: {
                shiftKey: false,
                ctrlKey: false,
                altKey: false,
                metaKey: false,
                type: 'click',
                preventDefault: () => { },
                stopPropagation: () => { }
            }
        };

        if (event.shiftKey) return strike.variants[0]?.roll(options);
        if (event.ctrlKey) return strike.variants[1]?.roll(options);
        if (event.altKey) return strike.variants[2]?.roll(options);
        return null;
    }

    /**
     * Post a strike chat card directly to chat
     * This bypasses the AttackPopout dialog and shows inline MAP buttons
     * @param {Actor} actor - The actor making the strike
     * @param {Object} strike - The strike action from actor.system.actions
     * @returns {Promise<void>}
     * @private
     */
    async _postStrikeChatCard(actor, strike) {
        const meleeOrRanged = strike.item.isMelee ? 'melee' : 'ranged';
        const identifier = `${strike.item.id}.${strike.slug}.${meleeOrRanged}`;

        // Only pass essential data - no description to keep the card clean
        const templateData = { actor, strike, identifier };

        // Use PF2e's strike-card template
        const content = await foundry.applications.handlebars.renderTemplate(
            'systems/pf2e/templates/chat/strike-card.hbs',
            templateData
        );

        const token = actor.token ?? actor.getActiveTokens(true, true).shift() ?? null;
        const chatData = {
            speaker: ChatMessage.getSpeaker({ actor, token }),
            content,
            style: CONST.CHAT_MESSAGE_STYLES.OTHER,
        };

        // Respect roll mode settings
        const rollMode = game.settings.get('core', 'rollMode');
        if (['gmroll', 'blindroll'].includes(rollMode)) {
            chatData.whisper = ChatMessage.getWhisperRecipients('GM').map((u) => u.id);
        }
        if (rollMode === 'blindroll') {
            chatData.blind = true;
        }

        await ChatMessage.create(chatData);
    }
}
