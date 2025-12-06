import { Component } from './component.js';

class Ammeter extends Component {
    constructor(id, start, end) {
        super(id, 'ammeter', start, end, 'src/components/ammeter.png', false);
        this.current = 0; // Current in Amperes
        this.debug_color = 0x00cc66;
    }

    // Ammeter conducts electricity (it's in series)
    conducts() {
        return true;
    }

    // Set the measured current
    setCurrent(current) {
        this.current = current;
    }

    // Get the current reading
    getCurrent() {
        return this.current;
    }
}

export { Ammeter };
