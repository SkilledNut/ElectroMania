import { Component } from './component.js';

class Fuse extends Component {
    constructor(id, start, end, maxCurrent = 1.0) {
        super(id, 'fuse', start, end, 'src/components/fuse.png', true);
        this.maxCurrent = maxCurrent; // Maximum current in Amps before blowing
        this.isBlown = false;
        this.currentThrough = 0;
    }

    /**
     * Check if fuse should blow based on current
     * Returns true if fuse just blew
     */
    checkBlow(current) {
        if (this.isBlown) return false;
        
        this.currentThrough = current;
        
        if (current > this.maxCurrent) {
            this.blow();
            return true;
        }
        return false;
    }

    /**
     * Blow the fuse - it will no longer conduct electricity
     */
    blow() {
        this.isBlown = true;
        console.log(`⚡ Fuse ${this.id} blown! Current: ${this.currentThrough.toFixed(2)}A exceeded max: ${this.maxCurrent}A`);
    }

    /**
     * Replace the fuse (reset blown state)
     */
    replace() {
        this.isBlown = false;
        this.currentThrough = 0;
        console.log(`🔧 Fuse ${this.id} has been replaced.`);
    }

    /**
     * Check if fuse can conduct (not blown)
     */
    canConduct() {
        return !this.isBlown;
    }

    /**
     * Set the maximum current rating
     */
    setMaxCurrent(maxCurrent) {
        if (maxCurrent > 0 && maxCurrent <= 100) {
            this.maxCurrent = maxCurrent;
        }
    }
}

export { Fuse };
