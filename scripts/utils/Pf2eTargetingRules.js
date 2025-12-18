/**
 * PF2e Targeting Rules
 * System-specific targeting logic for PF2e items and actions.
 * All functions are pure and return plain data objects - no DOM manipulation.
 */

/**
 * Check if an item/action requires targeting.
 * @param {Object} params
 * @param {Item} params.item - The Foundry item document
 * @param {Object} [params.activity] - Optional action (PF2e uses 'action' terminology)
 * @returns {boolean} True if targeting is required
 */
export function needsTargeting({ item, activity = null }) {
    if (!item) return false;

    // For strikes, check the action
    if (activity?.type === 'strike') {
        return true;
    }

    // Check item-level target configuration
    const target = item.system?.target;

    // Self-targeting items don't need selector
    if (target?.value === 'self' || target?.type === 'self') {
        return false;
    }

    // Emanation, burst, cone, line templates don't need target selector
    if (target?.type && ['emanation', 'burst', 'cone', 'line'].includes(target.type)) {
        return false;
    }

    // Check if item has specific creature target
    if (target?.value && typeof target.value === 'number' && target.value > 0) {
        return true;
    }

    // Check action cost traits
    const traits = item.system?.traits?.value || [];

    // Attack trait indicates targeting needed
    if (traits.includes('attack')) {
        return true;
    }

    // Spells with attack rolls need targeting
    if (item.type === 'spell') {
        // Check for attack tradition via spellType (modern)
        if (item.system?.spellType?.value === 'attack') {
            return true;
        }
        // Check for attack tradition (legacy)
        if (item.system?.attack?.roll) {
            return true;
        }
        // Check for save-based spells with targets
        if ((item.system?.defense?.save || item.system?.spellType?.value === 'save') && target?.value) {
            return true;
        }
    }

    return false;
}

/**
 * Extract targeting requirements from an item/action.
 * @param {Object} params
 * @param {Item} params.item - The Foundry item document
 * @param {Object} [params.activity] - Optional action
 * @returns {Object} Target requirements
 */
export function getTargetRequirements({ item, activity = null }) {
    const requirements = {
        minTargets: 1,
        maxTargets: 1,
        range: null,
        longRange: null, // PF2e doesn't have long range like D&D 5e
        targetType: 'any',
        hasTemplate: false,
        template: null
    };

    if (!item) return requirements;

    // Get target configuration
    const target = item.system?.target;

    if (target) {
        // Target type
        requirements.targetType = target.type || 'any';

        // Target count
        const count = target.value || 1;
        if (typeof count === 'number') {
            requirements.minTargets = Math.max(1, count);
            requirements.maxTargets = count;
        }

        // Template shapes
        if (['emanation', 'burst', 'cone', 'line'].includes(target.type)) {
            requirements.hasTemplate = true;
            requirements.template = {
                type: target.type,
                size: target.value || target.distance || 0
            };
        }
    }

    // Calculate range
    const rangeInfo = calculateRange({ item, activity, actor: item.actor });
    requirements.range = rangeInfo.range;

    return requirements;
}

/**
 * Check if a token is a valid target given requirements.
 * @param {Object} params
 * @param {Token} params.sourceToken - The attacking/casting token
 * @param {Token} params.targetToken - The potential target token
 * @param {Object} params.requirements - Target requirements
 * @returns {Object} { valid: boolean, reason: string|null }
 */
