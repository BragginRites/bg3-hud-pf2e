/**
 * PF2e Portrait Container
 * This will be dynamically created to extend the core PortraitContainer
 * when the module loads and core is available
 */
export async function createPf2ePortraitContainer() {
    // Import core components dynamically
    const { PortraitContainer } = await import('/modules/bg3-hud-core/scripts/components/containers/PortraitContainer.js');
    const BG3ComponentModule = await import('/modules/bg3-hud-core/scripts/components/BG3Component.js');
    const BG3Component = BG3ComponentModule.BG3Component;

    /**
     * Portrait Health Component
     * Displays HP, temp HP, and optional HP controls for PF2e
     */
    class PortraitHealth extends BG3Component {
        /**
         * Create a new portrait health component
         * @param {Object} options - Component options
         * @param {Actor} options.actor - The actor
         * @param {Token} options.token - The token
         * @param {BG3Component} options.parent - Parent container
         */
        constructor(options = {}) {
            super(options);
            this.actor = options.actor;
            this.token = options.token;
            this.parent = options.parent;
        }

        /**
         * Get health data from parent or directly from actor
         * @returns {Object} Health data
         */
        getHealth() {
            if (this.parent && typeof this.parent.getHealth === 'function') {
                return this.parent.getHealth();
            }

            // Fallback: calculate directly
            const hpValue = this.actor.system.attributes?.hp?.value || 0;
            const hpMax = this.actor.system.attributes?.hp?.max || 1;
            const hpPercent = Math.max(0, Math.min(100, (hpValue / hpMax) * 100));
            const damagePercent = 100 - hpPercent;
            const tempHp = this.actor.system.attributes?.hp?.temp || 0;

            return {
                current: hpValue,
                max: hpMax,
                percent: hpPercent,
                damage: damagePercent,
                temp: tempHp
            };
        }

        /**
         * Check if HP controls should be enabled
         * @returns {boolean}
         */
        canModifyHP() {
            return this.actor?.canUserModify(game.user, "update") ?? false;
        }

        /**
         * Render the health display
         * @returns {Promise<HTMLElement>}
         */
        async render() {
            // Create or reuse element
            if (!this.element) {
                this.element = this.createElement('div', ['hp-text']);
            }

            const health = this.getHealth();
            const hpControls = this.canModifyHP();

            // Clear existing content
            this.element.innerHTML = '';

            // Temp HP display
            if (health.temp > 0) {
                const tempHpText = this.createElement('div', ['temp-hp-text']);
                tempHpText.textContent = `+${health.temp}`;
                this.element.appendChild(tempHpText);
            }

            // HP Label (shown by default)
            const hpLabel = this.createElement('div', ['hp-label']);
            hpLabel.textContent = `${health.current}/${health.max}`;
            this.element.appendChild(hpLabel);

            // HP Controls (shown on hover if user can modify)
            if (hpControls) {
                const hpControlsDiv = this.createElement('div', ['hp-controls']);

                // Death button (set HP and temp HP to 0)
                const deathBtn = this.createElement('div', ['hp-control-death']);
                // Mark as UI element to prevent system tooltips (pf2e, etc.) from showing
                deathBtn.dataset.bg3Ui = 'true';
                const deathIcon = this.createElement('i', ['fas', 'fa-skull']);
                deathIcon.dataset.tooltip = 'Set to 0 HP';
                deathBtn.appendChild(deathIcon);
                this.addEventListener(deathBtn, 'click', async (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (this.actor.system.attributes.hp.value > 0 || this.actor.system.attributes.hp.temp > 0) {
                        await this.actor.update({
                            'system.attributes.hp.value': 0,
                            'system.attributes.hp.temp': 0
                        });
                    }
                });
                hpControlsDiv.appendChild(deathBtn);

                // HP Input field
                const hpInput = this.createElement('input', ['hp-input']);
                hpInput.type = 'text';
                hpInput.value = health.current + health.temp;
                hpInput.max = health.max;

                // Input event handlers
                this.addEventListener(hpInput, 'click', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                });

                this.addEventListener(hpInput, 'keydown', (event) => {
                    if (event.code === "Enter" || event.code === "NumpadEnter") {
                        event.currentTarget.blur();
                    }
                });

                this.addEventListener(hpInput, 'focusin', (event) => {
                    event.target.select();
                    this.element.dataset.hpLocked = 'true';
                });

                this.addEventListener(hpInput, 'focusout', async (event) => {
                    const inputValue = event.currentTarget.value.trim();
                    const { value, delta, isDelta } = this._parseAttributeInput(inputValue);

                    await this.actor.modifyTokenAttribute('attributes.hp', isDelta ? delta : value, isDelta);

                    if (isDelta && event.target.value === inputValue) {
                        event.target.value = this.actor.system.attributes.hp.value;
                    }

                    this.element.dataset.hpLocked = 'false';
                });

                hpControlsDiv.appendChild(hpInput);

                // Full heal button
                const fullBtn = this.createElement('div', ['hp-control-full']);
                // Mark as UI element to prevent system tooltips (pf2e, etc.) from showing
                fullBtn.dataset.bg3Ui = 'true';
                const fullIcon = this.createElement('i', ['fas', 'fa-heart']);
                fullIcon.dataset.tooltip = 'Full Heal';
                fullBtn.appendChild(fullIcon);
                this.addEventListener(fullBtn, 'click', async (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (this.actor.system.attributes.hp.value < this.actor.system.attributes.hp.max) {
                        await this.actor.update({ 'system.attributes.hp.value': this.actor.system.attributes.hp.max });
                    }
                });
                hpControlsDiv.appendChild(fullBtn);

                this.element.appendChild(hpControlsDiv);
            }

            // Disable pointer events if can't modify
            if (!hpControls) {
                this.element.style.setProperty('pointer-events', 'none');
            } else {
                this.element.style.removeProperty('pointer-events');
            }

            return this.element;
        }

        /**
         * Update health display without full re-render
         * Only updates the text content and temp HP, much faster than render()
         */
        async updateHealth() {
            if (!this.element) {
                console.warn('PortraitHealth | Cannot update health, element not rendered yet');
                return;
            }

            const health = this.getHealth();

            // Update temp HP
            const existingTempHp = this.element.querySelector('.temp-hp-text');
            if (health.temp > 0) {
                if (existingTempHp) {
                    existingTempHp.textContent = `+${health.temp}`;
                } else {
                    const tempHpText = this.createElement('div', ['temp-hp-text']);
                    tempHpText.textContent = `+${health.temp}`;
                    this.element.insertBefore(tempHpText, this.element.firstChild);
                }
            } else if (existingTempHp) {
                existingTempHp.remove();
            }

            // Update HP label
            const hpLabel = this.element.querySelector('.hp-label');
            if (hpLabel) {
                hpLabel.textContent = `${health.current}/${health.max}`;
            }

            // Update HP input if it exists and is not currently focused
            const hpInput = this.element.querySelector('.hp-input');
            if (hpInput && this.element.dataset.hpLocked !== 'true') {
                hpInput.value = health.current + health.temp;
            }
        }

        /**
         * Parse HP input (supports =, +, -, %)
         * @param {string} input - The input string
         * @returns {Object} Parsed value and delta
         * @private
         */
        _parseAttributeInput(input) {
            const isEqual = input.startsWith("=");
            const isDelta = input.startsWith("+") || input.startsWith("-");
            const current = this.actor.system.attributes.hp.value;
            let v;

            // Explicit equality
            if (isEqual) input = input.slice(1);

            // Percentage change
            if (input.endsWith("%")) {
                const p = Number(input.slice(0, -1)) / 100;
                v = this.actor.system.attributes.hp.max * p;
            }
            // Additive delta
            else {
                v = Number(input);
            }

            // Return parsed input
            const value = isDelta ? current + v : v;
            const delta = isDelta ? v : undefined;
            return { value, delta, isDelta };
        }
    }

    /**
     * PF2e Portrait Container
     * Extends the core PortraitContainer with PF2e specific features:
     * - Health/temp HP display
     * - PF2e specific styling
     */
    class Pf2ePortraitContainer extends PortraitContainer {
        /**
         * Create a new PF2e portrait container
         * @param {Object} options - Container options
         * @param {Actor} options.actor - The actor to display
         * @param {Token} options.token - The token to display
         */
        constructor(options = {}) {
            super(options);
            this.components = {};
        }

        /**
         * Get PF2e specific health data
         * @returns {Object} Health data including current, max, temp, percent
         */
        getHealth() {
            const hpValue = this.actor.system.attributes?.hp?.value || 0;
            const hpMax = this.actor.system.attributes?.hp?.max || 1;
            const hpPercent = Math.max(0, Math.min(100, (hpValue / hpMax) * 100));
            const damagePercent = 100 - hpPercent;
            const tempHp = this.actor.system.attributes?.hp?.temp || 0;

            return {
                current: hpValue,
                max: hpMax,
                percent: hpPercent,
                damage: damagePercent,
                temp: tempHp
            };
        }

        /**
         * Get portrait image URL
         * Defaults to token image unless explicitly set to use actor portrait
         * @returns {string} Image URL
         */
        getPortraitImage() {
            // Check saved preference (undefined means use default: token image)
            const useTokenImage = this.actor?.getFlag('bg3-hud-pf2e', 'useTokenImage') ?? true;

            if (useTokenImage) {
                return this.token?.document?.texture?.src || this.actor?.img || '';
            } else {
                return this.actor?.img || this.token?.document?.texture?.src || '';
            }
        }

        /**
         * Update image preference (toggle between token and portrait)
         * @returns {Promise<void>}
         */
        async updateImagePreference() {
            if (!this.actor) return;

            // Get current preference
            const currentPreference = this.actor.getFlag('bg3-hud-pf2e', 'useTokenImage') ?? true;

            // Toggle the preference
            const newPreference = !currentPreference;

            // Save to actor flags
            await this.actor.setFlag('bg3-hud-pf2e', 'useTokenImage', newPreference);

            // The UpdateCoordinator will handle the re-render via _handleAdapterFlags
        }

        /**
         * Render the PF2e portrait container
         * @returns {Promise<HTMLElement>}
         */
        async render() {
            // Create container if not exists
            if (!this.element) {
                this.element = this.createElement('div', ['bg3-portrait-container']);
            }

            if (!this.token || !this.actor) {
                console.warn('Pf2ePortraitContainer | No token or actor provided');
                return this.element;
            }

            // Clear existing content
            this.element.innerHTML = '';

            // Add info container (button + panel) if provided by core
            if (this.infoContainer) {
                try {
                    const infoElement = await this.infoContainer.render();
                    this.element.appendChild(infoElement);
                } catch (e) {
                    console.warn('Pf2ePortraitContainer | Failed to render info container', e);
                }
            }

            // Get health data
            const health = this.getHealth();
            const imageSrc = this.getPortraitImage();

            // Build portrait structure
            const portraitImageContainer = this.createElement('div', ['portrait-image-container']);
            const portraitImageSubContainer = this.createElement('div', ['portrait-image-subcontainer']);

            // Portrait image
            const img = this.createElement('img', ['portrait-image']);
            img.src = imageSrc;
            img.alt = this.actor?.name || 'Portrait';

            // Health overlay (red damage indicator) - check setting
            const showHealthOverlay = game.settings.get('bg3-hud-pf2e', 'showHealthOverlay') ?? true;
            if (showHealthOverlay) {
                const healthOverlay = this.createElement('div', ['health-overlay']);
                const damageOverlay = this.createElement('div', ['damage-overlay']);
                damageOverlay.style.setProperty('--damage-percent', health.damage);
                healthOverlay.appendChild(damageOverlay);

                // Apply alpha mask so overlays only affect non-transparent pixels of the image
                portraitImageSubContainer.setAttribute('data-bend-mode', 'true');
                portraitImageSubContainer.style.setProperty('--bend-img', `url("${img.src}")`);
                this.element.classList.add('use-bend-mask');

                portraitImageSubContainer.appendChild(healthOverlay);
            }

            // Assemble portrait image structure
            portraitImageSubContainer.appendChild(img);
            portraitImageContainer.appendChild(portraitImageSubContainer);

            // Add portrait data badges (from core PortraitContainer)
            await this._renderPortraitData(portraitImageContainer);

            this.element.appendChild(portraitImageContainer);

            // Register context menu for portrait image (right-click to toggle token/portrait)
            this._registerPortraitMenu(portraitImageContainer);

            // Add health text component
            this.components.health = new PortraitHealth({
                actor: this.actor,
                token: this.token,
                parent: this
            });
            const healthElement = await this.components.health.render();
            this.element.appendChild(healthElement);

            return this.element;
        }

        /**
         * Update only the health display without full re-render
         * This is called when HP changes to avoid re-rendering the entire UI
         */
        async updateHealth() {
            if (!this.element || !this.token || !this.actor) {
                return;
            }

            // Get updated health data
            const health = this.getHealth();

            // Update damage overlay height
            const showHealthOverlay = game.settings.get('bg3-hud-pf2e', 'showHealthOverlay') ?? true;
            const damageOverlay = this.element.querySelector('.damage-overlay');
            if (damageOverlay && showHealthOverlay) {
                damageOverlay.style.setProperty('--damage-percent', health.damage);
            } else if (damageOverlay && !showHealthOverlay) {
                // Remove overlay if setting is disabled
                damageOverlay.remove();
            } else if (!damageOverlay && showHealthOverlay) {
                // Add overlay if setting is enabled and it doesn't exist
                const portraitImageSubContainer = this.element.querySelector('.portrait-image-subcontainer');
                if (portraitImageSubContainer) {
                    const img = portraitImageSubContainer.querySelector('.portrait-image');
                    if (img) {
                        const healthOverlay = this.createElement('div', ['health-overlay']);
                        const newDamageOverlay = this.createElement('div', ['damage-overlay']);
                        newDamageOverlay.style.setProperty('--damage-percent', health.damage);
                        healthOverlay.appendChild(newDamageOverlay);

                        portraitImageSubContainer.appendChild(healthOverlay);

                        // Apply alpha mask if not already applied
                        if (!portraitImageSubContainer.hasAttribute('data-bend-mode')) {
                            portraitImageSubContainer.setAttribute('data-bend-mode', 'true');
                            portraitImageSubContainer.style.setProperty('--bend-img', `url("${img.src}")`);
                            this.element.classList.add('use-bend-mask');
                        }
                    }
                }
            }

            // Update health text component
            if (this.components.health && typeof this.components.health.updateHealth === 'function') {
                await this.components.health.updateHealth();
            }
        }

        /**
         * Destroy the container and cleanup
         */
        destroy() {
            // Destroy child components
            for (const [key, component] of Object.entries(this.components)) {
                if (component && typeof component.destroy === 'function') {
                    component.destroy();
                }
            }
            this.components = {};

            // Call parent destroy
            super.destroy();
        }
    }

    return Pf2ePortraitContainer;
}

