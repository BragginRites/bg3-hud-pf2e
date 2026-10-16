import { createLogger } from '/modules/bg3-hud-core/scripts/utils/logger.js';
import { classifyShieldCover } from './ShieldCoverRules.js';

const MODULE_ID = 'bg3-hud-pf2e';
const log = createLogger(MODULE_ID);

/** PF2e system compendium UUIDs referenced by shield/cover handling. */
export const PF2E_SHIELD_COVER_UUIDS = {
    /** "Cover" effect applied by the Take Cover action. */
    cover: 'Compendium.pf2e.other-effects.Item.I9lfZUiCwMiGogVi',
    /** "Raised Shield" effect applied by the Raise a Shield action. */
    raiseShield: 'Compendium.pf2e.equipment-effects.Item.2YgXoHvJfrDHucMr'
};

export { classifyShieldCover };

/**
 * PF2e Shield + Cover Service
 * Encapsulates raising/lowering a shield and applying the Take Cover effect,
 * including PF2e's effect-slug matching, so callers don't need to know those details.
 */
export class ShieldCoverService {
    /**
     * Raise Shield via PF2e action macro
     * @param {Actor} actor
     * @returns {Promise<void>}
     */
    async raiseShield(actor) {
        const raiseAction = game.pf2e?.actions?.raiseAShield;
        if (!raiseAction) {
            ui.notifications.warn(game.i18n.localize(`${MODULE_ID}.Notifications.ActionUnavailable`));
            return;
        }
        await raiseAction({ actors: [actor] });
    }

    /**
     * Lower Shield by removing the Raise a Shield effect
     * @param {Actor} actor
     * @returns {Promise<void>}
     */
    async lowerShield(actor) {
        const raiseEffect = actor.itemTypes?.effect?.find(
            (e) =>
                e.slug === 'raise-a-shield' ||
                e.slug === 'effect-raise-a-shield' ||
                e.sourceId === PF2E_SHIELD_COVER_UUIDS.raiseShield,
        );
        if (!raiseEffect) return;
        try {
            await raiseEffect.delete();
        } catch (error) {
            log.error('Failed to lower shield', { actorId: actor.id }, error);
            ui.notifications.warn(game.i18n.localize(`${MODULE_ID}.Notifications.ActionFailed`));
        }
    }

    /**
     * Take Cover via PF2e action macro
     * @param {Actor} actor
     * @param {Item} [shieldOverride]
     * @returns {Promise<void>}
     */
    async takeCover(actor, shieldOverride = null) {
        const applied = await this.applyCoverEffect(actor, shieldOverride);
        if (!applied) {
            ui.notifications.warn(game.i18n.localize(`${MODULE_ID}.Notifications.ActionUnavailable`));
        }
    }

    /**
     * Apply cover effect based on held shield (tower = greater, otherwise standard)
     * @param {Actor} actor
     * @param {Item} [shieldOverride]
     * @returns {Promise<boolean>} true if applied
     */
    async applyCoverEffect(actor, shieldOverride = null) {
        if (!actor) return false;

        const shield = shieldOverride ?? actor.heldShield ?? null;
        const { isTowerShield, ...coverSelection } = classifyShieldCover(shield);

        const coverUuid = PF2E_SHIELD_COVER_UUIDS.cover;
        const existing = actor.itemTypes?.effect?.find(
            (e) => e.sourceId === coverUuid && e.getFlag?.(MODULE_ID, 'shieldCover'),
        );
        if (existing) {
            await existing.delete();
            return true;
        }

        try {
            const effect = await fromUuid(coverUuid);
            if (!effect) return false;

            const data = { ...effect.toObject(), _id: null };

            // Pre-select the cover level to avoid prompting the user
            const rule = Array.isArray(data.system?.rules)
                ? data.system.rules.find((r) => r?.key === 'ChoiceSet')
                : null;
            if (rule) {
                rule.selection = coverSelection;
            }

            // Tag tower shields for parity with system behavior
            if (isTowerShield && data.system?.traits) {
                const otherTags = Array.isArray(data.system.traits.otherTags) ? data.system.traits.otherTags : [];
                data.system.traits.otherTags = Array.from(new Set([...otherTags, 'tower-shield']));
            }

            data.flags = data.flags ?? {};
            data.flags[MODULE_ID] = {
                ...(data.flags[MODULE_ID] ?? {}),
                shieldCover: true,
            };

            await actor.createEmbeddedDocuments('Item', [data]);
            return true;
        } catch (error) {
            log.warn('Failed to apply cover effect', error);
            return false;
        }
    }
}
