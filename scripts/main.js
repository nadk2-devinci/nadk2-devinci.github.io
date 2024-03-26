//------------------------------------------------------------------------------
import {
  publicToken,
  mainSceneUUID,
  characterControllerSceneUUID,
  spawnPosition
} from "../config.js";

import { lockPointer, unlockPointer } from "./utils.js";

import { 
  initDeviceDetection, 
  initControlKeySettings,
  adjustDeviceSensitivity, 
  openSettingsModal,
  closeSettingsModal
} from "./settings.js";


//------------------------------------------------------------------------------
window.addEventListener("load", initApp);

//------------------------------------------------------------------------------
async function initApp() {
    const canvas = document.getElementById("display-canvas");

    const sessionParameters = {
        userToken: publicToken,
        sceneUUID: mainSceneUUID,
        canvas: canvas,
        createDefaultCamera: false,
        showLoadingOverlay: false,

        //startSimulation: "on-assets-loaded",
    };
    await SDK3DVerse.joinOrStartSession(sessionParameters);

    // To spawn a character controller we need to instantiate the 
    // "characterControllerSceneUUID" subscene into our main scene.
    const characterController = await initFirstPersonController(
        characterControllerSceneUUID
    );

    SDK3DVerse.actionMap.values["JUMP"] = [["KEY_32"]];
    SDK3DVerse.actionMap.values["SPRINT"] = [["KEY_16"]];
    setFPSCameraController(canvas); // calls actionMap.propagate() internally

    initDeviceDetection(characterController);
    adjustDeviceSensitivity(characterController);

    initPointerLockEvents();
    initSettingsModalEvents(characterController);
    initControlKeySettings();
    handleClientDisconnection();
        
    initInteractableEntityDisplay(characterController);
    initLock(characterController);

    let torch;
    let newIntensity = 10;
    const characterControllerChildren = await characterController.getChildren()
    console.log(characterControllerChildren);
    for(let characterControllerChild of characterControllerChildren) {
        if(characterControllerChild.isAttached("camera")) {
            torch = (await characterControllerChild.getChildren())[0];
        }
    }

    document.addEventListener('keydown', async (event) => {
        if(event.code === 'KeyF') {
            playFinalAnimation();

        } else if(event.code === 'KeyE') {
            torch.setComponent("point_light", {intensity: newIntensity});
            newIntensity = newIntensity === 0 ? 10 : 0;
        }
    });

    setTimeout(() => {
        console.log("Simulation started")
        SDK3DVerse.engineAPI.startSimulation();
        document.getElementById("loading-screen").classList.remove('active');
    }, 9000);

}

//------------------------------------------------------------------------------
async function initFirstPersonController(charCtlSceneUUID) {
    // To spawn an entity we need to create an EntityTemplate and specify the
    // components we want to attach to it. In this case we only want a scene_ref
    // that points to the character controller scene.
    const playerTemplate = new SDK3DVerse.EntityTemplate();
    playerTemplate.attachComponent("scene_ref", { value: charCtlSceneUUID });
    playerTemplate.attachComponent("local_transform", { position: spawnPosition });
    // Passing null as parent entity will instantiate our new entity at the root
    // of the main scene.
    const parentEntity = null;
    // Setting this option to true will ensure that our entity will be destroyed
    // when the client is disconnected from the session, making sure we don't
    // leave our 'dead' player body behind.
    const deleteOnClientDisconnection = true;
    // We don't want the player to be saved forever in the scene, so we
    // instantiate a transient entity.
    // Note that an entity template can be instantiated multiple times.
    // Each instantiation results in a new entity.
    const playerSceneEntity = await playerTemplate.instantiateTransientEntity(
      "Player",
      parentEntity,
      deleteOnClientDisconnection
    );

    // The character controller scene is setup as having a single entity at its
    // root which is the first person controller itself.
    const firstPersonController = (await playerSceneEntity.getChildren())[0];
    // Look for the first person camera in the children of the controller.
    const children = await firstPersonController.getChildren();
    const firstPersonCamera = children.find((child) =>
      child.isAttached("camera")
    );
        
    SDK3DVerse.engineAPI.fireEvent("a25ea293-d682-45d3-962f-bd63e870a7d3", "call_constructor", [firstPersonController]);

    // We need to assign the current client to the first person controller
    // script which is attached to the firstPersonController entity.
    // This allows the script to know which client inputs it should read.
    SDK3DVerse.engineAPI.assignClientToScripts(firstPersonController);

    // Finally set the first person camera as the main camera.
    await SDK3DVerse.engineAPI.cameraAPI.setMainCamera(firstPersonCamera);
    return firstPersonController;
}

