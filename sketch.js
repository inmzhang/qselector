const Mode = {
    TOPOLOGY: "Topology",
    QUBIT: "Qubit",
    COUPLER: "Coupler",
    QATTR: "QubitAttr",
    CATTR: "CouplerAttr",
};
const Colors = {
    WORK_QUBIT: "rgb(0, 122, 255)",
    DISABLED: "rgb(237, 231, 216)",
    SELECTION: [
        "rgb(234, 67, 53)",
        "rgb(251, 188, 5)",
        "rgb(52, 168, 83)",
        "rgb(170, 45, 237)",
    ],
    WORK_COUPLER: "rgb(0, 0, 0)",
    TEXT: "rgb(255, 255, 255)"
};
const diameterScale = 2 / 3;
const dutyRatio = 4 / 5;

let storage;
let scaleFunc, sizeScale;
let dragStartX, dragStartY;
let dragging = false;
let showStats = false;
let selectionBox = { x: 0, y: 0, width: 0, height: 0 };


function setup() {
    storage = new Storage();
    initializeCanvas();
    setupListeners();
    initializeStorage();
}

function draw() {
    background(255);
    setupScaling();
    storage.chip?.draw();
    draggingBox();
    mouseHover();
}

// Initialize the canvas and buttons
function initializeCanvas() {
    const canvasDiv = document.getElementById("chipCanvas");
    const canvas = createCanvas(canvasDiv.offsetWidth, canvasDiv.offsetHeight);
    canvas.parent("chipCanvas");
    createControlButtons(canvasDiv);
    // Set up mouse listeners
    canvas.mousePressed(mousePressedImpl);
    canvas.mouseClicked(mouseClickedImpl);
    canvas.doubleClicked(doubleClickedImpl);
}

function initializeStorage(skipCache = false) {
    // Load from local storage if available
    let loaded = storage.loadFromLocalStorage();
    if (!loaded || skipCache) {
        storage.initializeFromDom();
        storage.saveToLocalStorage();
        return;
    }
    storage.writeToDoM();
}

class Storage {
    constructor() {
        this.chip = undefined;
        this.mode = undefined;
        this.preset = undefined;
    }

    setMode(mode) {
        this.mode = mode;
        storage.saveToLocalStorage();
    }

    loadFromLocalStorage() {
        let local = JSON.parse(localStorage.getItem("qselector"));
        if (local !== null) {
            this.chip = new Chip();
            this.chip.fromJSON(local["chip"]);
            this.mode = local["mode"];
            this.preset = local["preset"];
            return true;
        }
        return false;
    }

    saveToLocalStorage() {
        localStorage.setItem("qselector", JSON.stringify({
            chip: this.chip.toJSON(),
            mode: this.mode,
            preset: this.preset
        }));
    }

    initializeFromDom() {
        let w = parseInt(document.getElementById("chipWidth").value);
        let h = parseInt(document.getElementById("chipHeight").value);
        let qubitStartIdx = parseInt(document.getElementById("qubitStartIndex").value);
        let qubitNameLength = parseInt(document.getElementById("qubitNameLength").value);
        let useOriginAsQubit = document.getElementById("useOriginAsQubit").checked;
        let presetTopology = document.getElementById("loadPreset").value;
        let selectMode = document.querySelector('input[name="mode"]:checked').value;
        if (presetTopology !== "NULL") {
            loadPresetTopology(presetTopology);
        } else {
            this.chip = new Chip(w, h, useOriginAsQubit, qubitStartIdx, qubitNameLength);
        }
        this.mode = selectMode;
        this.preset = presetTopology;
    }

    writeToDoM() {
        document.getElementById("chipWidth").value = this.chip.width;
        document.getElementById("chipHeight").value = this.chip.height;
        document.getElementById("qubitStartIndex").value = this.chip.qubitStartIdx;
        document.getElementById("qubitNameLength").value = this.chip.qubitNameLength;
        document.getElementById("useOriginAsQubit").checked = this.chip.useOriginAsQubit;
        document.getElementById("loadPreset").value = this.preset;
        document.getElementById("modeSelect" + this.mode).checked = true;
        setSelectGroupVisibility(this.mode);
    }
}