export function isValidTargetType({ sourceToken, targetToken, requirements }) {
    if (!targetToken) {
        return { valid: false, reason: game.i18n.localize('BG3.TargetSelector.InvalidTarget') };
    }

    if (!targetToken.actor) {
        return { valid: false, reason: game.i18n.localize('BG3.TargetSelector.NoActor') };
    }

    // Check visibility
    if (!targetToken.isVisible || targetToken.document.hidden) {
        return { valid: false, reason: game.i18n.localize('BG3.TargetSelector.TokenNotVisible') };
    }

    // Check target type
    const targetType = requirements.targetType;

    if (targetType === 'self') {
        if (targetToken !== sourceToken) {
            return { valid: false, reason: game.i18n.localize('BG3.TargetSelector.SelfOnly') };
        }
    } else if (targetType === 'enemy') {
        // Can't target self
        if (targetToken === sourceToken) {
            return { valid: false, reason: game.i18n.localize('BG3.TargetSelector.CannotTargetSelf') };
        }

        // Check disposition for enemy
        const isEnemy = _isEnemy(sourceToken, targetToken);
        if (!isEnemy) {
            return { valid: false, reason: game.i18n.localize('BG3.TargetSelector.MustBeEnemy') };
        }
    } else if (targetType === 'ally' || targetType === 'willing') {
        // Must be friendly
        const isFriendly = _isFriendly(sourceToken, targetToken);
        if (!isFriendly) {
            return { valid: false, reason: game.i18n.localize('BG3.TargetSelector.MustBeAlly') };
        }
    } else if (targetType === 'creature') {
        // Must have a creature type
        const creatureType = targetToken.actor?.system?.details?.creature?.value;
        if (!creatureType) {
            return { valid: false, reason: game.i18n.localize('BG3.TargetSelector.MustBeCreature') };
        }
    }

    return { valid: true, reason: null };
}

/**
 * Get enhanced target info for display.
 * @param {Object} params
 * @param {Token} params.sourceToken - The source token
 * @param {Token} params.targetToken - The target token
 * @param {Item} params.item - The item being used
 * @param {Object} [params.activity] - Optional action
 * @returns {Object} Target info for display
 */
export function getTargetInfo({ sourceToken, targetToken, item, activity = null }) {
    const info = {
        name: targetToken?.name || 'Unknown',
        img: targetToken?.document?.texture?.src || 'icons/svg/mystery-man.svg',
        inRange: true,
        inLongRange: true, // PF2e doesn't use long range
        coverStatus: 'none',
        isFlanked: false,
        distance: null,
        disposition: _getDispositionLabel(targetToken),
        statusEffects: []
    };

    if (!sourceToken || !targetToken || !canvas?.grid) {
        return info;
    }

    // Calculate distance using edge-to-edge grid-based measurement
    // This matches how core's TargetSelectorMath calculates distance
    const gridDistance = canvas.grid.distance || 5;
    const gridSize = canvas.grid.size;

    // Get token bounds in grid coordinates
    const sourceBounds = {
        left: Math.floor(sourceToken.document.x / gridSize),
        right: Math.floor(sourceToken.document.x / gridSize) + (sourceToken.document.width || 1) - 1,
        top: Math.floor(sourceToken.document.y / gridSize),
        bottom: Math.floor(sourceToken.document.y / gridSize) + (sourceToken.document.height || 1) - 1
    };
    const targetBounds = {
        left: Math.floor(targetToken.document.x / gridSize),
        right: Math.floor(targetToken.document.x / gridSize) + (targetToken.document.width || 1) - 1,
        top: Math.floor(targetToken.document.y / gridSize),
        bottom: Math.floor(targetToken.document.y / gridSize) + (targetToken.document.height || 1) - 1
    };

    // Find minimum Chebyshev distance between any grid squares
    let minGridDistance = Infinity;
    for (let sx = sourceBounds.left; sx <= sourceBounds.right; sx++) {
        for (let sy = sourceBounds.top; sy <= sourceBounds.bottom; sy++) {
            for (let tx = targetBounds.left; tx <= targetBounds.right; tx++) {
                for (let ty = targetBounds.top; ty <= targetBounds.bottom; ty++) {
                    const dx = Math.abs(sx - tx);
                    const dy = Math.abs(sy - ty);
                    const squareDistance = Math.max(dx, dy);
                    if (squareDistance < minGridDistance) {
                        minGridDistance = squareDistance;
                    }
                }
            }
        }
    }

    // If tokens overlap (same token or adjacent), distance is 0
    info.distance = minGridDistance === Infinity ? 0 : minGridDistance * gridDistance;

    // Check range
    const rangeInfo = calculateRange({ item, activity, actor: item?.actor });
    if (rangeInfo.range && info.distance > rangeInfo.range) {
        info.inRange = false;
    }

    // Check for flanking (PF2e specific)
    // Simplified check - real flanking is complex in PF2e
    if (targetToken.actor?.hasCondition?.('flat-footed')) {
        info.isFlanked = true;
    }

    // Get relevant conditions from target
    const conditions = targetToken.actor?.conditions || new Map();
    for (const [slug, condition] of conditions) {
        if (['prone', 'paralyzed', 'stunned', 'unconscious', 'restrained', 'flat-footed', 'frightened'].includes(slug)) {
            info.statusEffects.push(slug);
        }
    }

    return info;
}

