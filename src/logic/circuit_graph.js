/**
 * CircuitGraph - Complete rewrite for robust circuit analysis
 *
 * Core concepts:
 * 1. Components have two terminals (start/end) with world coordinates
 * 2. Terminals within CONNECTION_THRESHOLD distance are electrically connected
 * 3. We build a connection map: position -> list of components touching that position
 * 4. Path finding uses BFS to find routes from battery positive to negative
 */

class CircuitGraph {
  constructor() {
    this.components = [];
    this.CONNECTION_THRESHOLD = 60; // Snap distance for electrical connection
  }

  /**
   * Clear and rebuild the entire circuit from placed components
   */
  clear() {
    this.components = [];
  }

  /**
   * Add a component to the circuit
   * Component must have: id, type, start {x, y}, end {x, y}
   */
  addComponent(component) {
    if (!component || !component.start || !component.end) {
      console.warn("[Graph] Invalid component, skipping:", component);
      return;
    }

    // Store the component
    this.components.push({
      id: component.id,
      type: component.type,
      start: {
        x: Math.round(component.start.x),
        y: Math.round(component.start.y),
      },
      end: { x: Math.round(component.end.x), y: Math.round(component.end.y) },
      is_on: component.is_on !== undefined ? component.is_on : true, // For switches
      originalComponent: component, // Keep reference for updating state
    });
  }

  /**
   * Check if a component conducts electricity
   */
  isConductive(comp) {
    if (!comp) return false;

    // Battery is NOT conductive (it's a source, not a path)
    if (comp.type === "battery") return false;

    // Voltmeter does NOT conduct (parallel connection, high resistance)
    if (comp.type === "voltmeter") return false;

    // Switch conductivity depends on state
    if (comp.type === "switch") return comp.is_on === true;

    // Wires, bulbs, resistors, and ammeters conduct
    return ["wire", "bulb", "resistor", "ammeter"].includes(comp.type);
  }

  /**
   * Get position key for terminal grouping
   */
  posKey(x, y) {
    return `${Math.round(x)},${Math.round(y)}`;
  }

  /**
   * Check if two positions are close enough to be electrically connected
   */
  areConnected(pos1, pos2) {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    return Math.hypot(dx, dy) <= this.CONNECTION_THRESHOLD;
  }

  /**
   * Build a connection map: each position maps to list of components with a terminal there
   * Returns: { positionKey: [{component, terminal: 'start'|'end'}] }
   */
  buildConnectionMap() {
    const connectionMap = new Map();

    for (const comp of this.components) {
      // Add start terminal
      const startKey = this.posKey(comp.start.x, comp.start.y);
      if (!connectionMap.has(startKey)) {
        connectionMap.set(startKey, []);
      }
      connectionMap.get(startKey).push({ component: comp, terminal: "start" });

      // Add end terminal
      const endKey = this.posKey(comp.end.x, comp.end.y);
      if (!connectionMap.has(endKey)) {
        connectionMap.set(endKey, []);
      }
      connectionMap.get(endKey).push({ component: comp, terminal: "end" });
    }

    // Merge nearby positions within CONNECTION_THRESHOLD
    const mergedMap = new Map();
    const processed = new Set();

    for (const [key1, terminals1] of connectionMap) {
      if (processed.has(key1)) continue;

      const [x1, y1] = key1.split(",").map(Number);
      const mergedTerminals = [...terminals1];
      processed.add(key1);

      // Find all nearby positions
      for (const [key2, terminals2] of connectionMap) {
        if (key1 === key2 || processed.has(key2)) continue;

        const [x2, y2] = key2.split(",").map(Number);
        if (this.areConnected({ x: x1, y: y1 }, { x: x2, y: y2 })) {
          mergedTerminals.push(...terminals2);
          processed.add(key2);
        }
      }

      mergedMap.set(key1, mergedTerminals);
    }

    return mergedMap;
  }

