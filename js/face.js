import { mean, distance2D } from "./geometry.js";

// =======================================================================
//  VISAGE
//  Transforme une détection MediaPipe (boîte + 6 points clés) en repères utiles
//  pour situer les mains : front, menton, bouche, oreilles. Les distances au visage
//  s'expriment en hauteurs de visage, donc indépendamment de l'éloignement.
// =======================================================================

// Ordre des points clés de BlazeFace
const RIGHT_EYE = 0, LEFT_EYE = 1, NOSE = 2, MOUTH = 3, RIGHT_EAR = 4, LEFT_EAR = 5;

/**
 * @param detection  un élément de FaceDetector.detectForVideo(...).detections
 * @param frame      { width, height } de l'image analysée
 * @returns {object|null}
 */
export function computeFaceContext(detection, frame) {
    const keypoints = detection.keypoints;
    const box = detection.boundingBox;
    if (!keypoints || keypoints.length < 6 || !box || !(box.height > 0)) return null;

    const px = k => ({ x: k.x * frame.width, y: k.y * frame.height });
    const eyes = mean([px(keypoints[RIGHT_EYE]), px(keypoints[LEFT_EYE])]);
    const mouth = px(keypoints[MOUTH]);

    // Vecteur bouche -> yeux : il suit l'inclinaison de la tête. Le front et le menton
    // sont placés dans son prolongement, de part et d'autre du visage.
    const up = { x: eyes.x - mouth.x, y: eyes.y - mouth.y };

    return {
        box,
        size: box.height,
        parts: {
            forehead: { x: eyes.x + 0.8 * up.x, y: eyes.y + 0.8 * up.y },
            chin: { x: mouth.x - 0.6 * up.x, y: mouth.y - 0.6 * up.y },
            mouth,
            nose: px(keypoints[NOSE]),
            rightEar: px(keypoints[RIGHT_EAR]),
            leftEar: px(keypoints[LEFT_EAR])
        }
    };
}

/**
 * Distance d'un point (en pixels) à une partie du visage, en hauteurs de visage.
 * part : "forehead" | "chin" | "mouth" | "nose" | "ear" (la plus proche des deux)
 */
export function faceDistance(face, part, point) {
    const { parts, size } = face;
    if (part === "ear") {
        return Math.min(distance2D(point, parts.rightEar), distance2D(point, parts.leftEar)) / size;
    }
    return distance2D(point, parts[part]) / size;
}

// Parmi plusieurs visages, on garde le plus grand : c'est celui de la personne qui signe.
export function largestFace(detections, frame) {
    let best = null;
    for (const detection of detections) {
        const face = computeFaceContext(detection, frame);
        if (face && (!best || face.size > best.size)) best = face;
    }
    return best;
}
