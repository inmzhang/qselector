let chip;
let scaleFunc;
const couplerColor = 'rgb(0, 0, 0)';
const qubitColor = 'rgb(0, 122, 255)';
const textColor = 'rgb(255, 255, 255)';


function setup() {
    let canvasDiv = document.getElementById('chipCanvas');
    let canvas = createCanvas(canvasDiv.offsetWidth, canvasDiv.offsetHeight);
    canvas.parent('chipCanvas');

    initializeChip();
}

function draw() {
    background(255);
    if (chip) {
        // Draw couplers first to ensure they're under the qubits
        stroke(couplerColor);
        strokeWeight(2);
        chip.couplers.forEach(coupler => {
            coupler.display(scaleFunc);
        });

        // Draw qubits
        strokeWeight(1);
        chip.qubits.forEach(qubit => {
            qubit.display(scaleFunc);
        });
    }
}

function initializeChip() {
    const chipWidth = parseInt(document.getElementById('chipWidth').value);
    const chipHeight = parseInt(document.getElementById('chipHeight').value);
    const useOriginAsQubit = document.getElementById('useOriginAsQubit').checked;
    const qubitNameLength = parseInt(document.getElementById('qubitNameLength').value);

    chip = make_chip(chipWidth, chipHeight, useOriginAsQubit, qubitNameLength);

    const chip_center = chip.center();
    const canvas_center = [width / 2, height / 2];

    let width_ratio = 3 * width / 4 / chipWidth / 2;
    let height_ratio = 3 * height / 4 / chipHeight;
    let ratio = Math.min(width_ratio, height_ratio);


    scaleFunc = (x, y) => {
        let scaled_x = (x - chip_center[0]) * ratio + canvas_center[0];
        let scaled_y = (y - chip_center[1]) * ratio + canvas_center[1];
        return [scaled_x, scaled_y];
    };
}

class Qubit {
    constructor(id, x, y) {
        this.id = id;
        this.x = x;
        this.y = y;
    }

    display(scaleFunc) {
        fill(qubitColor);
        let [x, y] = scaleFunc(this.x, this.y);
        let [x1, y1] = scaleFunc(this.x + 1, this.y + 1);
        let sizeScale = Math.min(x1 - x, y1 - y);
        ellipse(x, y, sizeScale / 2);
        fill(textColor);
        textAlign(CENTER, CENTER);
        textSize(sizeScale / 3.5);
        text(this.id, x, y);
    }

    isSamePos(qubit) {
        return this.x === qubit.x && this.y === qubit.y;
    }
}

class Coupler {
    constructor(id, qubitA, qubitB) {
        this.id = id;
        this.qubitA = qubitA;
        this.qubitB = qubitB;
    }

    display(scaleFunc) {
        let [x1, y1] = scaleFunc(this.qubitA.x, this.qubitA.y);
        let [x2, y2] = scaleFunc(this.qubitB.x, this.qubitB.y);
        line(x1, y1, x2, y2);
    }
}

class Chip {
    constructor(qubits, couplers) {
        this.qubits = qubits;
        this.couplers = couplers;
        this.disabled_qubits = [];
        this.disabled_couplers = [];
    }

    center() {
        const meanX = this.qubits.reduce((acc, qubit) => acc + qubit.x, 0) / this.num_qubits();
        const meanY = this.qubits.reduce((acc, qubit) => acc + qubit.y, 0) / this.num_qubits();
        return [meanX, meanY];
    }

    num_qubits() {
        return this.qubits.length;
    }

    num_functional_qubits() {
        return this.qubits.length - this.disabled_qubits.length;
    }

    disable_qubit(qubit) {
        this.disabled_qubits.push(qubit);
    }

    disable_coupler(coupler) {
        this.disabled_couplers.push(coupler);
    }

    delete_qubit(qubit) {
        this.qubits = this.qubits.filter(q => q !== qubit);
        this.disabled_qubits = this.disabled_qubits.filter(q => q !== qubit);
    }

    delete_coupler(coupler) {
        this.couplers = this.couplers.filter(c => c !== coupler);
        this.disabled_couplers = this.disabled_couplers.filter(c => c !== coupler);
    }
}

function make_chip(chip_width, chip_height, useOriginAsQubit, qubitNameLength = 3) {
    // qubits
    let qid = 0;
    let qubits = [];
    for (let y = 0; y < chip_height; y++) {
        let even_row = y % 2 === 0;
        let rowOffset = even_row == useOriginAsQubit ? 0 : 1;
        for (let x = 0; x < chip_width - (rowOffset ? 1 : 0); x++) {
            let posX = x * 2 + rowOffset;
            let posY = y * 1;
            let qubit = new Qubit(qid, posX, posY);
            qubits.push(qubit);
            qid += 1;
        }
    }
    // couplers
    let couplers = [];
    for (let qubit of qubits) {
        let qubit_ld = new Qubit(qubit.id, qubit.x - 1, qubit.y + 1);
        let qubit_rd = new Qubit(qubit.id, qubit.x + 1, qubit.y + 1);
        for (let qubit_other of [qubit_ld, qubit_rd]) {
            if (qubits.some(q => q.isSamePos(qubit_other))) {
                let coupler_id = getCouplerName(qubit, qubit_other, qubitNameLength);
                let coupler = new Coupler(coupler_id, qubit, qubit_other);
                couplers.push(coupler);
            }
        }
    }

    let chip = new Chip(qubits, couplers);
    return chip;
}

function getQubitName(qid, qubitNameLength) {
    return "Q" + qid.toString().padStart(qubitNameLength, '0');
}

function getCouplerName(qubitA, qubitB, qubitNameLength) {
    let q1 = getQubitName(qubitA.id, qubitNameLength);
    let q2 = getQubitName(qubitB.id, qubitNameLength);
    return q1 > q2 ? 'G' + q1.substring(1) + q2.substring(1) : 'G' + q2.substring(1) + q1.substring(1);
}