  /**
   * Find all complete paths from battery positive to battery negative
   * Returns array of paths, where each path is array of component IDs
   * For multiple batteries, finds paths through all battery combinations
   */
  findCircuitPaths() {
    // Find all batteries
    const batteries = this.components.filter((c) => c.type === "battery");
    if (batteries.length === 0) {
      console.log("[Graph] No battery found");
      return [];
    }

    console.log(`[Graph] Found ${batteries.length} battery/batteries`);
    
    // Build connection map
    const connectionMap = this.buildConnectionMap();

    console.log(
      "[Graph] Connection map built with",
      connectionMap.size,
      "junction points"
    );
    for (const [key, terminals] of connectionMap) {
      console.log(
        `  Junction ${key}:`,
        terminals.map(
          (t) => `${t.component.type}(${t.component.id}):${t.terminal}`
        )
      );
    }

    // Find paths for each battery (or through multiple batteries)
    const allPaths = [];
    
    for (const battery of batteries) {
      // BFS from battery start to battery end
      const startKey = this.posKey(battery.start.x, battery.start.y);
      const targetKey = this.posKey(battery.end.x, battery.end.y);

      console.log(`[Graph] Searching paths for battery ${battery.id} from`, startKey, "to", targetKey);

      const queue = [
        {
          posKey: startKey,
          visited: new Set(),
          path: [],
          batteriesInPath: [battery], // Track batteries in this path
        },
      ];

      let iterations = 0;
      const MAX_ITERATIONS = 10000;

      while (queue.length > 0 && iterations < MAX_ITERATIONS) {
        iterations++;
        const { posKey, visited, path, batteriesInPath } = queue.shift();

        // Check if we reached the target
        if (posKey === targetKey && path.length > 0) {
          console.log(
            "[Graph] ✓ Found complete path:",
            path.map((c) => `${c.type}(${c.id})`).join(" -> ")
          );
          allPaths.push({ path, batteries: batteriesInPath });
          continue;
        }

        // Get all terminals at this position
        const terminals = connectionMap.get(posKey) || [];

        for (const { component, terminal } of terminals) {
          // Skip if already visited this component
          if (visited.has(component.id)) continue;

          // Handle batteries specially - they can be in series
          if (component.type === "battery") {
            // If this is a different battery, we can include it (series connection)
            if (component.id !== battery.id) {
              const otherTerminal = terminal === "start" ? "end" : "start";
              const nextPos = component[otherTerminal];
              const nextPosKey = this.posKey(nextPos.x, nextPos.y);

              const newVisited = new Set(visited);
              newVisited.add(component.id);
              const newBatteries = [...batteriesInPath, component];

              console.log(
                `[Graph]   Adding battery ${component.id} in series (total: ${newBatteries.length})`
              );

              queue.push({
                posKey: nextPosKey,
                visited: newVisited,
                path: path,
                batteriesInPath: newBatteries,
              });
            }
            continue;
          }

          // Skip non-conductive components
          if (!this.isConductive(component)) {
            console.log(
              `[Graph]   Skip ${component.type}(${component.id}) - not conductive`
            );
            continue;
          }

          // Traverse to the other end of this component
          const otherTerminal = terminal === "start" ? "end" : "start";
          const nextPos = component[otherTerminal];
          const nextPosKey = this.posKey(nextPos.x, nextPos.y);

          // Create new state for this path
          const newVisited = new Set(visited);
          newVisited.add(component.id);
          const newPath = [...path, component];

          console.log(
            `[Graph]   Traverse ${component.type}(${component.id}) from ${posKey} to ${nextPosKey}`
          );

          queue.push({
            posKey: nextPosKey,
            visited: newVisited,
            path: newPath,
            batteriesInPath: batteriesInPath,
          });
        }
      }

      if (iterations >= MAX_ITERATIONS) {
        console.warn("[Graph] Max iterations reached in BFS");
      }
    }

    console.log(`[Graph] Found ${allPaths.length} complete circuit path(s)`);
    return allPaths;
  }

  /**
   * Check if the circuit is complete (at least one path exists)
   */
  isCircuitComplete() {
    const paths = this.findCircuitPaths();
    return paths.length > 0;
  }