const setFPSCameraController = async (canvas) => {
    // Remove the required click for the LOOK_LEFT, LOOK_RIGHT, LOOK_UP, and 
    // LOOK_DOWN actions.
    SDK3DVerse.actionMap.values["LOOK_LEFT"][0] = ["MOUSE_AXIS_X_POS"];
    SDK3DVerse.actionMap.values["LOOK_RIGHT"][0] = ["MOUSE_AXIS_X_NEG"];
    SDK3DVerse.actionMap.values["LOOK_DOWN"][0] = ["MOUSE_AXIS_Y_NEG"];
    SDK3DVerse.actionMap.values["LOOK_UP"][0] = ["MOUSE_AXIS_Y_POS"];
    SDK3DVerse.actionMap.propagate();

    // Lock the mouse pointer
    canvas.requestPointerLock = (
        canvas.requestPointerLock 
        || canvas.mozRequestPointerLock 
        || canvas.webkitPointerLockElement
    );
    canvas.requestPointerLock({unadjustedMovement: true});
    canvas.focus();
};

const initInteractableEntityDisplay = (characterController) => {

    const canvas = document.getElementById("display-canvas");
    setInterval(async () => {
        const objectTargeted = await SDK3DVerse.engineAPI.castScreenSpaceRay(canvas.width/2, canvas.height/2, false, false, false);
        if(objectTargeted.entity && objectTargeted.entity.isAttached("tags")) {
            const tags = objectTargeted.entity.getComponent("tags").value;
            if(tags.includes("interactable")){
                objectTargeted.entity.select();
                window.selectedInteractable = objectTargeted.entity
                return;
            }
        }
        if(window.selectedInteractable) {
            SDK3DVerse.engineAPI.updateSelectedEntities([window.selectedInteractable], true, 'unselect');
            window.selectedInteractable = null;
        }
    }, 400);

    canvas.addEventListener('mousedown', (event) => {
        interact(event, canvas, characterController);
    });
};

const initLock = (characterController) => {
    document.getElementById("lock-modal").addEventListener('click', (event) => {
        event.stopPropagation();
    });

    document.getElementById("lock-input-1").addEventListener("input", () => checkLockCode(characterController));
    document.getElementById("lock-input-2").addEventListener("input", () => checkLockCode(characterController));
    document.getElementById("lock-input-3").addEventListener("input", () => checkLockCode(characterController));
    document.getElementById("lock-input-4").addEventListener("input", () => checkLockCode(characterController));

    document.getElementById("lock-modal-container").addEventListener('click', () => {
        document.getElementById("lock-modal").parentNode.classList.remove('active');
        lockPointer();
        SDK3DVerse.engineAPI.assignClientToScripts(characterController);
    });

    const incrementArrows = document.getElementsByClassName('increment-arrow');
    for (let i = 0; i < incrementArrows.length; i++) {
        incrementArrows[i].addEventListener('click', (event) => {
            const input = document.getElementById('lock-input-'+(i+1).toString());
            input.value = (parseInt(input.value) + 1) % 10;
            input.dispatchEvent(new Event('input'));
        });
    }

    const decrementArrows = document.getElementsByClassName('decrement-arrow');
    for (let i = 0; i < decrementArrows.length; i++) {
        decrementArrows[i].addEventListener('click', (event) => {
            const input = document.getElementById('lock-input-'+(i+1).toString());
            input.value = (parseInt(input.value) - 1) % 10;
            input.dispatchEvent(new Event('input'));
        });
    }
};

