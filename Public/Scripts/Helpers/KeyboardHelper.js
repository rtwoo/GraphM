// KeyboardHelper.js
// Version: 1.0.0
// Event: On Awake
// Description: Provides an api to open keyboard for specific text component

// @input Component.Text textComponent
 
let options = new TextInputSystem.KeyboardOptions();
options.enablePreview = true;
options.keyboardType = TextInputSystem.KeyboardType.Text;
options.returnKeyType = TextInputSystem.ReturnKeyType.Done;
options.onTextChanged = (text, range) => {
    script.textComponent.text = text;
};

script.openKeyboard = function open() {
    options.initialText = script.textComponent.text;
    options.initialSelectedRange = new vec2(0, script.textComponent.text.length);
    global.textInputSystem.requestKeyboard(options);
};
