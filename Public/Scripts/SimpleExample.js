// Simple Example.js
// Version: 1.0.0
// Event: On Awake
// Description: Simplest example of the OCR controller api usage

// @input Component.ScriptComponent ocrController {"label" : "OCR Controller"}
// @ui {"widget":"separator"}
//@input Asset.Texture inputTexture

script.run = function() {
    if (!script.ocrController.isInitialized()) {
        print("OCR controller is not initialized yet");
        return;
    }
    // set input texture to process
    // for example device texture or an image picker texture
    script.ocrController.setInputTexture(script.inputTexture);

    //get rectangles of detected lines of text 
    let rects = script.ocrController.getDetectionBoxes();
    //get text
    let lines = script.ocrController.getDetectedText(rects);
    // print results
    for (var i = 0; i < rects.length; i++) {
        Studio.log(i + ". Text: \"" + lines[i] + "\"" + ", Detected Rectangle " + rects[i]);
    }
};

script.createEvent("TapEvent").bind(script.run);
