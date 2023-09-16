// MainController.js
// Version: 1.0.0
// Event: OnAwake
// Description: Allows to create an interactive experience based on the OCR controller
// this script is well documented and can be modified to tailor your experience

// @input Component.ScriptComponent ocrController {"label" : "OCR Controller"}
// @ui {"widget":"separator"}

// @ui {"widget":"label", "label":"<b>Detection Display</b>"}
// @input SceneObject displayObject {"hint" : "Object with s Screen Transform on it used to display detection boxes on the screen"}
// @input Component.Text3D textObject
// @input int amount = 10 {"widget":"slider", "min":1, "max":50, "step":1 }
// @ui {"widget":"separator"}
// @input bool editConnections = false
// @ui {"widget":"group_start","label":"Connections", "showIf" : "editConnections"}
// @ui {"widget":"label", "label":"<b>UI Elements</b>"}
// @input SceneObject detectionScreen
// @input SceneObject recognitionScreen
// @input SceneObject editScreen
// @ui {"widget":"label", "label":"<b>Text Output</b>"}
// @input Component.Text outputText
// @ui {"widget":"label", "label":"<b>Input Settings </b>"}
// @input Component.Camera inputCamera {"hint" : "We use this camemera to freeze the camera feed once we run recognition model"}
// @ui {"widget":"group_end"}

/** @type {ScriptComponent[]} */
let displayObjects;

/** @type {RotatedRect[]} */
let boxes;

/** @type {UpdateEvent} */
let updateEvent = script.createEvent("UpdateEvent");

/** @type {DelayedCallbackEvent} */
let freezeTextureEvent;

/** @type {boolean} */
let initialized;

let State = { "None": 0, "Detection": 1, "Recognition": 2, "Edit": 3 };

const fuse = require("Scripts/fuse");
// Import Events module
let eventModule = require("./EventModule");

// Event Wrapper
global.onRecognitionModeEvent = new eventModule.EventWrapper();
global.onDetectionModeEvent = new eventModule.EventWrapper();

if (checkInputs()) {
    initialize();
}

/**
 * 
 */
function initialize() {
    // initialize objects used to visualize detection boxes
    displayObjects = instantiateObjects(script.displayObject, script.amount);

    // create main update loop
    // update display objects based on the detection boxes
    updateEvent.bind(onUpdate);
    // this disables camera 1 frame after 
    // this allows for camra to freeze on a frame that was just processed with ml model
    // to match detections and camera view precisely
    if (script.inputCamera) {
        freezeTextureEvent = script.createEvent("DelayedCallbackEvent");
        freezeTextureEvent.bind(() => {
            script.inputCamera.enabled = false;
            setUIState(State.Hint);
            detect();
        });
    }
}
/**
 * 
 */
function onUpdate() {
    // get detections boxes
    boxes = script.ocrController.getDetectionBoxes();

    updateDetections(boxes);
    if (!initialized && script.ocrController.isInitialized()) {
        initialized = true;
        // if found text - show detection UI
        setUIState(State.Detection);
    }
}

/**
 * instantiates multiple copies of the displayObject
 * @param {SceneObject} origin - scene object to copy 
 * @param {number} count - number of objects 
 * @returns {ScriptComponent[]} - a list of detection display objects
 */
function instantiateObjects(origin, count) {
    let parent = script.displayObject.getParent();

    let arr = [];
    for (let i = 0; i < count; i++) {
        let sceneObject = i == 0 ? origin : parent.copyWholeHierarchy(origin);
        arr.push(sceneObject.getComponent("ScriptComponent"));
    }
    return arr;
}

/**
 * updates visiauls according to text detections
 * @param {RotatedRect[]} data - array of TextDetections
 */

function updateDetections(boxes, lines) {

    let count = Math.min(boxes.length, script.amount);
    for (let i = 0; i < script.amount; i++) {
        if (i < count) {
            displayObjects[i].show();
            if (lines && lines[i]) {
                displayObjects[i].setText(lines[i]);
            } else {
                displayObjects[i].setText("");
            }
            displayObjects[i].setRectangle(boxes[i]);
        } else {
            displayObjects[i].hide();
        }
    }
}

