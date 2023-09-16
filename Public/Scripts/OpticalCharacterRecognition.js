// OpticalCharacterRecognition.js
// Version: 1.0.0
// Event: OnAwake
// Description: Controls Character Detection and Recognition ML models and provides api to recognize text on the input texture

// Public api:
// 
// Runs detector ml model immediately
// returns array of detected boxes 
// script.getDetectionBoxes()

// Get text on an input texture in the provided rectangles
// Returns list of text labels
// script.getDetectedText(rects)

// Set Input Texture for processing
// script.setInputTexture(texture)

// Get Input Texture that is being processed
// script.getInputTexture

// Whether ml component are ready to process data
// script.isInitialized()

//@ui {"widget":"label", "label":"<b> Character Detection </b>"}
//@ui {"widget":"group_start","label":"Detector Settings"}

//@input Asset.MLAsset detectorMLAsset {"label":"ML Model"}
/** @type {MLAsset} */
let detectorMLAsset = script.detectorMLAsset;

//@input Asset.Texture detectorInputTexture {"label":"Input Texture"}
/** @type {Texture} */
let inputTexture = script.detectorInputTexture;

// @input int maxDetections = 50 {"widget":"slider", "min":1, "max":100, "step":1 }
// @input float thresholdMask = 0.7 {"widget":"slider", "min":0.0, "max":1.0, "step":0.01 , "label" : "Confidence"}
// @input float unclipRatioLongSide = 1  {"widget":"slider", "min":1.0, "max":2.0, "step":0.01 , "label" : "Extend Width", "hint" : "Multiplier to extend the rectangle on the long side"}
// @input float unclipRatioShortSide = 1 {"widget":"slider", "min":1.0, "max":2.0, "step":0.01 , "label" : "Extend Height", "hint" : "Multiplier to extend the rectangle on the short side"}
// @input int minSideThreshold = 5 {"widget":"slider", "min":0, "max":25, "step":0.01 , "label" : "Min Side"}
//@ui {"widget":"group_end"}
//@ui {"widget":"separator"}
// @ui {"widget":"label", "label":"<b> Character Recognition </b>"}

//@ui {"widget":"group_start","label":"Recognition Settings"}

//@input Asset.MLAsset classifierMlAsset {"label": "ML Model"}
/** @type {MLAsset} */
let classifierMlAsset = script.classifierMlAsset;

// @input Asset.Texture cropTexture {"hint" : "Screen Crop Texture Asset"}
/** @type {Texture} */
let cropTexture = script.cropTexture;
// @inputl float recognitionScoreThreshold = 0.8 {"label" : "Confidence", "widget":"slider", "min":0.0, "max":1.0, "step":0.01 }
// @ui {"widget":"group_end"}
// @ui {"widget":"separator"}
// @input bool debugPrint = true

// detector
/** @type {MLComponent} */
let detector = script.detector;
/** @type {InputPlaceholder} */
let detectorInput;
/** @type {Transformer} */
let detectorInputTransformer;
/** @type {InputPlaceholder} */
let detectorOutput;
/** @type {Float32Array} */
let detectorOutputData;
/** @type {Float32Array} */
let segmentationFloatTensor;
/** @type {Uint8Array} */
let segmentationIntTensor;
/** @type {vec3} */
let detectorOutputShape;
/** @type {number} */
let aspect;
// classifier
/** @type {MLComponent} */
let classifier;
/** @type {MLComponent} */
let classifierR;
/** @type {InputPlaceholder} */
let classifierInput;
/** @type {InputPlaceholder} */
let classifierInputR;
/** @type {OutputPlaceholder} */
let classifierOutput;
/** @type {OutputPlaceholder} */
let classifierOutputR;
/** @type {vec3} */
let classifierOutputShape;
/** @type {Float32Array} */
let permutedOutput;
/** @type {Int32Array} */
let contoursTensor;

/** @type {string[]} */
const characterMap = require("CharacterMap").map;
/** @type {vec2} */
const VEC2_ZERO = vec2.zero();
/** @type {boolean} */
let initialized = false;
/** @type {number} */
let mlCompReady = 0;

initialize();

function initialize() {
    if (checkInputs()) {
        configureMLModels();
    }
}

