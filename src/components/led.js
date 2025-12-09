import { Component } from './component.js';

// Available LED colors
const LED_COLORS = {
    red: { name: 'Rdeča', hex: 0xff3333, glowHex: 0xff6666 },
    green: { name: 'Zelena', hex: 0x33ff33, glowHex: 0x66ff66 },
    blue: { name: 'Modra', hex: 0x3366ff, glowHex: 0x6699ff },
    yellow: { name: 'Rumena', hex: 0xffcc00, glowHex: 0xffee66 },
    white: { name: 'Bela', hex: 0xffffff, glowHex: 0xffffff }
};

class LED extends Component {
    constructor(id, start, end, color = 'red') {
        super(id, 'led', start, end, 'src/components/led.png', true);
        this.is_on = false;
        this.ledColor = color;
        this.forwardVoltage = 2.0; // Typical forward voltage drop for LED
        this.maxCurrent = 5; // 5A max current
        this.isBurnedOut = false;
        this.isReverseBiased = false; // Set by circuit simulation
        this.currentThrough = 0;
        // LEDs only conduct in one direction (forward biased)
        this.isForwardBiased = true; // Will be set based on circuit polarity
    }

    /**
     * Set the LED color
     */
    setColor(colorKey) {
        if (LED_COLORS[colorKey]) {
            this.ledColor = colorKey;
        }
    }

    /**
     * Get the hex color value for rendering
     */
    getColorHex() {
        return LED_COLORS[this.ledColor]?.hex || LED_COLORS.red.hex;
    }

    /**
     * Get the glow hex color value
     */
    getGlowHex() {
        return LED_COLORS[this.ledColor]?.glowHex || LED_COLORS.red.glowHex;
    }

    /**
     * Check if LED should burn out (overcurrent)
     */
    checkBurnout(current) {
        if (this.isBurnedOut) return false;
        
        this.currentThrough = current;
        
        if (current > this.maxCurrent * 2) { // Burn out at 2x max current
            this.burnOut();
            return true;
        }
        return false;
    }

    /**
     * Burn out the LED
     */
    burnOut() {
        this.isBurnedOut = true;
        this.is_on = false;
        console.log(`💥 LED ${this.id} burned out! Current: ${(this.currentThrough * 1000).toFixed(1)}mA exceeded max: ${this.maxCurrent * 1000}mA`);
    }

    /**
     * Replace the LED
     */
    replace() {
        this.isBurnedOut = false;
        this.is_on = false;
        this.currentThrough = 0;
        console.log(`🔧 LED ${this.id} has been replaced.`);
    }

    /**
     * Check if LED can conduct
     */
    canConduct() {
        return !this.isBurnedOut && this.isForwardBiased;
    }

    /**
     * Get all available colors
     */
    static getAvailableColors() {
        return LED_COLORS;
    }
}

export { LED, LED_COLORS };