class Qubit {
    constructor(id, x, y) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.disabled = false;
        this.selectGroup = null;
        this.attribute = undefined;
    }

    handleSelect(doNotReset = false) {
        if (this.disabled) return;
        if (!doNotReset && this.selected()) {
            this.selectGroup = null;
        } else {
            const selectGroup = document.getElementById("qubitGroupSelect").value;
            this.selectGroup = parseInt(selectGroup);
        }
    }

    selected() {
        return this.selectGroup !== null;
    }

    draw() {
        stroke(0);
        strokeWeight(2.5);
        fill(this.disabled ? Colors.DISABLED : this.selected() ? Colors.SELECTION[this.selectGroup] : Colors.WORK_QUBIT);
        let [scaledX, scaledY] = scaleFunc(this.x, this.y);
        ellipse(scaledX, scaledY, sizeScale * diameterScale);
        fill(Colors.TEXT);
        textAlign(CENTER, CENTER);
        textSize(sizeScale / 3);
        text(this.id, scaledX, scaledY);
    }

    isHovered(x, y) {
        return dist(x, y, scaleFunc(this.x, this.y)[0], scaleFunc(this.x, this.y)[1]) < sizeScale * diameterScale / 2;
    }

    isSelected(minX, minY, maxX, maxY) {
        let [x, y] = scaleFunc(this.x, this.y);
        return x >= minX && x <= maxX && y >= minY && y <= maxY;
    }

    getName(qubitNameLength) {
        return "Q" + this.id.toString().padStart(qubitNameLength, "0");
    }

    reset() {
        this.selectGroup = null;
        this.attribute = undefined;
    }

    toJSON() {
        return {
            id: this.id,
            x: this.x,
            y: this.y,
            disabled: this.disabled,
            select_group: this.selectGroup,
            attribute: this.attribute
        };
    }

    fromJSON(json) {
        this.id = json.id;
        this.x = json.x;
        this.y = json.y;
        this.disabled = json.disabled;
        this.selectGroup = json.select_group;
        this.attribute = json.attribute;
    }
}

class Coupler {
    constructor(qubitA, qubitB) {
        this.qubitA = qubitA;
        this.qubitB = qubitB;
        this.disabled = false;
        this.selectGroup = null;
        this.attribute = undefined;
    }

    selected() {
        return this.selectGroup !== null;
    }

    draw() {
        strokeWeight(5);
        stroke(this.disabled ? Colors.DISABLED : this.selected() ? Colors.SELECTION[this.selectGroup] : Colors.WORK_COUPLER);
        let [x1, y1] = scaleFunc(this.qubitA.x, this.qubitA.y);
        let [x2, y2] = scaleFunc(this.qubitB.x, this.qubitB.y);
        line(x1, y1, x2, y2);
    }

    isHovered(x, y) {
        let [x1, y1] = scaleFunc(this.qubitA.x, this.qubitA.y);
        let [x2, y2] = scaleFunc(this.qubitB.x, this.qubitB.y);
        return distToSegment(x, y, x1, y1, x2, y2) < 5;
    }

    handleSelect(doNotReset = false) {
        if (this.disabled) return;
        if (!doNotReset && this.selected()) {
            this.selectGroup = null;
        } else {
            const selectGroup = document.getElementById("couplerGroupSelect").value;
            this.selectGroup = parseInt(selectGroup);
        }
    }

    isSelected(minX, minY, maxX, maxY) {
        let [x1, y1] = scaleFunc(this.qubitA.x, this.qubitA.y);
        let [x2, y2] = scaleFunc(this.qubitB.x, this.qubitB.y);
        return (
            (x1 >= minX && x1 <= maxX && y1 >= minY && y1 <= maxY) ||
            (x2 >= minX && x2 <= maxX && y2 >= minY && y2 <= maxY)
        );
    }

    getName(qubitNameLength) {
        let q1 = this.qubitA.getName(qubitNameLength);
        let q2 = this.qubitB.getName(qubitNameLength);
        return q1 > q2
            ? "G" + q1.substring(1) + q2.substring(1)
            : "G" + q2.substring(1) + q1.substring(1);
    }

