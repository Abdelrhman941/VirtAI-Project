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

    function getBuffer(buf) {
        return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    }

    const fbxLoader = new FBXLoader();
    const idleGroup = fbxLoader.parse(getBuffer(idleBuffer), '');
    const talkGroup = fbxLoader.parse(getBuffer(talkBuffer), '');

    const idleAnim = idleGroup.animations[0];
    const talkAnim = talkGroup.animations[0];

    function analyzeClip(clip, name) {
        console.log(`\n--- Clip: ${name} ---`);
        console.log(`Duration: ${clip.duration.toFixed(2)}s`);
        const tracks = clip.tracks;
        
        const bonesToCheck = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'LeftShoulder', 'RightShoulder', 'LeftArm', 'RightArm', 'LeftForeArm', 'RightForeArm'];
        
        for (const bone of bonesToCheck) {
            const qTrack = tracks.find(t => t.name.includes(bone) && t.name.endsWith('.quaternion'));
            if (qTrack) {
                let maxAngleDiff = 0;
                const values = qTrack.values;
                const times = qTrack.times;
                const numFrames = times.length;
                
                const q0 = new THREE.Quaternion(values[0], values[1], values[2], values[3]);
                const qLast = new THREE.Quaternion(values[(numFrames-1)*4], values[(numFrames-1)*4+1], values[(numFrames-1)*4+2], values[(numFrames-1)*4+3]);
                
                const e0 = new THREE.Euler().setFromQuaternion(q0);
                const eLast = new THREE.Euler().setFromQuaternion(qLast);
                
                for(let i=0; i<values.length; i+=4) {
                    const q = new THREE.Quaternion(values[i], values[i+1], values[i+2], values[i+3]);
                    const angle = q0.angleTo(q);
                    if (angle > maxAngleDiff) maxAngleDiff = angle;
                }
                
                const toDeg = (rad) => (rad * 180 / Math.PI).toFixed(1);
                
                console.log(`Bone: ${bone.padEnd(15)} | MaxAmp: ${maxAngleDiff.toFixed(2)}rad | FirstFrame(deg): [${toDeg(e0.x)}, ${toDeg(e0.y)}, ${toDeg(e0.z)}] | LastFrame(deg): [${toDeg(eLast.x)}, ${toDeg(eLast.y)}, ${toDeg(eLast.z)}]`);
            } else {
                console.log(`Bone: ${bone.padEnd(15)} | No quaternion track`);
            }
        }
    }

    if (idleAnim) analyzeClip(idleAnim, 'Idle.fbx');
    if (talkAnim) analyzeClip(talkAnim, 'Talk_1.fbx');

    const glbBuffer = fs.readFileSync('./public/models/avatar1.glb');
    const jsonLen = glbBuffer.readUInt32LE(12);
    const jsonString = glbBuffer.toString('utf8', 20, 20 + jsonLen);
    const glbJson = JSON.parse(jsonString);

    console.log(`\n--- GLB Rest Pose ---`);
    const nodes = glbJson.nodes;
    const bonesToCheck = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'LeftShoulder', 'RightShoulder', 'LeftArm', 'RightArm', 'LeftForeArm', 'RightForeArm'];
    
    bonesToCheck.forEach(bone => {
        const node = nodes.find(n => n.name === bone);
        if (node) {
            if (node.rotation) {
                const q = new THREE.Quaternion(node.rotation[0], node.rotation[1], node.rotation[2], node.rotation[3]);
                const e = new THREE.Euler().setFromQuaternion(q);
                const toDeg = (rad) => (rad * 180 / Math.PI).toFixed(1);
                console.log(`Bone: ${bone.padEnd(15)} | Rest(deg): [${toDeg(e.x)}, ${toDeg(e.y)}, ${toDeg(e.z)}]`);
            } else {
                console.log(`Bone: ${bone.padEnd(15)} | Rest(deg): [0.0, 0.0, 0.0]`);
            }
        } else {
            console.log(`Bone: ${bone.padEnd(15)} | Not found in GLB`);
        }
    });

} catch (e) {
    console.error(e);
}
