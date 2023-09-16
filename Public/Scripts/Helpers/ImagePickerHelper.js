// Image Picker Helper.js
// Version: 1.0.0
// Event: On Awake
// Description: allows to add offset to screen transform so it's bottom edge is above picker
// used to avoid cobering ui elements with image picker
// expects global events called "showImagePickerEvent" and "hideImagePickerEvent"
// here is an example of creating and triggering these events from anotehr script

//@input Component.ScreenTransform screenTransform
//@input number bottomOffset

if (script.screenTransform) {
    script.createEvent("OnStartEvent").bind(addCallbacks);
}

function addCallbacks() {
    if (global.showImagePickerEvent) {
        global.showImagePickerEvent.add(addOffset);
    }
    if (global.hideImagePickerEvent) {
        global.hideImagePickerEvent.add(removeOffset);
    }
}

function addOffset() {
    var offsets = script.screenTransform.offsets;
    offsets.bottom = script.bottomOffset;
    script.screenTransform.offsets = offsets;
}

function removeOffset() {
    var offsets = script.screenTransform.offsets;
    offsets.bottom = 0;
    script.screenTransform.offsets = offsets;
}