/**
 * Calculate effective range for an item/action.
 * @param {Object} params
 * @param {Item} params.item - The item
 * @param {Object} [params.activity] - Optional action
 * @param {Actor} [params.actor] - The actor using the item
 * @returns {Object} Range info
 */
export function calculateRange({ item, activity = null, actor = null }) {
    const rangeInfo = {
        range: null,
        longRange: null,
        units: 'ft',
        isTouch: false,
        isSelf: false,
        isUnlimited: false
    };

    if (!item) return rangeInfo;

    // Get range configuration
    const range = item.system?.range;

    if (!range) return rangeInfo;

    // Handle different range types
    if (typeof range === 'number') {
        rangeInfo.range = range;
        // Assume feet if just a number, convert if scene uses different units
        rangeInfo.range = _convertToSceneUnits(rangeInfo.range, 'feet');
        return rangeInfo;
    }

    if (typeof range === 'object') {
        // Check value - PF2e often stores range as "60 feet" string
        if (range.value) {
            // Parse numeric value and units from string (e.g., "60 feet" -> 60, "feet")
            if (typeof range.value === 'string') {
                const numericMatch = range.value.match(/^(\d+)\s*(feet|foot|ft|meters?|m)?/i);
                if (numericMatch) {
                    rangeInfo.range = parseInt(numericMatch[1], 10);
                    // Detect units from string
                    const unitStr = numericMatch[2]?.toLowerCase() || '';
                    if (unitStr.includes('meter') || unitStr === 'm') {
                        rangeInfo.units = 'm';
                    } else {
                        rangeInfo.units = 'ft';
                    }
                }
            } else if (typeof range.value === 'number') {
                rangeInfo.range = range.value;
            }
        }

        // Check increment (for ranged weapons)
        if (range.increment) {
            // PF2e uses range increments - multiply by number of increments for max range
            // Typically 6 increments max
            rangeInfo.range = range.increment * 6;
        }

        // Touch range
        if (range.value === 'touch' || item.system?.traits?.value?.includes('touch')) {
            rangeInfo.isTouch = true;
            rangeInfo.range = canvas?.scene?.grid?.distance || 5;
            // Touch uses scene units directly, no conversion needed
            return rangeInfo;
        }
    }

    // Check for reach trait
    const traits = item.system?.traits?.value || [];
    if (traits.includes('reach')) {
        const reach = item.system?.reach || 10;
        if (!rangeInfo.range || reach > rangeInfo.range) {
            rangeInfo.range = reach;
        }
    }

    // PF2e uses 5-foot squares. Convert range from feet to GRID SQUARES.
    // This ensures the range indicator works correctly regardless of scene grid configuration.
    if (rangeInfo.range && rangeInfo.units === 'ft') {
        const feetPerSquare = 5; // PF2e standard
        rangeInfo.rangeInSquares = rangeInfo.range / feetPerSquare;
        rangeInfo.rangeInFeet = rangeInfo.range; // Keep original for display
        rangeInfo.range = rangeInfo.rangeInSquares; // Return squares, not feet
    }

    return rangeInfo;
}

