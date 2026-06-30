import fs from 'fs';
import { Window } from 'happy-dom';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

const window = new Window();
global.window = window;
global.document = window.document;
global.self = window;

try {
    const idleBuffer = fs.readFileSync('./public/models/animations/Idle/Idle.fbx');
    const talkBuffer = fs.readFileSync('./public/models/animations/Talk/Talk_1.fbx');

    function getBuffer(buf) { return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength); }

    const fbxLoader = new FBXLoader();
    const idleGroup = fbxLoader.parse(getBuffer(idleBuffer), '');
    const talkGroup = fbxLoader.parse(getBuffer(talkBuffer), '');
    
    const idleAnim = idleGroup.animations[0].clone();
    const talkAnim = talkGroup.animations[0].clone();

    // Clean names
    idleAnim.tracks.forEach(t => t.name = t.name.replace(/mixamorig:|Armature\|/gi, ''));
    talkAnim.tracks.forEach(t => t.name = t.name.replace(/mixamorig:|Armature\|/gi, ''));

    const dropAngleArm = THREE.MathUtils.degToRad(-25); // stronger drop
    const dropAngleShoulder = THREE.MathUtils.degToRad(-10); // stronger drop
    
    const qDropArm = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), dropAngleArm);
    const qDropShoulder = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), dropAngleShoulder);

    // Simulate additive blend evaluation
    function evaluateAdditive(clip, frameIndex) {
        const result = {};
        for (const track of clip.tracks) {
            if (!(track instanceof THREE.QuaternionKeyframeTrack)) continue;
            const bone = track.name.split('.')[0];
            const i = frameIndex * 4;
            if (i < track.values.length) {
                const baseQ = new THREE.Quaternion(track.values[i], track.values[i+1], track.values[i+2], track.values[i+3]);
                
                let additiveQ = new THREE.Quaternion(); // identity
                if (bone === 'LeftArm' || bone === 'RightArm') additiveQ = qDropArm;
                if (bone === 'LeftShoulder' || bone === 'RightShoulder') additiveQ = qDropShoulder;
                
                // Additive blend in Three.js (for rotations) multiplies the base by the additive rotation.
                // Action: result = baseQ * additiveQ (or additiveQ * baseQ)
                // In Three.js, additive animation applies: currentQ.multiply(additiveQ)
                const finalQ = baseQ.clone().multiply(additiveQ);
                result[bone] = finalQ;
            }
        }
        return result;
    }

    const bonesToCheck = ['LeftShoulder', 'RightShoulder', 'LeftArm', 'RightArm'];
    const toDeg = (rad) => (rad * 180 / Math.PI).toFixed(1);

    function printPose(poses, label) {
        console.log(`\n--- ${label} ---`);
        for (const bone of bonesToCheck) {
            if (poses[bone]) {
                const e = new THREE.Euler().setFromQuaternion(poses[bone]);
                console.log(`Bone: ${bone.padEnd(15)} | E:[${toDeg(e.x).padStart(6)}, ${toDeg(e.y).padStart(6)}, ${toDeg(e.z).padStart(6)}]`);
            }
        }
    }

    const idlePoses = evaluateAdditive(idleAnim, 0);
    const talkPoses = evaluateAdditive(talkAnim, 0);
    const talkMidPoses = evaluateAdditive(talkAnim, Math.floor(talkAnim.tracks[0].times.length / 2));

    printPose(idlePoses, 'ADDITIVE IDLE (Frame 0)');
    printPose(talkPoses, 'ADDITIVE TALK (Frame 0)');
    printPose(talkMidPoses, 'ADDITIVE TALK (Mid)');

} catch(e) { console.error(e); }