function debugPrint(text) {
    print(text);
}

function recognize() {
    //disable update event
    updateEvent.enabled = false;
    // get detection boxes
    boxes = script.ocrController.getDetectionBoxes();

    // get text from detections
    let lines = script.ocrController.getDetectedText(boxes);
    // set result to the text component, print each detected text from new line
    // script.outputText.text = lines.join("\n");
    // Studio.log("Set text to: " + lines.join(" "));
    // update visuals to display text 
    // updateDetections(boxes, lines);

    // // print results
    // const results = fuzzysort.go('ASU', lines[0])
    // print(results)

    const debris = [
        "Arizona State",
        "University",
        "STUDENT",
        "FACULTY",
        "STAFF"
    ];
    const smallDebris = [
        "ASU",
        "Sun",
        "Card"
    ]
    filtered = [];

    const fs = new fuse(debris, {
        isCaseSensitive: true,
        threshold: 0.3
    });
    const smFs = new fuse(smallDebris, {
        isCaseSensitive: true,
        threshold: 0.5
    });

    for (let i = 0; i < boxes.length; i++) {
        // Studio.log(i + ". Text: \"" + lines[i] + "\"" + ", Detected Rectangle " + boxes[i]);
        if (lines[i].length == 0) continue;

        let result = undefined;
        if (lines[i].length > 4) {
            Studio.log("Using large...");
            result = fs.search(lines[i]);
        } else {
            Studio.log("Using small...");
            result = smFs.search(lines[i]);
        }

        if (result.length == 0) {
            filtered.push(lines[i]);
        } else if (result.length > 0) {
            Studio.log("Filtered: " + lines[i] + " because matched: " + result[0]["item"])
        }
    }

    Studio.log(filtered.toString())

    const numRegex = new RegExp("\d+"); 
    let contentText = "";
    let lastBreak = 0;
    for (let i = 0; i < filtered.length; i++) {
        if ((contentText.length+filtered[i].length - lastBreak) > 12
        || numRegex.test(filtered[i])) {
            lastBreak = contentText.length;
            contentText += "\n" + filtered[i];
        } else {
            contentText += " " + filtered[i];
        }
    }

    script.textObject.text = contentText;


    global.onRecognitionModeEvent.trigger();

    freezeTextureEvent.reset(0);
}

/**
 * reset state to just detecting and displaying 
 */

function detect() {
    if (script.inputCamera) {
        // resume camera feed
        script.inputCamera.enabled = true;
    }
    global.onDetectionModeEvent.trigger(boxes);
    // resume updating bounding boxes
    updateEvent.enabled = true;
}


/**
 * checks if all inputs are set
 * @returns {boolean}
 */
function checkInputs() {
    if (!script.displayObject) {
        debugPrint("Error, Please set the object you would like to place on the detected object");
        return false;
    }
    if (script.displayObject.getComponent("Component.ScreenTransform") == null) {
        debugPrint("Error, Object To Copy has to have a ScreenTansform component in order to be positioned correcty");
        return false;
    }
    if (script.displayObject.getParent() == null || script.displayObject.getParent().getComponent("Component.ScreenTransform") == null) {
        debugPrint("Error, Object To Copy has to have a parent with ScreenTransform component");
        return false;
    }
    if (!script.displayObject.getComponent("Component.ScreenTransform").isInScreenHierarchy()) {
        debugPrint("Error, Object To Copy should be a child of an Orthographic camera");
        return false;
    }
    if (!script.inputCamera) {
        debugPrint("Warning, Input Camera is not set. It is needed to freeze the camera feed.");
    }
    return true;
}

function setUIState(state) {
    // script.detectionScreen.enabled = state == State.Detection;
    // script.recognitionScreen.enabled = state == State.Recognition;
    // script.editScreen.enabled = state == State.Edit;
    script.detectionScreen.enabled = true;
    script.recognitionScreen.enabled = false;
    script.editScreen.enabled = state == false;
}

script.showDetectionUI = () => setUIState(State.Detection);
script.showRecognitionUI = () => setUIState(State.Recognition);
script.showEditUI = () => setUIState(State.Edit);

script.detect = detect;
script.recognize = recognize;