const interact = async (event, canvas, characterController) => {
    // Test if the button was indeed left click
    if(event.button === 0){
        // Screen Space Ray on the middle of the screen
        // This stores an [object Promise] in the JS variable
        let objectClicked = await SDK3DVerse.engineAPI.castScreenSpaceRay(canvas.width/2, canvas.height/2, false, false, false);
        if(objectClicked.entity != null)
        {
            const scriptMapComponent = objectClicked.entity.getComponent('script_map'); //should use SDK3DVerseUtils to clone the component content instead
            if (objectClicked.entity.getComponent("debug_name").value === "Code") {
                showLockModal(characterController);
            }
            else if(objectClicked.entity.isAttached("tags")){//scriptMapComponent && "a5ef8dfe-8b72-497c-97b7-2e65a211d6fe" in scriptMapComponent.elements) {
                //let objectParent = objectClicked.entity.getParent();
                //const initialPosition = objectParent.getGlobalTransform();
                //const playerTransform = SDK3DVerse.engineAPI.cameraAPI.getActiveViewports()[0].getTransform();
                let entity = (await SDK3DVerse.engineAPI.findEntitiesByEUID("9fa45d12-24cd-4b4c-b2f1-c875336efc4a"))[0];
                SDK3DVerse.engineAPI.assignClientToScripts(entity);
                SDK3DVerse.engineAPI.detachClientFromScripts(characterController);
                unlockPointer();
                SDK3DVerse.actionMap.values["LOOK_LEFT"][0] = ["MOUSE_BTN_LEFT","MOUSE_AXIS_X_POS"];
                SDK3DVerse.actionMap.values["LOOK_RIGHT"][0] = ["MOUSE_BTN_LEFT","MOUSE_AXIS_X_NEG"];
                SDK3DVerse.actionMap.values["LOOK_DOWN"][0] = ["MOUSE_BTN_LEFT","MOUSE_AXIS_Y_NEG"];
                SDK3DVerse.actionMap.values["LOOK_UP"][0] = ["MOUSE_BTN_LEFT","MOUSE_AXIS_Y_POS"];
                SDK3DVerse.actionMap.propagate();
                SDK3DVerse.engineAPI.fireEvent("191b5072-b834-40f0-a616-88a6fc2bd7a3", "enter_interaction", [entity]);
                canvas.addEventListener('mouseup', unlockPointer);
                canvas.addEventListener('keydown', ()=> {
                    SDK3DVerse.engineAPI.assignClientToScripts(characterController);
                    SDK3DVerse.engineAPI.detachClientFromScripts(entity);
                    canvas.removeEventListener('mouseup', unlockPointer);
                    lockPointer();
                    setFPSCameraController(canvas);
                }, {once: true});
            }
        }
        else
        {
            console.log("Missed");
        }
    }

    // If an object was hit, duplicate it in a scaled verison, handleable by players
    // Camera work
    // Character work
};

//------------------------------------------------------------------------------
function showLockModal(characterController) {
    document.getElementById("lock-modal").parentNode.classList.add('active');
    SDK3DVerse.engineAPI.detachClientFromScripts(characterController);
    unlockPointer();

}

async function checkLockCode(characterController) {
    var code = "1234"; // Replace with your correct code
    var input1 = document.getElementById("lock-input-1").value;
    var input2 = document.getElementById("lock-input-2").value;
    var input3 = document.getElementById("lock-input-3").value;
    var input4 = document.getElementById("lock-input-4").value;

    var enteredCode = input1 + input2 + input3 + input4;

    if (enteredCode === code) {
        document.getElementById("lock-modal").parentNode.classList.remove('active');
        lockPointer();
        SDK3DVerse.engineAPI.assignClientToScripts(characterController);
        const chestSceneEntity = await SDK3DVerse.engineAPI.findEntitiesByNames('chest');
        await SDK3DVerse.engineAPI.playAnimationSequence("a16461db-aa16-4e2e-8cb0-fe123a6d8d7c", { playbackSpeed: 1, seekOffset: 0 }, chestSceneEntity[0]);
    } else {
        console.log("Code is incorrect!");
    }
}

