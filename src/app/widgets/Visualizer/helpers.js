import { Box3, TextureLoader } from 'three';
import STLLoader from 'app/lib/three/STLLoader';

const getBoundingBox = (object) => {
  const box = new Box3().setFromObject(object);
  const boundingBox = {
    min: {
      x: box.min.x === Infinity ? 0 : box.min.x,
      y: box.min.y === Infinity ? 0 : box.min.y,
      z: box.min.z === Infinity ? 0 : box.min.z
    },
    max: {
      x: box.max.x === -Infinity ? 0 : box.max.x,
      y: box.max.y === -Infinity ? 0 : box.max.y,
      z: box.max.z === -Infinity ? 0 : box.max.z
    }
  };

  return boundingBox;
};

const loadSTL = (url) => new Promise(resolve => {
  new STLLoader().load(url, resolve);
});

const loadTexture = (url) => new Promise(resolve => {
  new TextureLoader().load(url, resolve);
});

export {
  getBoundingBox,
  loadSTL,
  loadTexture,
};