    reset() {
        this.selectGroup = null;
        this.attribute = undefined;
    }

    toJSON() {
        return {
            qubitA: this.qubitA.id,
            qubitB: this.qubitB.id,
            disabled: this.disabled,
            select_group: this.selectGroup,
            attribute: this.attribute
        };
    }

    fromJSON(json, qubits) {
        this.qubitA = qubits.find(q => q.id === json.qubitA);
        this.qubitB = qubits.find(q => q.id === json.qubitB);
        this.disabled = json.disabled;
        this.selectGroup = json.select_group;
        this.attribute = json.attribute;
    }
}

class Chip {
    constructor(width, height, useOriginAsQubit, qubitStartIdx, qubitNameLength) {
        this.width = width;
        this.height = height;
        this.qubitStartIdx = qubitStartIdx;
        this.qubitNameLength = qubitNameLength;
        this.useOriginAsQubit = useOriginAsQubit;
        [this.qubits, this.couplers] = this.initialize(useOriginAsQubit, qubitStartIdx);
    }

    center() {
        let sumX = this.qubits.reduce((acc, qubit) => acc + qubit.x, 0);
        let sumY = this.qubits.reduce((acc, qubit) => acc + qubit.y, 0);
        return [sumX / this.numQubits(), sumY / this.numQubits()];
    }

    numQubits() {
        return this.qubits.length;
    }

    numCouplers() {
        return this.couplers.length;
    }

    numActiveQubits() {
        return this.qubits.filter((q) => !q.disabled).length;
    }

    numActiveCouplers() {
        return this.couplers.filter((c) => !c.disabled).length;
    }

    numSelectedQubits() {
        return this.qubits.filter((q) => q.selected()).length;
    }

    numSelectedCouplers() {
        return this.couplers.filter((c) => c.selected()).length;
    }

    deleteQubit(qid) {
        this.qubits = this.qubits
            .filter((q) => q.id !== qid);
        this.couplers = this.couplers.filter(
            (c) => c.qubitA.id !== qid && c.qubitB.id !== qid
        );
        this.qubits.forEach((q) => {
            if (q.id > qid) {
                q.id -= 1;
            }
        });
        storage.saveToLocalStorage();
    }

    deleteQubits(qids) {
        this.qubits = this.qubits.filter((q) => !qids.includes(q.id));
        this.couplers = this.couplers.filter(
            (c) => !qids.includes(c.qubitA.id) && !qids.includes(c.qubitB.id)
        );

        this.qubits.forEach((q) => {
            q.id -= qids.filter((id) => id < q.id).length;
        });
        storage.saveToLocalStorage();
    }

    reset() {
        this.qubits.forEach(q => q.reset());
        this.couplers.forEach(c => c.reset());
    }

    getSelectedQubitsPythonObject() {
        let selectedQubits = this.qubits.filter((q) => q.selected());
        if (isListMode(storage.mode)) {
            let selectedGroups = [[], [], [], []];

            this.qubits.forEach(qubit => {
                if (qubit.selected()) {
                    selectedGroups[qubit.selectGroup].push(qubit.getName(this.qubitNameLength));
                }
            });
            // If there is no selected qubits, return empty list
            if (selectedGroups.every(group => group.length === 0)) {
                return '[]';
            }
            // If there is only one group, return the list of qubits
            if (selectedGroups.filter(group => group.length > 0).length === 1) {
                return `[${selectedGroups.flat().map(q => `"${q}"`).join(', ')}]`;
            }
            const selectedQubitsLists = selectedGroups.map(qubits => `[${qubits.map(q => `"${q}"`).join(', ')}]`);
            return `[${selectedQubitsLists.join(', ')}]`;
        } else if (isAttrMode(storage.mode)) {
            return '{' + selectedQubits
                .map(q => `"${q.getName(this.qubitNameLength)}": ${q.attribute}`)
                .join(', ') + '}';
        }
    }

