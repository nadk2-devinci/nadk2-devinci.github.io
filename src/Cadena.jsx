import React from 'react';
import './Cadena.css';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import InputGroup from 'react-bootstrap/InputGroup';
import Modal from 'react-bootstrap/Modal';
import {Howl, Howler} from 'howler';

export function Cadena({ show, setShow }) {
    Howler.volume(1);
    
    var locked = new Howl({
        src: ['fx/lockedSound.mp3']
    });

    var unlocked = new Howl({
        src: ['fx/unlockedSound.mp3']
    });

    //const [show, setShow] = useState(false);

    const handleClose = () => setShow(false);
    const handleShow = () => setShow(true);

    const handleSubmit = (event) => {
        const form = event.currentTarget;

        let firstCodeNumber = document.getElementById("firstCodeNumber").value;
        let secondCodeNumber = document.getElementById("secondCodeNumber").value;
        let thirdCodeNumber = document.getElementById("thirdCodeNumber").value;
        let fourthCodeNumber = document.getElementById("fourthCodeNumber").value;

        if (!firstCodeNumber) {firstCodeNumber =  0}
        if (!secondCodeNumber) {secondCodeNumber = 0}
        if (!thirdCodeNumber) {thirdCodeNumber = 0}
        if (!fourthCodeNumber) {fourthCodeNumber = 0}

        console.log(firstCodeNumber, secondCodeNumber, thirdCodeNumber, fourthCodeNumber);

        if (firstCodeNumber === "1" && secondCodeNumber === "4" && thirdCodeNumber === "5" && fourthCodeNumber === "2") {
            console.log("ouvert");
            openChest();
            unlocked.play();
            handleClose();
            window.SDK3DVerse.engineAPI.assignClientToScripts(window.clientController);
            bpAppears();
        }
        else {
            console.log("fermé");
            locked.play();
            document.getElementById("locked").innerHTML = "Rien ne se passe..."; 
        }

        form.checkValidity()
        event.preventDefault();
        event.stopPropagation();
    };

    async function bpAppears(){
        const found = (await SDK3DVerse.engineAPI.findEntitiesByNames('bp2 container'))[0];
        found.setVisibility(true);
    }

    
    return (
        <>
        <Button variant="primary" className='btn-custom' onClick={handleShow}>
            Ouvrir le cadenas
        </Button>
    
        <Modal className='text-center' style={{fontFamily: 'Dancing Script', fontSize: '22px'}} show={show} onHide={()=> {handleClose(); window.SDK3DVerse.engineAPI.assignClientToScripts(window.clientController);}} centered>
            <Form onSubmit={handleSubmit}>
                <Modal.Header closeButton>
                    <Modal.Title className="ms-auto">Cadenas</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form.Group>
                        <InputGroup className="mb-3" >
                            <Form.Control className='text-center' id='firstCodeNumber' maxLength={1} pattern='\d{1,1}' name='codeNumber' placeholder="*" required />
                            <Form.Control className='text-center' id='secondCodeNumber' maxLength={1} pattern='\d{1,1}' name='codeNumber' placeholder="*" required />
                            <Form.Control className='text-center' id='thirdCodeNumber' maxLength={1} pattern='\d{1,1}' name='codeNumber' placeholder="*" required />
                            <Form.Control className='text-center' id='fourthCodeNumber' maxLength={1} pattern='\d{1,1}' name='codeNumber' placeholder="*" required />
                        </InputGroup>
                        <div id='locked'></div>
                    </Form.Group>
                </Modal.Body>
                <Modal.Footer style={{display: "flex", justifyContent: "center"}}>
                    <Button variant="primary" type="submit">Ouvrir</Button>
                </Modal.Footer>
            </Form>
        </Modal>
        </>
    );
};



async function openChest(){
    //const animTemplate = new SDK3DVerse.EntityTemplate();
    //animTemplate.attachComponent("scene_ref", { value: "0c8e7a7e-4eeb-48c9-90cc-a67b768aac0c" });
    //const chestSceneEntity = await animTemplate.instantiateTransientEntity(
    //    "Chest",
    //    null,
    //    true
    //);
    const chestSceneEntity = await SDK3DVerse.engineAPI.findEntitiesByNames('chest');
    await console.log(chestSceneEntity);
    await SDK3DVerse.engineAPI.playAnimationSequence("a16461db-aa16-4e2e-8cb0-fe123a6d8d7c", { playbackSpeed: 1, seekOffset: 0 }, chestSceneEntity[0]);
}