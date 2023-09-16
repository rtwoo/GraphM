// CustomHint.js
// Version: 1.1.0
// Event: On Awake
// Description: Script that allows to set up different hint behaviors 

// @input SceneObject[] hintObjects
// @ui {"widget":"separator"}
// @input int camera {"label" : "Show Hint", "widget":"combobox", "values":[{"label" : "On Front Camera","value":"0"},{"label" : "On Back Camera","value":"1"}, {"label" : "On Both Cameras","value":"2"}, {"label" : "On None","value":"3"}]}
// @ui {"widget":"label", "label":"Use public script api to control hint:script.showHint script.hideHint", "showIf" : "camera", "showIfValue" : "3"}
// @ui {"widget":"separator"}
// @ui {"widget":"group_start","label":"Duration"}
// @input float appearDelay = 0.0 {"label" : "Delay", "min" : 0, "hint" : "Delay before starting appearing animation"}
// @input float appearDuration = 0.8 {"label" : "Fade In", "min" : 0, "hint" : "Hint fade-in time"}
// @input float stayDuration = 2.0 {"label" : "Shown Time", "min" : 0, "hint" : "How long hint stays on screen"}
// @input float disappearDuration = 0.8 {"label" : "Fade Out", "min" : 0, "hint" : "Hint fade-out time"}
// @ui {"widget":"group_end"}
// @ui {"widget":"separator"}
//@input bool advanced = false
//@ui {"widget":"group_start","label":"Advanced Settings", "showIf" : "advanced"}
//@input bool disableHiding = false {"label" : "Disable Hiding"}
//@input bool showOnce = true  {"label" : "Show Once"}
//@input bool hideIfCapture = true {"label" : "Hide On Capture"}
//@input bool hideOnCamSwitch = true {"label" : "Hide On Camera Switch"}
//@ui {"widget":"group_end"}

const opacityController = createOpacityController(script.hintObjects);
var currentAnimation = null;
var timesShown = 0;

script.showHint = startHintAppearing;
script.hideHint = startHintDisappearing;
script.forceHideHint = forceHideHint;

initialize();

function initialize() {
    forceHideHint();

    const frontCameraEvent = script.createEvent("CameraFrontEvent");
    const backCameraEvent = script.createEvent("CameraBackEvent");

    if (script.hideIfCapture) {
        script.createEvent("SnapImageCaptureEvent").bind(forceHideHint);
        script.createEvent("SnapRecordStartEvent").bind(forceHideHint);
    }


    switch (script.camera) {
        case 0:
            frontCameraEvent.bind(onShowingTriggered);
            if (script.hideOnCamSwitch) {
                backCameraEvent.bind(forceHideHint);
            }
            break;
        case 1:
            backCameraEvent.bind(onShowingTriggered);
            if (script.hideOnCamSwitch) {
                frontCameraEvent.bind(forceHideHint);
            }
            break;
        case 2:
            frontCameraEvent.bind(onShowingTriggered);
            backCameraEvent.bind(onShowingTriggered);
            break;
    }

}

function forceHideHint() {
    cancelCurrentAnimation();
    opacityController.setOpacity(0);
    script.hintObjects.forEach(function(hintObject) {
        hintObject.enabled = false;
    });
}

function onShowingTriggered() {
    if (currentAnimation || (script.showOnce && timesShown > 0)) {
        return;
    }
    currentAnimation = delay(script.appearDelay, startHintAppearing);
}

function startHintAppearing() {
    ++timesShown;
    cancelCurrentAnimation();
    script.hintObjects.forEach(function(hintObject) {
        hintObject.enabled = true;
    });
    startAllAnimatedTextureFileProviders(script.hintObjects);
    currentAnimation = interpolateValue(script.appearDuration, function(progress) {
        opacityController.setOpacity(progress);
    })
        .doOnComplete(function() {
            if (!script.disableHiding) {
                currentAnimation = delay(script.stayDuration, startHintDisappearing);
            }
        });
}

function startHintDisappearing() {
    cancelCurrentAnimation();
    currentAnimation = interpolateValue(script.disappearDuration, function(progress) {
        opacityController.setOpacity(1 - progress);
    }).doOnComplete(function() {
        currentAnimation = null;
        script.hintObjects.forEach(function(hintObject) {
            hintObject.enabled = false;
        });
    });
}

function cancelCurrentAnimation() {
    currentAnimation && currentAnimation.cancel();
    currentAnimation = null;
}