async function playFinalAnimation() {
    const helicopterSceneEntity = await SDK3DVerse.engineAPI.findEntitiesByNames('helicopter');
    const helicopterMovementAnimScene = await SDK3DVerse.engineAPI.findEntitiesByNames('Amphitheatre + Props');
    await SDK3DVerse.engineAPI.playAnimationSequence("60be1b11-d192-42ce-913d-9ef930750ec9", { playbackSpeed: 0.5, seekOffset: 0 }, helicopterSceneEntity[0]);
    await SDK3DVerse.engineAPI.playAnimationSequence("46e60a89-f1ba-4f24-8b88-ee82a879cd70",{ playbackSpeed: 1, seekOffset: 0 }, helicopterMovementAnimScene[0])
    setTimeout(async()=>{await SDK3DVerse.engineAPI.playAnimationSequence("60be1b11-d192-42ce-913d-9ef930750ec9", { playbackSpeed: 1, seekOffset: 12 }, helicopterSceneEntity[0]);}, 500);
    setTimeout(async()=>{await SDK3DVerse.engineAPI.playAnimationSequence("60be1b11-d192-42ce-913d-9ef930750ec9", { playbackSpeed: 1.5, seekOffset: 41 }, helicopterSceneEntity[0]);}, 1500);
}

//------------------------------------------------------------------------------
function handleClientDisconnection() {
    // Users are considered inactive after 5 minutes of inactivity and are
    // kicked after 30 seconds of inactivity. Setting an inactivity callback 
    // with a 30 seconds cooldown allows us to open a popup when the user gets
    // disconnected.
    SDK3DVerse.setInactivityCallback(showInactivityPopup);

    // The following does the same but in case the disconnection is 
    // requested by the server.
    SDK3DVerse.notifier.on("onConnectionClosed", showDisconnectedPopup);
}

//------------------------------------------------------------------------------
function showInactivityPopup() {
    document.getElementById("resume").addEventListener('click', closeInactivityPopup);
    document.getElementById("inactivity-modal").parentNode.classList.add('active');
}

//------------------------------------------------------------------------------
function closeInactivityPopup() {
    document.getElementById("resume").removeEventListener('click', closeInactivityPopup);
    document.getElementById("inactivity-modal").parentNode.classList.remove('active');
}

//------------------------------------------------------------------------------
function showDisconnectedPopup() {
    document.getElementById("reload-session").addEventListener('click', () => window.location.reload());
    document.getElementById("disconnected-modal").parentNode.classList.add('active');
}

//------------------------------------------------------------------------------
function initPointerLockEvents() {
    // Web browsers have a safety mechanism preventing the pointerlock to be
    // instantly requested after being naturally exited, if the user tries to
    // relock the pointer too quickly, we wait a second before requesting 
    // pointer lock again.
    document.addEventListener('pointerlockerror', async () => {
        if (document.pointerLockElement === null) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            await lockPointer();
        }
    });
}

//------------------------------------------------------------------------------
function initSettingsModalEvents(characterController) {
    const closeSettingsButton = document.getElementById("close-settings");
    closeSettingsButton.addEventListener('click', () => {
        closeSettingsModal(characterController);
        SDK3DVerse.enableInputs();
    });

    // If the user leaves the pointerlock, we open the settings popup and
    // disable their influence over the character controller.
    document.addEventListener('keydown', (event) => {
        if(event.code === 'Escape') {
            const settingsContainer = document.getElementById("settings-modal").parentNode;
            if(settingsContainer.classList.contains('active')) {
                closeSettingsModal(characterController);
                SDK3DVerse.enableInputs();
            } else {
                SDK3DVerse.disableInputs();
                openSettingsModal();
            }
        }
    });
}