// Image Picker Button Helper.js
// Version: 1.0.0
// Event: On Awake
// Description: allows to switch Image Picker button visual depending on the state
// @input Component.ScriptComponent ocrController {"label" : "OCR Controller"}
// @input Component.Image inputTextureImage 
// @ui {"widget":"label", "label":"Image Picker Mode"}
// @input SceneObject pickerButton
// @input Asset.Texture imagePickerTexture  {"label" : "Media Picker"}
// @ui {"widget":"label", "label":"Camera Feed Mode"}
// @input SceneObject cameraButton  
// @input Asset.Texture deviceTexture   {"label" : "Device Texture"}

// Import Events module
let eventModule = require("./EventModule");

// Event Wrapper
global.showImagePickerEvent = new eventModule.EventWrapper();
global.hideImagePickerEvent = new eventModule.EventWrapper();

let pickerEnabled = false;

checkInputs();

function showMediaPicker() {
    script.cameraButton.enabled = true;
    script.pickerButton.enabled = false;

    script.imagePickerTexture.control.showMediaPicker();
    global.showImagePickerEvent.trigger();
}

function hideMediaPicker() {


    script.imagePickerTexture.control.hideMediaPicker();
    global.hideImagePickerEvent.trigger();
}

function setImagePickerInput() {
    pickerEnabled = true;

    script.imagePickerTexture.control.setFilePickedCallback(function() {
        //set input texture to process
        script.ocrController.setInputTexture(script.imagePickerTexture);
        script.inputTextureImage.mainMaterial.mainPass.baseTex = script.imagePickerTexture;
    });

    showMediaPicker();
}

function setDeviceTextureInput() {
    pickerEnabled = false;

    script.ocrController.setInputTexture(script.deviceTexture);
    script.inputTextureImage.mainMaterial.mainPass.baseTex = script.deviceTexture;

    script.cameraButton.enabled = false;
    script.pickerButton.enabled = true;

    hideMediaPicker();
}

function checkInputs() {
    if (!script.inputTextureImage) {
        debugPrint("Warning, Input texture Image is not set. It is needed to display correct input texture as a background. Required for when you use image picker option");
    }
}

script.setDeviceTextureInput = setDeviceTextureInput;
script.setImagePickerInput = setImagePickerInput;

script.createEvent("OnStartEvent").bind(function() {
    if (global.onRecognitionModeEvent) {
        global.onRecognitionModeEvent.add(function() {
            if (pickerEnabled) {
                hideMediaPicker();
            }
        });

        global.onDetectionModeEvent.add(function() {
            //enable picker if it was left open
            if (pickerEnabled) {
                showMediaPicker();
            }
        });
    }
    hideMediaPicker();
});