  /**
   * Calculate voltage across a voltmeter
   * Voltmeters measure the voltage drop between their terminals
   */
  calculateVoltmeterReading(voltmeter, paths, measurements) {
    if (paths.length === 0 || !measurements) {
      return 0;
    }

    const connectionMap = this.buildConnectionMap();
    const startKey = this.posKey(voltmeter.start.x, voltmeter.start.y);
    const endKey = this.posKey(voltmeter.end.x, voltmeter.end.y);
    
    const startTerminals = connectionMap.get(startKey) || [];
    const endTerminals = connectionMap.get(endKey) || [];
    
    // Check if voltmeter is connected to other components
    const startHasConnection = startTerminals.some(t => t.component.id !== voltmeter.id);
    const endHasConnection = endTerminals.some(t => t.component.id !== voltmeter.id);
    
    if (!startHasConnection || !endHasConnection) {
      return 0;
    }

    // Find components between the voltmeter terminals in the circuit path
    const firstPath = paths[0];
    const pathComponents = firstPath.path || firstPath;
    
    // Check if voltmeter is measuring across a specific component
    const componentsAtStart = startTerminals
      .filter(t => t.component.id !== voltmeter.id && t.component.type !== "voltmeter")
      .map(t => t.component);
    
    const componentsAtEnd = endTerminals
      .filter(t => t.component.id !== voltmeter.id && t.component.type !== "voltmeter")
      .map(t => t.component);

    // If measuring across a single component (resistor, bulb, etc.)
    const measuredComponents = componentsAtStart.filter(comp => 
      componentsAtEnd.some(endComp => endComp.id === comp.id)
    );

    if (measuredComponents.length > 0) {
      // Calculate voltage drop across the measured component
      const comp = measuredComponents[0];
      let resistance = 0;
      
      if (comp.type === "resistor") {
        resistance = comp.originalComponent?.ohm || 1.5;
      } else if (comp.type === "bulb") {
        resistance = 1;
      } else if (comp.type === "ammeter") {
        resistance = 0.01;
      } else if (comp.type === "battery") {
        // Measuring across a battery shows its voltage
        return comp.originalComponent?.voltage || 3.3;
      }

      // V = I * R
      const voltageDrop = measurements.current * resistance;
      console.log(`[Graph] Voltmeter measuring ${voltageDrop.toFixed(2)}V across ${comp.type}(${comp.id})`);
      return voltageDrop;
    }

    // If connected in parallel to the circuit, show total voltage
    console.log(`[Graph] Voltmeter measuring total circuit voltage: ${measurements.totalVoltage.toFixed(2)}V`);
    return measurements.totalVoltage;
  }

  /**
   * Detect if batteries are connected in parallel
   * Parallel batteries have the same start and end connection points
   */
  detectParallelBatteries(paths) {
    const allBatteries = this.components.filter(c => c.type === "battery");
    if (allBatteries.length <= 1) {
      return { inParallel: false, parallelGroups: [] };
    }

    // Group batteries by their connection points
    const batteryGroups = new Map();
    
    for (const battery of allBatteries) {
      const startKey = this.posKey(battery.start.x, battery.start.y);
      const endKey = this.posKey(battery.end.x, battery.end.y);
      const groupKey = `${startKey}-${endKey}`;
      
      if (!batteryGroups.has(groupKey)) {
        batteryGroups.set(groupKey, []);
      }
      batteryGroups.get(groupKey).push(battery);
    }

    // Find groups with multiple batteries (parallel configuration)
    const parallelGroups = Array.from(batteryGroups.values()).filter(group => group.length > 1);
    
    if (parallelGroups.length > 0) {
      console.log(`[Graph] Detected ${parallelGroups.length} parallel battery group(s):`);
      parallelGroups.forEach((group, idx) => {
        console.log(`  Group ${idx + 1}: ${group.length} batteries in parallel (${group.map(b => b.id).join(', ')})`);
      });
    }

    return {
      inParallel: parallelGroups.length > 0,
      parallelGroups: parallelGroups
    };
  }

  /**
   * Calculate circuit measurements (voltage and current)
   * For multiple batteries in series, voltages add up
   * For batteries in parallel, voltage stays the same
   */
  calculateMeasurements(paths) {
    if (paths.length === 0) {
      return { voltage: 0, current: 0, totalVoltage: 0 };
    }

    // Detect parallel batteries
    const parallelInfo = this.detectParallelBatteries(paths);

    // Use the first complete path to calculate measurements
    const firstPath = paths[0];
    const pathComponents = firstPath.path || firstPath;
    const batteriesInPath = firstPath.batteries || [this.components.find((c) => c.type === "battery")];

    // Calculate total voltage
    let totalVoltage = 0;
    
    if (parallelInfo.inParallel && parallelInfo.parallelGroups.length > 0) {
      // For parallel batteries, voltage is the same (use the first battery's voltage)
      // In reality, all parallel batteries should have the same voltage
      const firstParallelGroup = parallelInfo.parallelGroups[0];
      const voltage = firstParallelGroup[0].originalComponent?.voltage || 3.3;
      totalVoltage = voltage;
      console.log(`[Graph] ${firstParallelGroup.length} batteries in PARALLEL: voltage = ${voltage}V (same as single battery)`);
    } else {
      // For series batteries, voltages add up
      for (const battery of batteriesInPath) {
        const voltage = battery.originalComponent?.voltage || 3.3;
        totalVoltage += voltage;
        console.log(`[Graph] Battery ${battery.id} contributes ${voltage}V`);
      }
      console.log(`[Graph] Total voltage from ${batteriesInPath.length} battery/batteries in SERIES: ${totalVoltage}V`);
    }

    // Calculate total resistance in the circuit
    let totalResistance = 0;
    
    for (const comp of pathComponents) {
      if (comp.type === "resistor") {
        // Get actual resistance value from the component
        totalResistance += comp.originalComponent?.ohm || 1.5;
      } else if (comp.type === "bulb") {
        // Bulbs have approximately 1Ω resistance
        totalResistance += 1;
      } else if (comp.type === "ammeter") {
        // Ammeters have negligible resistance (0.01Ω)
        totalResistance += 0.01;
      }
      // Wires and switches have negligible resistance
    }

    // Ensure minimum resistance to avoid division by zero
    if (totalResistance < 0.01) {
      totalResistance = 0.01;
    }

    // Using Ohm's law: I = V / R
    const current = totalVoltage / totalResistance;

    console.log(`[Graph] Total resistance: ${totalResistance.toFixed(2)}Ω`);
    console.log(`[Graph] Current: ${current.toFixed(2)}A`);

    return {
      voltage: totalVoltage, // Total voltage across the circuit
      current: current,
      totalVoltage: totalVoltage, // For clarity
      parallelBatteries: parallelInfo.inParallel,
    };
  }