    getSelectedCouplersPythonObject() {
        let selectedCouplers = this.couplers.filter((c) => c.selected());
        if (isListMode(storage.mode)) {
            let selectedGroups = [[], [], [], []];
            this.couplers.forEach(coupler => {
                if (coupler.selected()) {
                    selectedGroups[coupler.selectGroup].push(coupler.getName(this.qubitNameLength));
                }
            });
            if (selectedGroups.every(group => group.length === 0)) {
                return '[]';
            }
            if (selectedGroups.filter(group => group.length > 0).length === 1) {
                return `[${selectedGroups.flat().map(c => `"${c}"`).join(', ')}]`;
            }
            const selectedCouplersLists = selectedGroups.map(couplers => `[${couplers.map(c => `"${c}"`).join(', ')}]`);
            return `[${selectedCouplersLists.join(', ')}]`;
        } else if (isAttrMode(storage.mode)) {
            return '{' + selectedCouplers
                .map(c => `"${c.getName(this.qubitNameLength)}": ${c.attribute}`)
                .join(', ') + '}';
        }
    }

    draw() {
        this.couplers.forEach(coupler => coupler.draw());
        this.qubits.forEach(qubit => qubit.draw());
        if (showStats) this.displayStats();
    }

    handleClick(x, y) {
        let mode = storage.mode;
        if (mode === Mode.TOPOLOGY || mode === Mode.QUBIT || mode === Mode.QATTR) {
            for (let qubit of this.qubits) {
                if (qubit.isHovered(x, y)) {
                    if (mode === Mode.TOPOLOGY) qubit.disabled = !qubit.disabled;
                    else if (mode === Mode.QUBIT) {
                        qubit.handleSelect()
                    } else if (mode === Mode.QATTR) {
                        let attribute = prompt("Enter attribute for the qubit:", qubit.attribute);
                        // If the user prompt with empty, attribute will be null
                        // and the selected state will be false
                        if (attribute === "") {
                            qubit.selectGroup = null;
                            qubit.attribute = undefined;
                        }
                        // If the user cancels the prompt, the state should be unchanged
                        else if (attribute === null) {
                            return;
                        } else {
                            qubit.selectGroup = 0;
                            qubit.attribute = attribute;
                        }
                    }
                    storage.saveToLocalStorage();
                    return;
                }
            }
        }
        if (mode === Mode.TOPOLOGY || mode === Mode.COUPLER || mode === Mode.CATTR) {
            for (let coupler of this.couplers) {
                if (coupler.isHovered(x, y)) {
                    if (mode === Mode.TOPOLOGY) coupler.disabled = !coupler.disabled;
                    else if (mode === Mode.COUPLER) {
                        coupler.handleSelect();
                    } else if (mode === Mode.CATTR) {
                        let attribute = prompt("Enter attribute for the coupler:", coupler.attribute);
                        if (attribute === "") {
                            coupler.selectGroup = null;
                            coupler.attribute = undefined;
                        } else if (attribute === null) {
                            return;
                        } else {
                            coupler.selectGroup = 0;
                            coupler.attribute = attribute;
                        }
                    }
                    storage.saveToLocalStorage();
                    return;
                }
            }
        }
    }

    handleDoubleClick(x, y) {
        if (storage.mode === Mode.TOPOLOGY) {
            for (let qubit of this.qubits) {
                if (qubit.isHovered(x, y)) {
                    this.deleteQubit(qubit.id);
                    return;
                }
            }
        }
    }

    handleDrag(minX, minY, maxX, maxY) {
        if (storage.mode === Mode.QUBIT) {
            for (let qubit of this.qubits) {
                if (qubit.isSelected(minX, minY, maxX, maxY)) {
                    qubit.handleSelect(true);
                }
            }
        } else {
            for (let coupler of this.couplers) {
                if (coupler.isSelected(minX, minY, maxX, maxY)) {
                    coupler.handleSelect(true);
                }
            }
        }
        storage.saveToLocalStorage();
    }

