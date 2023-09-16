// DetectionDisplayController.js
// Version: 1.0.0
// Event: On Awake
// Description: edt this script to your liking 
// It's api functions are used by Main Controller to display lines of text 

// @input Component.Text textDisplay
// @input Component.Image boxDisplay
// @input bool applyRotation
// @input bool allowSelect
// @input bool isSelected {"showIf" : "allowSelect"}
//@input vec4 selectedColor {"widget":"color", "showIf" : "allowSelect"}
/** @type {vec4} */
let selectedColor = script.selectedColor;

//@input vec4 normalColor {"widget":"color", "showIf" : "allowSelect"}
/** @type {vec4} */
let normalColor = script.normalColor;

/** @type {ScreenTransform} */
let screenTransform;

/** @type {InteractionComponent} */
let interactionComponent;

/** @type {boolean} */
let isSelected = script.isSelected;

init();

function init() {
    let so = script.getSceneObject();
    screenTransform = so.getComponent("ScreenTransform");
    //allow to select or deselect this detection 
    if (script.allowSelect) {
        interactionComponent = so.getComponent("InteractionComponent");
        interactionComponent.onTap.add(toggleSelected);
        script.textDisplay.textFill.color = isSelected ? selectedColor : normalColor;
    }
}

function show() {
    script.textDisplay.enabled = true;
    script.boxDisplay.enabled = true;
}

function hide() {
    script.textDisplay.enabled = false;
    script.boxDisplay.enabled = false;
}

/**
 * Set anchors and rotation of this screen transform
 * @param {RotatedRect} rotatedRect 
 */
function setRectangle(rotatedRect) {
    screenTransform.anchors.setCenter(rotatedRect.center);
    screenTransform.anchors.setSize(rotatedRect.size);

    if (script.applyRotation) {
        screenTransform.rotation = quat.fromEulerVec(new vec3(0, 0, -rotatedRect.angle / 180 * Math.PI));
    }
}
/**
 * 
 * @param {string} text 
 */
function setText(text) {
    script.textDisplay.text = text;
    if (text.length > 0) {
        script.boxDisplay.enabled = false;
    }
}

function toggleSelected() {
    isSelected = !isSelected;
    // modify visual based on the fact it's selected or not
    script.textDisplay.textFill.color = isSelected ? selectedColor : normalColor;

    //do something else here - for example translate text ot use Text To Speech
}

//this is the api called by Visualization controller, feel free to modify function implementation
script.show = show;
script.hide = hide;
script.setRectangle = setRectangle;
script.setText = setText;

script.getSelected = function() {
    return isSelected;
};