/**
 * Convert a range value to scene units.
 * @param {number} value - The range value
 * @param {string} fromUnits - Source units ('ft', 'feet', 'm', 'meters')
 * @returns {number} Range in scene units
 * @private
 */
function _convertToSceneUnits(value, fromUnits) {
    if (!value || !canvas?.scene?.grid) return value;

    const sceneUnits = canvas.scene.grid.units?.toLowerCase() || 'ft';
    const fromFeet = fromUnits === 'ft' || fromUnits === 'feet' || fromUnits === 'foot';
    const sceneIsFeet = sceneUnits.includes('ft') || sceneUnits.includes('feet') || sceneUnits.includes('foot');
    const sceneIsMeters = sceneUnits.includes('m') || sceneUnits.includes('meter');

    // If scene uses feet and range is in feet, no conversion
    if (fromFeet && sceneIsFeet) {
        return value;
    }

    // If scene uses meters and range is in meters, no conversion
    if (!fromFeet && sceneIsMeters) {
        return value;
    }

    // Convert feet to meters (1 foot = 0.3048 meters)
    if (fromFeet && sceneIsMeters) {
        return Math.round(value * 0.3048 * 10) / 10; // Round to 1 decimal
    }

    // Convert meters to feet (1 meter = 3.28084 feet)
    if (!fromFeet && sceneIsFeet) {
        return Math.round(value * 3.28084);
    }

    // Unknown units, assume compatible
    return value;
}

// ========== Private Helper Functions ==========

/**
 * Check if target is an enemy of source.
 * @param {Token} sourceToken
 * @param {Token} targetToken
 * @returns {boolean}
 * @private
 */
function _isEnemy(sourceToken, targetToken) {
    if (!sourceToken || !targetToken) return false;

    const sourceDisp = sourceToken.document.disposition;
    const targetDisp = targetToken.document.disposition;

    const HOSTILE = CONST.TOKEN_DISPOSITIONS?.HOSTILE ?? -1;
    const FRIENDLY = CONST.TOKEN_DISPOSITIONS?.FRIENDLY ?? 1;

    // If source is friendly, enemies are hostile
    if (sourceDisp === FRIENDLY) {
        return targetDisp === HOSTILE;
    }

    // If source is hostile, enemies are friendly
    if (sourceDisp === HOSTILE) {
        return targetDisp === FRIENDLY;
    }

    return targetDisp === HOSTILE;
}

/**
 * Check if target is friendly to source.
 * @param {Token} sourceToken
 * @param {Token} targetToken
 * @returns {boolean}
 * @private
 */
function _isFriendly(sourceToken, targetToken) {
    if (!sourceToken || !targetToken) return false;

    if (sourceToken === targetToken) return true;

    const sourceDisp = sourceToken.document.disposition;
    const targetDisp = targetToken.document.disposition;

    return sourceDisp === targetDisp;
}

/**
 * Get disposition label for a token.
 * @param {Token} token
 * @returns {string}
 * @private
 */
function _getDispositionLabel(token) {
    if (!token) return 'unknown';

    const disposition = token.document.disposition;
    const HOSTILE = CONST.TOKEN_DISPOSITIONS?.HOSTILE ?? -1;
    const NEUTRAL = CONST.TOKEN_DISPOSITIONS?.NEUTRAL ?? 0;
    const FRIENDLY = CONST.TOKEN_DISPOSITIONS?.FRIENDLY ?? 1;

    if (disposition === HOSTILE) return 'hostile';
    if (disposition === NEUTRAL) return 'neutral';
    if (disposition === FRIENDLY) return 'friendly';
    return 'unknown';
}

/**
 * Pf2eTargetingRules object containing all exported targeting functions.
 * Register this with the adapter for core to use.
 */
export const Pf2eTargetingRules = {
    needsTargeting,
    getTargetRequirements,
    isValidTargetType,
    getTargetInfo,
    calculateRange
};