    initialize(useOriginAsQubit, qubitStartIdx) {
        let qubits = [];
        let qubitDict = {};
        let qid = qubitStartIdx;

        for (let y = 0; y < this.height; y++) {
            let even_row = y % 2 === 0;
            let rowOffset = even_row == useOriginAsQubit ? 0 : 1;
            for (let x = 0; x < this.width - (rowOffset ? 1 : 0); x++) {
                let posX = x * 2 + rowOffset;
                let posY = y * 1;
                let qubit = new Qubit(qid, posX, posY);
                qubits.push(qubit);
                qubitDict[[posX, posY]] = qubit;
                qid += 1;
            }
        }

        // couplers
        let couplers = [];
        for (let qubit of qubits) {
            for (let otherCoords of [
                [qubit.x - 1, qubit.y + 1],
                [qubit.x + 1, qubit.y + 1],
            ]) {
                if (otherCoords in qubitDict) {
                    let otherQubit = qubitDict[otherCoords];
                    let coupler = new Coupler(qubit, otherQubit);
                    couplers.push(coupler);
                }
            }
        }
        return [qubits, couplers];
    }

    displayStats() {
        const margin = 10;
        const statsTextSize = 14;

        // Display the number of work qubits and work couplers
        fill(Colors.TEXT);
        fill(0);
        textSize(statsTextSize);
        strokeWeight(1);
        textAlign(LEFT, TOP);

        const messages = [
            ["Active Qubits: " + this.numActiveQubits()],
            ["Active Couplers: " + this.numActiveCouplers()],
            ["Disabled Qubits: " + (this.numQubits() - this.numActiveQubits())],
            ["Disabled Couplers: " + (this.numCouplers() - this.numActiveCouplers())],
            ["Selected Qubits: " + this.numSelectedQubits()],
            ["Selected Couplers: " + this.numSelectedCouplers()],
        ];
        for (const [i, message] of messages.entries()) {
            text(
                message,
                2 * margin,
                margin * (i + 2) + statsTextSize * (i + 1)
            );
        }
    }

    toJSON() {
        return {
            width: this.width,
            height: this.height,
            qubitStartIdx: this.qubitStartIdx,
            qubitNameLength: this.qubitNameLength,
            useOriginAsQubit: this.useOriginAsQubit,
            qubits: this.qubits.map(q => q.toJSON()),
            couplers: this.couplers.map(c => c.toJSON())
        };
    }

    fromJSON(json) {
        this.width = json.width;
        this.height = json.height;
        this.qubitStartIdx = json.qubitStartIdx;
        this.qubitNameLength = json.qubitNameLength;
        this.useOriginAsQubit = json.useOriginAsQubit;
        this.qubits = json.qubits.map(q => {
            let qubit = new Qubit();
            qubit.fromJSON(q);
            return qubit;
        });
        this.couplers = json.couplers.map(c => {
            let coupler = new Coupler();
            coupler.fromJSON(c, this.qubits);
            return coupler;
        });
    }
}

// Setup scaling function based on chip and canvas size
function setupScaling() {
    const chipCenter = storage.chip.center();
    const canvasCenter = [width / 2, height / 2];
    const widthRatio = dutyRatio * width / storage.chip.width / 2;
    const heightRatio = dutyRatio * height / storage.chip.height;
    const ratio = Math.min(widthRatio, heightRatio);

    scaleFunc = (x, y) => {
        return [
            (x - chipCenter[0]) * ratio + canvasCenter[0],
            (y - chipCenter[1]) * ratio + canvasCenter[1]
        ];
    };

    const spacing = [
        scaleFunc(1, 1)[0] - scaleFunc(0, 0)[0],
        scaleFunc(1, 1)[1] - scaleFunc(0, 0)[1]
    ];
    sizeScale = Math.min(spacing[0], spacing[1]);
}

// Create control buttons and position them
function createControlButtons(canvasDiv) {
    const canvasPosition = canvasDiv.getBoundingClientRect();
    const buttons = [
        ["Copy Qubits", copySelectedQubits],
        ["Copy Couplers", copySelectedCouplers],
        ["Toggle Statistics", () => showStats = !showStats],
        ["Import selections", importSelections],
        ["Copy Canvas PNG", downloadPNG],
    ];
    const maxWidth = buttons.map(b => textWidth(b[0])).reduce((a, b) => Math.max(a, b));
    const startWidth = canvasPosition.left + canvasDiv.offsetWidth - maxWidth - 20;
    const startHeight = canvasPosition.top + 10;
    for (const [idx, button] of buttons.entries()) {
        createButtonAt(button[0], startWidth, startHeight + 30 * idx, button[1]);
    }
}