// Helpers

function startAllAnimatedTextureFileProviders(rootObjects) {
    const allPasses = getAllMaterialMeshPasses(rootObjects);
    allPasses.forEach(function(pass) {
        const texture = pass.baseTex == null ? pass.baseTexture : pass.baseTex;
        if (texture && texture.control) {
            if (texture.control.isOfType("Provider.AnimatedTextureFileProvider")) {
                texture.control.play(-1, 0);
            }
        }
    });
}

function interpolateValue(time, callback) {
    const updateEvent = script.createEvent("UpdateEvent");
    const startTime = getTime();
    const cancel = function() {
        updateEvent.enabled = false;
        script.removeEvent(updateEvent);
    };

    var onCompleteCallback = null;

    updateEvent.bind(function() {
        const timeSinceStart = getTime() - startTime;
        const progress = timeSinceStart / time;
        if (progress >= 1) {
            callback(1);
            cancel();
            if (onCompleteCallback) {
                onCompleteCallback();
            }
        } else {
            callback(progress);
        }
    });

    const control = {
        cancel: cancel,
        doOnComplete: function(callback) {
            onCompleteCallback = callback;
            return control;
        }
    };

    return control;
}

function delay(time, callback) {
    const delayEvent = script.createEvent("DelayedCallbackEvent");
    const cancel = function() {
        delayEvent.enabled = false;
        script.removeEvent(delayEvent);
    };
    delayEvent.bind(function() {
        callback();
        cancel();
    });
    delayEvent.reset(time);

    return {
        cancel: cancel
    };
}

function createOpacityController(rootObjects) {
    const opacitySetters = [];
    const allMaterialPasses = getAllMaterialMeshPasses(rootObjects);

    allMaterialPasses.forEach(function(pass) {
        const initialOpacity = getOpacityFromPass(pass);
        if (initialOpacity) {
            opacitySetters.push(function(opacity) {
                applyOpacityToPass(pass, opacity * initialOpacity);
            });
        }
    });

    executeRecursiveOnAllChildren(rootObjects, function(rootObject) {
        const textComponents = rootObject.getComponents("Component.Text");
        textComponents.forEach(function(text) {
            const fills = [text.textFill];
            if (text.dropshadowSettings.enabled) {
                fills.push(text.dropshadowSettings.fill);
            }
            if (text.outlineSettings.enabled) {
                fills.push(text.outlineSettings.fill);
            }
            if (text.backgroundSettings.enabled) {
                fills.push(text.backgroundSettings.fill);
            }

            fills.forEach(function(fill) {
                const initialOpacity = fill.color.w;
                opacitySetters.push(function(opacity) {
                    const color = fill.color;
                    color.w = opacity * initialOpacity;
                    fill.color = color;
                });
            });
        });
    });

    return {
        setOpacity: function(opacity) {
            opacitySetters.forEach(function(opacitySetter) {
                opacitySetter(opacity);
            });
        }
    };
}

function getAllMaterialMeshPasses(sceneObjects) {
    const passes = [];
    executeRecursiveOnAllChildren(sceneObjects, function(sceneObject) {
        const materialMeshVisuals = sceneObject.getComponents("Component.MaterialMeshVisual");

        materialMeshVisuals.forEach(function(meshVisual) {
            for (var i = 0; i < meshVisual.getMaterialsCount(); ++i) {
                const material = meshVisual.getMaterial(i);
                for (var j = 0; j < material.getPassCount(); ++j) {
                    passes.push(material.getPass(j));
                }
            }
        });
    });
    return passes;
}

function getOpacityFromPass(pass) {
    if (pass.baseColor) {
        return pass.baseColor.w == null ? pass.baseColor.a : pass.baseColor.w;
    } else {
        return pass.opacity == null ? pass.alpha : pass.opacity;
    }
}

function applyOpacityToPass(pass, opacity) {
    const baseColor = pass.baseColor;
    if (baseColor) {
        baseColor.a = opacity;
        baseColor.w = opacity;
        pass.baseColor = baseColor;
    } else {
        pass.opacity = opacity;
        pass.alpha = opacity;
    }
}

function executeRecursiveOnAllChildren(rootObjects, callback) {
    for (var i = 0; i < rootObjects.length; ++i) {
        callback(rootObjects[i]);
        executeRecursiveOnAllChildren(rootObjects[i].children, callback);
    }
}