function checkInputs() {
    if (!detectorMLAsset) {
        debugPrint("Error, Detection ML Model is not set");
        return false;
    }
    if (!classifierMlAsset) {
        debugPrint("Error, Recognition ML Model is not set");
        return false;
    }
    return true;
}

function configureMLModels() {
    //detector model 
    detector = createDetectorMlComponent();
    //classifier model
    classifier = createClassifierMlComponent(false);
    //classifier model for rotated input (recognizes totated text)
    classifierR = createClassifierMlComponent(true);

}
/**
 * 
 * @returns 
 */
function createDetectorMlComponent() {
    let mlComponent = script.getSceneObject().createComponent("MLComponent");
    mlComponent.model = detectorMLAsset;

    let transformer = MachineLearning.createTransformerBuilder()
        .setStretch(false)
        .setFillColor(vec4.zero())
        .build();

    let defaultInput = mlComponent.getInputs()[0];
    //rebuild to set transformer
    let inputPlaceholder = MachineLearning.createInputBuilder()
        .setName(defaultInput.name)
        .setShape(defaultInput.shape)
        .setTransformer(transformer)
        .build();

    let outputPlaceholder = mlComponent.getOutputs()[0];
    outputPlaceholder.mode = MachineLearning.OutputMode.Texture;

    mlComponent.onLoadingFinished = wrapFunction(mlComponent.onLoadingFinished, onLoadingFinished);
    mlComponent.build([inputPlaceholder, outputPlaceholder]);
    return mlComponent;
}

/**
 * inititialize and build classifier ml model
 * @param {bool} isRotated 
 * @returns {MLComponent}
 */
function createClassifierMlComponent(isRotated) {
    let mlComponent = script.getSceneObject().createComponent("MLComponent");
    mlComponent.model = classifierMlAsset;
    let defaultInputPl = mlComponent.getInputs()[0];

    let transformer = MachineLearning.createTransformerBuilder()
        .setStretch(false)
        .setFillColor(new vec4(0, 0, 0, 1))
        .setRotation(isRotated ? TransformerRotation.Rotate270 : TransformerRotation.None)
        .build();

    //rebuild to set transformer
    let inputPlaceholder = MachineLearning.createInputBuilder()
        .setName(defaultInputPl.name)
        .setShape(defaultInputPl.shape)
        .setTransformer(transformer)
        .build();
    let outputPlaceholder = mlComponent.getOutputs()[0];
    mlComponent.onLoadingFinished = wrapFunction(mlComponent.onLoadingFinished, onLoadingFinished);
    mlComponent.build([inputPlaceholder, outputPlaceholder]);
    return mlComponent;
}

/**
 * initializes inputs and outputs once all ml components are built
 */
function onLoadingFinished() {
    if (mlCompReady < 2) {
        mlCompReady += 1;
        return;
    }
    debugPrint("Info, Detector Ml Component has loaded");
    //set input and save output data reference
    detectorInput = detector.getInputs()[0];
    detectorOutput = detector.getOutputs()[0];
    detectorInput.texture = inputTexture;
    detectorOutputShape = detectorOutput.shape;
    detectorInputTransformer = detectorInput.transformer;
    aspect = inputTexture.control.getAspect();
    detectorOutputData = detectorOutput.data;

    //create all the tensors to reuse
    contoursTensor = new Int32Array(detectorOutputShape.x * detectorOutputShape.y * 2);
    segmentationFloatTensor = new Float32Array(detectorOutputData.length);
    segmentationIntTensor = new Uint8Array(segmentationFloatTensor);
    cropTexture.control.inputTexture = inputTexture;

    classifierInput = classifier.getInputs()[0];
    classifierOutput = classifier.getOutputs()[0];
    classifierInput.texture = cropTexture;

    classifierInputR = classifierR.getInputs()[0];
    classifierOutputR = classifierR.getOutputs()[0];
    classifierInputR.texture = cropTexture;

    classifierOutputShape = classifierOutput.shape;
    permutedOutput = new Float32Array(classifierOutputShape.x * classifierOutputShape.y);

    initialized = true;
}

/**
 * set input texture for processing
 * @param {Asset.Texture} texture 
 */
function setInputTexture(texture) {
    inputTexture = texture;
    aspect = inputTexture.control.getAspect();
    detectorInput.texture = texture;
    cropTexture.control.inputTexture = texture;
}

/**
 * get input texture 
 * returns {Asset.Texture}  
 */
