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
    const talkGroup = fbxLoader.parse(getBuffer(talkBuffer), '');
    const idleGroup = fbxLoader.parse(getBuffer(idleBuffer), '');

    const talkAnimRaw = talkGroup.animations[0];
    const idleAnimRaw = idleGroup.animations[0];

    const glbBuffer = fs.readFileSync('./public/models/avatar1.glb');
    const jsonLen = glbBuffer.readUInt32LE(12);
    const jsonString = glbBuffer.toString('utf8', 20, 20 + jsonLen);
    const glbJson = JSON.parse(jsonString);

    const glbSpace = new Map();
    glbJson.nodes.forEach(node => {
        if (node.rotation) {
            glbSpace.set(node.name, new THREE.Quaternion(node.rotation[0], node.rotation[1], node.rotation[2], node.rotation[3]));
        } else {
            glbSpace.set(node.name, new THREE.Quaternion());
        }
    });

    function captureSkeletonSpace(root) {
        const m = new Map();
        root.traverse(o => {
            if (o.isBone) {
                const cleanName = o.name.replace(/mixamorig:|Armature\|/gi, '').split('.')[0];
                m.set(cleanName, o.quaternion.clone());
            }
        });
        return m;
    }

    const talk1Space = captureSkeletonSpace(talkGroup);

    const talkAnimRetargeted = talkAnimRaw.clone();
    for (const track of talkAnimRetargeted.tracks) {
        if (!(track instanceof THREE.QuaternionKeyframeTrack)) continue;
        const boneName = track.name.replace(/mixamorig:|Armature\|/gi, '').split('.')[0];
        const sourceQ = talk1Space.get(boneName);
        const targetQ = glbSpace.get(boneName);
        if (!sourceQ || !targetQ) continue;
        
        const delta = targetQ.clone().multiply(sourceQ.clone().invert());
        const tmp = new THREE.Quaternion();
        for (let i = 0; i < track.values.length; i += 4) {
            tmp.fromArray(track.values, i).premultiply(delta);
            tmp.toArray(track.values, i);
        }
    }

    const bonesToCheck = ['LeftShoulder', 'RightShoulder', 'LeftArm', 'RightArm', 'Spine', 'Spine1', 'Spine2'];
    const toDeg = (rad) => (rad * 180 / Math.PI).toFixed(1);

    function printPose(clip, frameIndex, label) {
        console.log(`\n--- ${label} ---`);
        for (const bone of bonesToCheck) {
            const track = clip.tracks.find(t => t.name.includes(bone) && t.name.endsWith('.quaternion'));
            if (track) {
                const i = frameIndex * 4;
                if (i < track.values.length) {
                    const q = new THREE.Quaternion(track.values[i], track.values[i+1], track.values[i+2], track.values[i+3]);
                    const e = new THREE.Euler().setFromQuaternion(q);
                    console.log(`Bone: ${bone.padEnd(15)} | E:[${toDeg(e.x).padStart(6)}, ${toDeg(e.y).padStart(6)}, ${toDeg(e.z).padStart(6)}]`);
                }
            }
        }
    }

    const getFrames = (clip) => {
        const track = clip.tracks.find(t => t.name.endsWith('.quaternion'));
        const numFrames = track.times.length;
        return {
            start: 0,
            mid: Math.floor(numFrames / 2),
            end: numFrames - 1
        };
    };

    const talkFrames = getFrames(talkAnimRaw);

    console.log(`\n=== 1. GLB Rest Pose (Target) ===`);
    for (const bone of bonesToCheck) {
        const q = glbSpace.get(bone);
        if (q) {
            const e = new THREE.Euler().setFromQuaternion(q);
            console.log(`Bone: ${bone.padEnd(15)} | E:[${toDeg(e.x).padStart(6)}, ${toDeg(e.y).padStart(6)}, ${toDeg(e.z).padStart(6)}]`);
        }
    }

    console.log(`\n=== 2. Talk_1 Space (Source captured from FBX) ===`);
    for (const bone of bonesToCheck) {
        const q = talk1Space.get(bone);
        if (q) {
            const e = new THREE.Euler().setFromQuaternion(q);
            console.log(`Bone: ${bone.padEnd(15)} | E:[${toDeg(e.x).padStart(6)}, ${toDeg(e.y).padStart(6)}, ${toDeg(e.z).padStart(6)}]`);
        }
    }

    console.log(`\n=== 3. Talk_1 RAW Poses ===`);
    printPose(talkAnimRaw, talkFrames.start, 'RAW: Frame 0 (Start)');
    printPose(talkAnimRaw, talkFrames.mid, 'RAW: Mid-movement');
    printPose(talkAnimRaw, talkFrames.end, 'RAW: Final Frame (End)');

    console.log(`\n=== 4. Talk_1 RETARGETED Poses (Runtime Output) ===`);
    printPose(talkAnimRetargeted, talkFrames.start, 'RETARGETED: Frame 0 (Start)');
    printPose(talkAnimRetargeted, talkFrames.mid, 'RETARGETED: Mid-movement');
    printPose(talkAnimRetargeted, talkFrames.end, 'RETARGETED: Final Frame (End)');

    const idleFrames = getFrames(idleAnimRaw);
    console.log(`\n=== 5. Idle RAW Poses ===`);
    printPose(idleAnimRaw, idleFrames.start, 'IDLE RAW: Frame 0 (Start)');
    printPose(idleAnimRaw, idleFrames.mid, 'IDLE RAW: Mid-movement');

} catch(e) {
    console.error(e);
}