function createButtonAt(label, x, y, callback) {
    const button = createButton(label);
    button.position(x, y);
    button.mousePressed(callback);
}

function copySelectedQubits() {
    navigator.clipboard.writeText(
        storage.chip.getSelectedQubitsPythonObject()
    )
        .then(() => console.log("Python list copied to clipboard"))
        .catch(err => console.error("Unable to copy to clipboard:", err));
}

function copySelectedCouplers() {
    navigator.clipboard.writeText(
        storage.chip.getSelectedCouplersPythonObject()
    )
        .then(() => console.log("Selected couplers copied to clipboard"))
        .catch(err => console.error("Failed to copy selected couplers to clipboard:", err));
}

function importSelections(input = null) {
    if (input === null) {
        input = prompt("Enter Python list/dict for qubit/coupler selection:");
    }
    if (input !== null) {
        const processedInput = input.replace(/'/g, '"');
        try {
            let parsedInput = JSON.parse(processedInput);
            if (Array.isArray(parsedInput)) {
                // Detected as list mode
                checkNamesAllInChip(parsedInput.flat());
                let qubitUpdated = false;
                if (parsedInput.length === 0) {
                    return;
                }
                if (!Array.isArray(parsedInput[0])) {
                    parsedInput = [parsedInput];
                }
                for (const [group, elements] of parsedInput.entries()) {
                    storage.chip.qubits.forEach(qubit => {
                        if (elements.includes(qubit.getName(storage.chip.qubitNameLength))) {
                            qubit.selectGroup = group;
                            qubitUpdated = true;
                        }
                    });
                    storage.chip.couplers.forEach(coupler => {
                        if (elements.includes(coupler.getName(storage.chip.qubitNameLength))) {
                            coupler.selectGroup = group;
                        }
                    });
                }
                if (qubitUpdated) {
                    storage.setMode(Mode.QUBIT);
                } else {
                    storage.setMode(Mode.COUPLER);
                }
            } else if (typeof parsedInput === 'object') {
                // Detected as attribute mode
                let names = Object.keys(parsedInput);
                checkNamesAllInChip(names);
                let qubitUpdated = false;
                for (let qubit of storage.chip.qubits) {
                    if (names.includes(qubit.getName(storage.chip.qubitNameLength))) {
                        qubit.selected = true;
                        qubit.attribute = parsedInput[qubit.getName(storage.chip.qubitNameLength)];
                        qubitUpdated = true;
                    }
                }
                for (let coupler of storage.chip.couplers) {
                    if (names.includes(coupler.getName(storage.chip.qubitNameLength))) {
                        coupler.selected = true;
                        coupler.attribute = parsedInput[coupler.getName(storage.chip.qubitNameLength)];
                    }
                }
                if (qubitUpdated) {
                    storage.setMode(Mode.QATTR);
                } else {
                    storage.setMode(Mode.CATTR);
                }
            } else {
                console.error("Invalid input format.");
                return;
            }
            initializeStorage();
        } catch (error) {
            console.error("Error parsing input:", error);
        }

    }
    return;
}

function downloadPNG() {
    canvas.toBlob(blob => navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]))
}

// Listeners
function setupListeners() {
    setupModeListener("modeSelectTopology", Mode.TOPOLOGY);
    setupModeListener("modeSelectQubit", Mode.QUBIT);
    setupModeListener("modeSelectCoupler", Mode.COUPLER);
    setupModeListener("modeSelectQubitAttr", Mode.QATTR);
    setupModeListener("modeSelectCouplerAttr", Mode.CATTR);
    setupPresetTopologyListener();
}