function getInputTexture() {
    return inputTexture;
}

/**
 * runs ml model immediately and returns result detected boxes
 * @param {Float32Array} classify - whether detected text should be processed with classifier model
 * @returns { RotatedRect[]}}
 */
function getDetectionBoxes() {

    if (!initialized || detector.state != MachineLearning.ModelState.Idle) {
        return [];
    }
    //run detector on this frame
    detector.runImmediate(true);
    let detections = postprocessSegmentation(detectorOutputData);
    // sort detection rectangles from top to bottom 
    detections.sort(compareRectangles);
    debugPrint("Info, detected " + detections.length + " boxes");
    return detections;
}

/**
 * returns detected text from the list of bounding boxes
 * @param {RotatedRect[]} boxes 
 * @returns {string[]}
 */
function getDetectedText(boxes) {
    return boxes.map(b => {
        return classifyDetection(b);
    });
}

/**
 * apply transformation matric to 2d point
 * @param {number} x 
 * @param {number} y 
 * @param {mat3} mat 
 * @returns {vec2} - transformed point
 */
function transformPoint(x, y, mat) {
    let v = new vec3(x, y, 1);
    let x1 = mat.column0.dot(v);
    let y1 = mat.column1.dot(v);
    return new vec2(x1, y1);
}

/**
 * calculates bounding boxes from the contour array
 * @param {Float32Array} contour 
 * @returns {RotatedRect | null} - result rotated rectangle
 */
function getBoxFromContour(contour) {

    let boundingBox = TensorMath.minAreaRect(contour, new vec3(contour.length / 2, 1, 2));
    let center = boundingBox.center;
    let size = boundingBox.size;

    if (Math.min(size.x, size.y) < script.minSideThreshold) {
        return null;
    }

    let shiftDistance = (size.x * size.y) / (2 * size.x + 2 * size.y);

    if (size.x > size.y) {
        size.x += 2 * script.unclipRatioLongSide * shiftDistance;
        size.y += 2 * script.unclipRatioShortSide * shiftDistance;
    } else {
        size.x += 2 * script.unclipRatioShortSide * shiftDistance;
        size.y += 2 * script.unclipRatioLongSide * shiftDistance;
    }

    let left = (center.x - 0.5 * size.x) / detectorOutputShape.x;
    let right = (center.x + 0.5 * size.x) / detectorOutputShape.x;
    let bottom = (center.y + 0.5 * size.y) / detectorOutputShape.y;
    let top = (center.y - 0.5 * size.y) / detectorOutputShape.y;

    let x = (2 * left) - 1;
    let y = 1 - (2 * top);
    let w = 2 * (right - left);
    let h = 2 * (bottom - top);

    let angle = boundingBox.angle;

    let topLeft = transformPoint(x, y, detectorInputTransformer.inverseMatrix);
    // Direction from top to bottom is 1 -> -1
    let bottomRight = transformPoint(x + w, y - h, detectorInputTransformer.inverseMatrix);

    //create 
    left = Math.max(Math.min(1, topLeft.x), -1);
    right = Math.max(Math.min(1, bottomRight.x), -1);
    top = Math.max(Math.min(1, topLeft.y), -1);
    bottom = Math.max(Math.min(1, bottomRight.y), -1);

    let temp = Rect.create(left, right, bottom, top);
    let tempSize = temp.getSize();

    if (Math.abs(angle) > 45) {
        let sign = angle > 0 ? 1 : -1;
        let extraRotate = (sign * angle - 45) / 90;
        let transposeTimes = Math.floor(extraRotate);
        if (Math.abs(transposeTimes - extraRotate) > 1e-6) {
            transposeTimes++;
        }
        if (transposeTimes % 2 == 1) {
            tempSize = new vec2(tempSize.y / aspect, tempSize.x * aspect);
            temp.setSize(tempSize);
        }
        angle -= sign * 90 * transposeTimes;
    }
    return RotatedRect.create(temp.getCenter(), temp.getSize(), angle);
}
/**
 * 
 * @param {Int8Array} bitmap 
 * @returns {RotatedRect[]} a list of detected boxes
 */
