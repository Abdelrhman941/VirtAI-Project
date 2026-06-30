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

    // Manual arm drop function
    function dropArms(clip) {
        // We want to rotate the arms down (closer to body). 
        // In Mixamo -> RPM, lowering the arm usually means rotating around the local X or Z axis.
        // Let's create a delta quaternion that pitches the arm down by 20 degrees.
        const dropAngle = THREE.MathUtils.degToRad(-20); // Try negative X
        const deltaL = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), dropAngle);
        const deltaR = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), dropAngle);

        for (const track of clip.tracks) {
            if (!(track instanceof THREE.QuaternionKeyframeTrack)) continue;
            
            let qOffset = null;
            if (track.name.startsWith('LeftArm')) qOffset = deltaL;
            if (track.name.startsWith('RightArm')) qOffset = deltaR;
            // Maybe shoulders too?
            if (track.name.startsWith('LeftShoulder')) qOffset = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), THREE.MathUtils.degToRad(-5));
            if (track.name.startsWith('RightShoulder')) qOffset = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), THREE.MathUtils.degToRad(-5));

            if (qOffset) {
                const tmp = new THREE.Quaternion();
                for (let i = 0; i < track.values.length; i += 4) {
                    tmp.fromArray(track.values, i);
                    // To apply a local offset: tmp.multiply(qOffset)
                    // Or pre-apply: tmp.premultiply(qOffset)
                    // Let's try premultiply (parent space offset) vs multiply (local space offset)
                    tmp.premultiply(qOffset);
                    tmp.toArray(track.values, i);
                }
            }
        }
    }

    dropArms(idleAnim);
    dropArms(talkAnim);

    const bonesToCheck = ['LeftShoulder', 'RightShoulder', 'LeftArm', 'RightArm'];
    const toDeg = (rad) => (rad * 180 / Math.PI).toFixed(1);

    function printPose(clip, frameIndex, label) {
        console.log(`\n--- ${label} ---`);
        for (const bone of bonesToCheck) {
            const track = clip.tracks.find(t => t.name.startsWith(bone) && t.name.endsWith('.quaternion'));
            if (track) {
                const i = frameIndex * 4;
                const q = new THREE.Quaternion(track.values[i], track.values[i+1], track.values[i+2], track.values[i+3]);
                const e = new THREE.Euler().setFromQuaternion(q);
                console.log(`Bone: ${bone.padEnd(15)} | E:[${toDeg(e.x).padStart(6)}, ${toDeg(e.y).padStart(6)}, ${toDeg(e.z).padStart(6)}]`);
            }
        }
    }

    printPose(idleAnim, 0, 'MODIFIED IDLE (Frame 0)');
    printPose(talkAnim, 0, 'MODIFIED TALK (Frame 0)');

} catch(e) { console.error(e); }