// Create a mode selector radio button listener
function setupModeListener(elementId, modeValue) {
    const radioButton = document.getElementById(elementId);
    radioButton.addEventListener("change", () => {
        if (radioButton.checked) {
            let prevMode = storage.mode;
            storage.setMode(modeValue);
            if ((prevMode == Mode.TOPOLOGY) ||
                (isAttrMode(prevMode) && !isAttrMode(modeValue)) ||
                (!isAttrMode(prevMode) && isAttrMode(modeValue))) {
                storage.chip.reset();
            }
            setSelectGroupVisibility(modeValue);
            storage.saveToLocalStorage();
        }
    });
}

function setupPresetTopologyListener() {
    const presetTopologySelect = document.getElementById("loadPreset");
    presetTopologySelect.addEventListener("change", () => {
        const selectedTopology = presetTopologySelect.value;
        storage.preset = selectedTopology;
        loadPresetTopology(selectedTopology);
        storage.saveToLocalStorage();
        initializeStorage();
    });
}

function loadPresetTopology(selectedTopology) {
    if (selectedTopology === "NULL") {
        return;
    } else if (selectedTopology === "ZCZ3") {
        storage.chip = new Chip(8, 15, true, 1, 3);
        storage.chip.deleteQubits([1, 31, 61, 91, 23, 53, 83, 113]);
    } else if (selectedTopology == "ZCZ2") {
        storage.chip = new Chip(7, 11, false, 0, 2);
        storage.chip.deleteQubits([12, 25, 38, 51, 64]);
    } else if (selectedTopology == "Sycamore") {
        storage.chip = new Chip(7, 9, true, 1, 2);
        storage.chip.deleteQubits([7, 20, 33, 46, 59]);
    }
}

// Mouse interaction functions
function mouseClickedImpl() { storage.chip.handleClick(mouseX, mouseY); }

function doubleClickedImpl() { storage.chip.handleDoubleClick(mouseX, mouseY); }

function mousePressedImpl() {
    if (storage.mode === Mode.QUBIT || storage.mode === Mode.COUPLER) {
        dragStartX = mouseX;
        dragStartY = mouseY;
        dragging = true;
    }
}

function mouseDragged() {
    if ((storage.mode === Mode.QUBIT || storage.mode === Mode.COUPLER) && dragging) {
        let minX = min(dragStartX, mouseX);
        let minY = min(dragStartY, mouseY);
        let maxX = max(dragStartX, mouseX);
        let maxY = max(dragStartY, mouseY);

        // Update selection box dimensions
        selectionBox.x = minX;
        selectionBox.y = minY;
        selectionBox.width = maxX - minX;
        selectionBox.height = maxY - minY;

        storage.chip.handleDrag(minX, minY, maxX, maxY);
    }
}

function mouseReleased() {
    dragging = false;
}

function draggingBox() {
    let mode = storage.mode;
    // Draw selection box
    if (dragging && (mode === Mode.QUBIT || mode === Mode.COUPLER)) {
        noFill();
        stroke(0);
        strokeWeight(1);
        rect(selectionBox.x, selectionBox.y, selectionBox.width, selectionBox.height);
    }

    selectionBox = { x: 0, y: 0, width: 0, height: 0 };
}

function mouseHover() {
    let mode = storage.mode;
    let hoverTarget = null;

    if (mode === Mode.TOPOLOGY || mode === Mode.QUBIT || mode === Mode.QATTR) {
        for (let qubit of storage.chip.qubits) {
            if (qubit.isHovered(mouseX, mouseY)) {
                hoverTarget = qubit;
                break;
            }
        }
    }

    if (!hoverTarget && (mode === Mode.TOPOLOGY || mode === Mode.COUPLER || mode === Mode.CATTR)) {
        for (let coupler of storage.chip.couplers) {
            if (coupler.isHovered(mouseX, mouseY)) {
                hoverTarget = coupler;
                break;
            }
        }
    }

    // Display attribute or change stroke weight based on hover target and mode
    if (hoverTarget && hoverTarget.selected()) {
        if (mode === Mode.QATTR || mode === Mode.CATTR) {
            // Display attribute
            displayAttribute(hoverTarget.getName(storage.chip.qubitNameLength), hoverTarget.attribute);
        }
    }
}


