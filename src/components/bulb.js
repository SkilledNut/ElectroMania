import { Component } from './component.js';

class Bulb extends Component {
    constructor(id, start, end, maxWattage = 5) {
        super(id, 'bulb', start, end, 'src/components/lamp.png', true);
        this.is_on = true;
        this.maxWattage = maxWattage; // Maximum wattage the bulb can handle (default 5W)
        this.currentWattage = 0; // Current power through the bulb
        this.isBurnedOut = false; // Whether the bulb has burned out
        this.resistance = 1; // Bulb resistance in ohms
    }

    /**
     * Calculate power through the bulb and check if it burns out
     * P = I² * R (power in watts)
     */
    calculatePower(current) {
        this.currentWattage = current * current * this.resistance;
        return this.currentWattage;
    }

    /**
     * Check if the bulb should burn out based on current power
     * Returns true if bulb just burned out
     */
    checkBurnout(current) {
        if (this.isBurnedOut) return false; // Already burned out
        
        const power = this.calculatePower(current);
        
        if (power > this.maxWattage) {
            this.burnOut();
            return true;
        }
        return false;
    }

    /**
     * Burn out the bulb - it will no longer conduct electricity
     */
    burnOut() {
        this.isBurnedOut = true;
        this.is_on = false;
        console.log(`💥 Bulb ${this.id} burned out! Power: ${this.currentWattage.toFixed(2)}W exceeded max: ${this.maxWattage}W`);
    }

    /**
     * Replace/repair the bulb (reset burned out state)
     */
    replace() {
        this.isBurnedOut = false;
        this.is_on = true;
        this.currentWattage = 0;
        console.log(`🔧 Bulb ${this.id} has been replaced.`);
    }

    /**
     * Check if bulb can conduct (not burned out)
     */
    canConduct() {
        return !this.isBurnedOut;
    }
}

export { Bulb };