  /**
   * Simulate the circuit and update component states
   * Returns: { status: number, paths: array of component arrays, measurements: object }
   */
  simulate() {
    const paths = this.findCircuitPaths();
    const isComplete = paths.length > 0;

    // Calculate measurements
    const measurements = this.calculateMeasurements(paths);

    // Build a set of component IDs that are in any complete path
    const componentsInPath = new Set();
    for (const pathObj of paths) {
      const pathComponents = pathObj.path || pathObj;
      for (const comp of pathComponents) {
        componentsInPath.add(comp.id);
      }
    }

    // Update bulbs - only turn on if in a complete circuit path
    const bulbs = this.components.filter((c) => c.type === "bulb");
    for (const bulb of bulbs) {
      const isInPath = componentsInPath.has(bulb.id);
      if (bulb.originalComponent) {
        bulb.originalComponent.is_on = isComplete && isInPath;
      }
    }

    // Update ammeters - they show current if in a complete path
    const ammeters = this.components.filter((c) => c.type === "ammeter");
    for (const ammeter of ammeters) {
      const isInPath = componentsInPath.has(ammeter.id);
      if (ammeter.originalComponent) {
        ammeter.originalComponent.current = isInPath && isComplete ? measurements.current : 0;
        ammeter.originalComponent.isInPath = isInPath && isComplete;
      }
    }

    // Update voltmeters - calculate voltage based on what they're measuring
    const voltmeters = this.components.filter((c) => c.type === "voltmeter");
    for (const voltmeter of voltmeters) {
      if (voltmeter.originalComponent) {
        // Check if voltmeter is connected to the circuit
        const voltage = isComplete ? this.calculateVoltmeterReading(voltmeter, paths, measurements) : 0;
        voltmeter.originalComponent.voltage = voltage;
        voltmeter.originalComponent.isConnected = voltage > 0;
      }
    }

    console.log(`[Graph] Circuit is ${isComplete ? "COMPLETE" : "OPEN"}`);
    console.log(`[Graph] Components in path: ${Array.from(componentsInPath).join(', ')}`);
    console.log(
      `[Graph] ${bulbs.length} bulb(s), ${bulbs.filter(b => componentsInPath.has(b.id)).length} in path`
    );

    const batteries = this.components.filter((c) => c.type === "battery");
    if (batteries.length === 0) {
      console.log("[Graph] No battery found, circuit is OPEN");
      return { status: -1, paths: [], componentsInPath: componentsInPath };
    }

    if (isComplete) {
      console.log(`[Graph] Circuit is COMPLETE`);
      console.log(`[Graph] Bulbs in path: ${bulbs.filter(b => componentsInPath.has(b.id)).map(b => b.id).join(', ')}`);
      console.log(`[Graph] Measurements: ${measurements.current.toFixed(2)}A, ${measurements.voltage.toFixed(2)}V`);
      return { status: 1, paths: paths, measurements: measurements, componentsInPath: componentsInPath };
    }

    const hasSwitch = this.components.some((c) => c.type === "switch");
    const anySwitchOff = this.components.some(
      (c) => c.type === "switch" && c.is_on === false
    );

    if (hasSwitch && anySwitchOff) {
      console.log("[Graph] Circuit OPEN due to switch being OFF");
      console.log(`[Graph] ${bulbs.length} bulb(s) turned OFF`);
      return { status: -2, paths: [], componentsInPath: componentsInPath };
    }

    console.log("[Graph] Circuit OPEN (no complete path)");
    console.log(`[Graph] ${bulbs.length} bulb(s) turned OFF`);
    return { status: 0, paths: [], componentsInPath: componentsInPath };
  }
}

export { CircuitGraph };