// Define a function to display attribute text
function displayAttribute(name, attribute) {
    const padding = 5;
    const ts = 14;

    let [x, y] = [mouseX + 10, mouseY - 30];

    fill(Colors.SELECTION[0])
    stroke(Colors.TEXT);
    strokeWeight(2);
    textSize(ts);
    textAlign(LEFT, TOP);
    text(name + ": " + attribute, x + padding, y + padding);
}

// Keyboard interaction
function keyPressed() {
    let mode = storage.mode;
    // avoid keyboard interaction when inputting attribute
    if (document.activeElement.tagName === "INPUT") {
        return;
    }

    // Select next/prev mode
    const modeKeys = ["modeSelectTopology", "modeSelectQubit", "modeSelectCoupler", "modeSelectQubitAttr", "modeSelectCouplerAttr"];
    if (keyCode === 69) {
        let nextMode = modeKeys[(modeKeys.indexOf("modeSelect" + mode) + 1) % modeKeys.length];
        document.getElementById(nextMode).click();
        return;
    }
    if (keyCode === 81) {
        let prevMode = modeKeys[(modeKeys.indexOf("modeSelect" + mode) + modeKeys.length - 1) % modeKeys.length];
        document.getElementById(prevMode).click();
        return;
    }

    // Copy selected qubits/couplers
    if (keyCode === 67 && keyIsDown(CONTROL)) {
        if (mode === Mode.QUBIT || mode === Mode.QATTR) {
            copySelectedQubits();
        } else if (mode === Mode.COUPLER || mode === Mode.CATTR) {
            copySelectedCouplers();
        }
        return;
    }

    // Import selections from clipboard
    if (keyCode === 86 && keyIsDown(CONTROL)) {
        navigator.clipboard.readText().then(text => importSelections(text));
    }

    // Reset selections
    if (keyCode === 32) {
        resetSelections();
        return;
    }

    // Select groups
    if (isListMode(mode)) {
        const groupKeyCode = [49, 50, 51, 52];
        const group = mode === Mode.QUBIT ? "qubitGroupSelect" : "couplerGroupSelect";
        const selectedGroup = document.getElementById(group);
        for (const [index, code] of groupKeyCode.entries()) {
            if (keyCode === code) {
                selectedGroup.value = index;
                break;
            }
        }
    }
    storage.saveToLocalStorage();
}

// Utility functions
function distToSegment(px, py, x1, y1, x2, y2) {
    let dx = x2 - x1;
    let dy = y2 - y1;
    let len_sq = dx * dx + dy * dy;

    let t = ((px - x1) * dx + (py - y1) * dy) / len_sq;
    t = Math.max(0, Math.min(1, t)); // Clamp t to ensure it's within the line segment

    let nearestX = x1 + t * dx;
    let nearestY = y1 + t * dy;

    let distSq =
        (px - nearestX) * (px - nearestX) + (py - nearestY) * (py - nearestY);
    return Math.sqrt(distSq);
}

function isListMode(mode) {
    return mode === Mode.QUBIT || mode === Mode.COUPLER;
}

function isAttrMode(mode) {
    return mode === Mode.QATTR || mode === Mode.CATTR;
}

function checkNamesAllInChip(names) {
    for (let name of names) {
        if (storage.chip.qubits.some(q => q.getName(storage.chip.qubitNameLength) === name) ||
            storage.chip.couplers.some(c => c.getName(storage.chip.qubitNameLength) === name)) {
            continue;
        } else {
            alert("Include invalid qubit/coupler names in the input.");
        }
    }
}

function resetSelections() {
    storage.chip.reset();
    storage.saveToLocalStorage();
}

function setSelectGroupVisibility(mode) {
    const qubitGroupSelect = document.getElementById("qubitGroupSelect");
    const couplerGroupSelect = document.getElementById("couplerGroupSelect");
    qubitGroupSelect.style.display = mode === Mode.QUBIT ? "block" : "none";
    couplerGroupSelect.style.display = mode === Mode.COUPLER ? "block" : "none";
}