function boxesFromBitmap(bitmap) {
    let contoursSizes = TensorMath.findContours(bitmap, detectorOutputShape, 1, 2, VEC2_ZERO, contoursTensor);
    let contoursNum = Math.min(contoursSizes.length, script.maxDetections);
    let previousBytesOffset = 0;
    let result = [];

    for (let i = 0; i < contoursNum; i++) {
        let currentBytesOffset = contoursSizes[i] * 2 * 4;
        let currentContourTensor = new Float32Array(new Int32Array(contoursTensor.buffer, previousBytesOffset, contoursSizes[i] * 2));
        previousBytesOffset += currentBytesOffset;
        let box = getBoxFromContour(currentContourTensor);
        if (box != null) {
            result.push(box);
        }
    }
    return result;
}

/**
 * postprocess segmentation
 * @returns {RotatedRect[]}
 */
function postprocessSegmentation(detectorOutputData) {
    TensorMath.applyThreshold(detectorOutputData, script.thresholdMask * 255, 1, TensorMath.ThresholdMethod.Binary, segmentationFloatTensor);
    segmentationIntTensor = new Uint8Array(segmentationFloatTensor);
    return boxesFromBitmap(segmentationIntTensor);
}

/**
 * crops texture from the input texture and runs it through the corresponding classifier model
 * @param {RotatedRect} box
 */
function classifyDetection(box) {
    let rect = Rect.create(-1, 1, -1, 1);

    rect.setCenter(box.center);
    rect.setSize(box.size);

    cropTexture.control.cropRect = rect;
    cropTexture.control.rotation = box.angle / 180 * Math.PI;

    if (cropTexture.control.getAspect() > 1) {
        classifier.runImmediate(true);
        return postprocessRecognition(classifierOutput.data, true);
    } else {
        classifierR.runImmediate(true);
        return postprocessRecognition(classifierOutputR.data, true);
    }
}

/**
 * postrpocess recognition output
 * @param {Float32Array} recognitionOutput 
 * @param {boolean} removeDuplicates 
 * @returns {string}
 */
function postprocessRecognition(recognitionOutput, removeDuplicates) {
    TensorMath.permute(recognitionOutput, classifierOutputShape, new vec3(2, 0, 1), permutedOutput);
    let argMaxOutput = new Uint32Array(classifierOutputShape.y * 2);
    let characterIndices = new Uint32Array(classifierOutputShape.y);
    TensorMath.argMax(permutedOutput, new vec3(1, classifierOutputShape.x, classifierOutputShape.y), argMaxOutput);
    let j = 0;
    let resultString = "";
    let score = 0;
    for (let i = 0; i < argMaxOutput.length; i++) {
        if (i % 2 == 0) {
            continue;
        }
        characterIndices[j] = argMaxOutput[i];
        j += 1;
    }
    for (let i = 0; i < characterIndices.length; i++) {
        if (characterIndices[i] == 0) {
            continue; // Ignored Token  
        }
        if (removeDuplicates && i > 0 && characterIndices[i - 1] == characterIndices[i]) {
            continue; // Remove Duplicates
        }
        resultString += characterMap[characterIndices[i]];
        score += recognitionOutput[characterIndices[i] + 97 * i];
    }
    if (resultString.length) {
        score /= resultString.length;
    }
    if (score < script.recognitionScoreThreshold) {
        return "";
    }
    return resultString;
}


/**
 * print text if script.debugPrint is enabled
 * @param {Any} text 
 */
function debugPrint(text) {
    if (script.debugPrint) {
        print(text);
    }
}

/**
 * 
 * @param {function} origFunc 
 * @param {function} newFunc 
 * @returns 
 */
function wrapFunction(origFunc, newFunc) {
    if (!origFunc) {
        return newFunc;
    }
    return function() {
        origFunc();
        newFunc();
    };
}

/**
 * sorts text detections horizontally 
 * @param {TextDetection} a 
 * @param {TextDetection} b 
 * @returns {number}
 */
function compareRectangles(a, b) {
    if (a.center.y < b.center.y) {
        return 1; // rectangleA comes before rectangleB
    } else if (a.center.y > b.center.y) {
        return -1; // rectangleA comes after rectangleB
    } else {
        return 0;
    }
}


// //init public api 
script.getDetectionBoxes = getDetectionBoxes;
script.getDetectedText = getDetectedText;
script.setInputTexture = setInputTexture;
script.getInputTexture = getInputTexture;
script.isInitialized = () => {
    return initialized; 
};