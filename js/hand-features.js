import {
    FINGER_EXTENDED_MIN_ANGLE, FINGER_FOLDED_MAX_ANGLE,
    THUMB_EXTENDED_MIN_ANGLE, THUMB_EXTENDED_MIN_REACH, THUMB_FOLDED_MAX_REACH,
    THUMB_OVER_FINGERS_MAX_DISTANCE,
    FINGERS_TOGETHER_MAX_SPREAD, FINGERS_APART_MIN_SPREAD
} from "./config.js";
import { toPixels, distance, mean, angleAt, angleFromUp } from "./geometry.js";

// =======================================================================
//  DESCRIPTION D'UNE MAIN
//  Transforme les 21 landmarks MediaPipe en grandeurs simples (doigt tendu / plié,
//  orientation, écarts...) toutes indépendantes de la distance à la caméra.
// =======================================================================

export const FOUR_FINGERS = ["index", "middle", "ring", "pinky"];

// Landmarks MediaPipe : base (MCP), articulation du milieu (PIP), bout (TIP)
const FINGER_JOINTS = {
    index: { mcp: 5, pip: 6, tip: 8 },
    middle: { mcp: 9, pip: 10, tip: 12 },
    ring: { mcp: 13, pip: 14, tip: 16 },
    pinky: { mcp: 17, pip: 18, tip: 20 }
};

function fingerState(pipAngle) {
    if (pipAngle >= FINGER_EXTENDED_MIN_ANGLE) return "extended";
    if (pipAngle <= FINGER_FOLDED_MAX_ANGLE) return "folded";
    return "curved";
}

function thumbState(ipAngle, reach, overFingers) {
    if (overFingers <= THUMB_OVER_FINGERS_MAX_DISTANCE) return "folded";
    if (ipAngle >= THUMB_EXTENDED_MIN_ANGLE && reach >= THUMB_EXTENDED_MIN_REACH) return "extended";
    if (reach <= THUMB_FOLDED_MAX_REACH) return "folded";
    return "curved";
}

/**
 * @param landmarks  les 21 landmarks MediaPipe (normalisés)
 * @param frame      { width, height } de l'image analysée
 * @returns {object|null} null si la main est dégénérée (taille de paume nulle).
 */
export function computeHandFeatures(landmarks, frame) {
    const p = toPixels(landmarks, frame);
    const palm = distance(p[0], p[9]);
    if (!(palm > 0)) return null;

    const d = (i, j) => distance(p[i], p[j]) / palm;

    const fingers = {};
    const pipAngles = {};
    for (const [name, joint] of Object.entries(FINGER_JOINTS)) {
        pipAngles[name] = angleAt(p[joint.pip], p[joint.mcp], p[joint.tip]);
        fingers[name] = fingerState(pipAngles[name]);
    }
    const thumb = {
        ipAngle: angleAt(p[3], p[2], p[4]),
        reach: d(4, 5),
        indexGap: d(4, 8),
        overFingers: Math.min(d(4, 10), d(4, 14), d(4, 18))
    };
    fingers.thumb = thumbState(thumb.ipAngle, thumb.reach, thumb.overFingers);

    return {
        frame,
        points: p,
        palm,                                       // taille de la paume, en pixels
        d,                                          // d(i, j) : distance entre deux landmarks, en paumes
        fingers,                                    // thumb/index/middle/ring/pinky -> "extended" | "curved" | "folded"
        center: mean([p[0], p[5], p[9], p[13], p[17]]),
        indexTip: p[8],
        tipsCenter: mean([p[8], p[12], p[16], p[20]]),
        upAngle: angleFromUp(p[0], p[9]),           // direction des doigts (0 = vers le haut)
        thumbAngle: angleFromUp(p[2], p[4]),        // direction du pouce
        spread: d(8, 20) / d(5, 17),                // écartement des doigts
        measures: { pipAngles, thumb },             // valeurs brutes, pour le panneau de diagnostic
        motion: null,                               // renseigné par SignRecognizer
        face: null,                                 // idem : visage détecté sur cette frame, ou null
        faceDistance: () => Infinity                // idem : distance à une partie du visage
    };
}

// -----------------------------------------------------------------------
//  Prédicats de forme
// -----------------------------------------------------------------------

export const isExtended = (hand, ...names) => names.every(n => hand.fingers[n] === "extended");
export const isClosed = (hand, ...names) => names.every(n => hand.fingers[n] !== "extended");
export const countFingers = (hand, state) => FOUR_FINGERS.filter(n => hand.fingers[n] === state).length;

export const isFist = hand => isClosed(hand, ...FOUR_FINGERS) && countFingers(hand, "folded") >= 3;
export const isOpenHand = hand => isExtended(hand, ...FOUR_FINGERS);
export const isFlatHand = hand => isOpenHand(hand) && hand.spread < FINGERS_TOGETHER_MAX_SPREAD;
export const isSpreadHand = hand => isOpenHand(hand) && hand.spread > FINGERS_APART_MIN_SPREAD;
