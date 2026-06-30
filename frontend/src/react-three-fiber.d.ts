import { Object3DNode } from '@react-three/fiber';
import * as THREE from 'three';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      group: Object3DNode<THREE.Group, typeof THREE.Group>;
      primitive: Object3DNode<any, any>;
      ambientLight: Object3DNode<THREE.AmbientLight, typeof THREE.AmbientLight>;
      directionalLight: Object3DNode<THREE.DirectionalLight, typeof THREE.DirectionalLight>;
    }
  }
}
