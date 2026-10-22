import {
    PINCH_MAX_DISTANCE, BUNCH_MAX_MEAN_DISTANCE, BUNCH_MAX_DISTANCE,
    C_SHAPE_MIN_THUMB_GAP, C_SHAPE_MAX_THUMB_GAP,
    C_SHAPE_MIN_FINGER_ANGLE, C_SHAPE_MAX_FINGER_ANGLE, FLAT_EAT_MAX_FACE_DISTANCE,
    UPRIGHT_MAX_ANGLE, THUMB_VERTICAL_MAX_ANGLE,
    NEAR_FACE_MAX_DISTANCE, NEAR_FACE_LOOSE_DISTANCE, FINGERS_TOGETHER_MAX_SPREAD,
    ROOF_MIN_HANDS_DISTANCE, ROOF_MAX_TIPS_DISTANCE,
    WHEEL_MIN_DISTANCE, WHEEL_MAX_DISTANCE, WHEEL_MAX_HEIGHT_GAP
} from "./config.js";
import { distance2D } from "./geometry.js";
import {
    FOUR_FINGERS, isExtended, isClosed, countFingers,
    isFist, isOpenHand, isFlatHand, isSpreadHand
} from "./hand-features.js";

// =======================================================================
//  CATALOGUE DES SIGNES LSF
//
//  kind   : "static" (une main) ou "two-hands"
//  match  : une main -> match(hand) ; deux mains -> match(handA, handB)
//
//  L'ordre compte : le premier signe qui correspond l'emporte.
//
//  Les signes qui se font près du visage (Manger, Boire, Eau, Téléphone) utilisent
//  sa position. Sans visage détecté, ils retombent sur la seule forme de la main.
//  Ce sont des approximations : le corps n'est pas suivi.
// =======================================================================

// Vrai si les bouts des doigts (ou `point`) sont près de cette partie du visage.
// Sans visage détecté, on ne bloque pas le signe.
const nearFace = (hand, part, max = NEAR_FACE_MAX_DISTANCE, point) =>
    !hand.face || hand.faceDistance(part, point) <= max;

const isUpright = hand => Math.abs(hand.upAngle) < UPRIGHT_MAX_ANGLE;
const thumbIsOut = hand => hand.fingers.thumb === "extended";
// Pouce tendu ou simplement courbé (le seuil "tendu" est strict : 1° de moins suffit à basculer)
const thumbIsOpen = hand => hand.fingers.thumb !== "folded";
const thumbIsVertical = (hand, up) => {
    const angle = Math.abs(hand.thumbAngle);
    return up ? angle < THUMB_VERTICAL_MAX_ANGLE : angle > 180 - THUMB_VERTICAL_MAX_ANGLE;
};

// Les quatre bouts de doigts rassemblés sur le bout du pouce
const fingertipsBunched = hand => {
    const gaps = [8, 12, 16, 20].map(tip => hand.d(4, tip));
    const mean = gaps.reduce((s, g) => s + g, 0) / gaps.length;
    return mean < BUNCH_MAX_MEAN_DISTANCE && Math.max(...gaps) < BUNCH_MAX_DISTANCE;
};

// Les doigts arrondis (angle PIP moyen), sans être serrés en poing
const isCShape = hand => {
    const { pipAngles, thumb } = hand.measures;
    const rounded = FOUR_FINGERS.filter(name =>
        pipAngles[name] >= C_SHAPE_MIN_FINGER_ANGLE && pipAngles[name] <= C_SHAPE_MAX_FINGER_ANGLE);
    return rounded.length >= 3 &&
        thumbIsOpen(hand) &&    // sinon une main simplement détendue serait prise pour un C
        thumb.indexGap >= C_SHAPE_MIN_THUMB_GAP && thumb.indexGap <= C_SHAPE_MAX_THUMB_GAP;
};

// Doigts tendus et joints, pouce rabattu dessus, bouts des doigts sur la bouche
const isFlatEating = hand => hand.face && hand.fingers.thumb === "folded" &&
    countFingers(hand, "folded") === 0 && hand.spread < FINGERS_TOGETHER_MAX_SPREAD &&
    hand.faceDistance("mouth") <= FLAT_EAT_MAX_FACE_DISTANCE;

const averagePalm = (a, b) => (a.palm + b.palm) / 2;

export const SIGNS = [
    // ------------------------------------------------------------------
    //  Une main
    // ------------------------------------------------------------------
    {
        id: "super", label: "Super / Ça va", kind: "static",
        hint: "Poing, pouce levé",
        match: h => isFist(h) && thumbIsOut(h) && thumbIsVertical(h, true)
    },
    {
        id: "mauvais", label: "Pas bien", kind: "static",
        hint: "Poing, pouce vers le bas",
        match: h => isFist(h) && thumbIsOut(h) && thumbIsVertical(h, false)
    },
    {
        id: "je-t-aime", label: "Je t'aime", kind: "static",
        hint: "Pouce, index et auriculaire tendus",
        match: h => isExtended(h, "thumb", "index", "pinky") && isClosed(h, "middle", "ring")
    },
    {
        id: "telephone", label: "Téléphone", kind: "static",
        hint: "Pouce et auriculaire tendus, main près de l'oreille",
        match: h => thumbIsOpen(h) && isExtended(h, "pinky") && isClosed(h, "index", "middle", "ring") &&
            nearFace(h, "ear", NEAR_FACE_LOOSE_DISTANCE, h.center)
    },
    {
        id: "ok", label: "OK", kind: "static",
        hint: "Pouce et index en cercle, les trois autres doigts tendus",
        match: h => h.d(4, 8) < PINCH_MAX_DISTANCE && isExtended(h, "middle", "ring", "pinky")
    },
    {
        id: "manger", label: "Manger", kind: "static",
        hint: "Bouts des doigts réunis (sur le pouce ou joints à plat), sur la bouche",
        match: h => (countFingers(h, "folded") < 3 && fingertipsBunched(h) && nearFace(h, "mouth")) || isFlatEating(h)
    },
    {
        id: "attends", label: "Attends / Stop", kind: "static",
        hint: "Main ouverte, doigts écartés, immobile",
        match: h => isSpreadHand(h) && h.motion.still
    },
    {
        id: "trois", label: "Trois", kind: "static",
        hint: "Pouce, index et majeur tendus",
        match: h => isExtended(h, "thumb", "index", "middle") && isClosed(h, "ring", "pinky")
    },
    {
        id: "deux", label: "Deux", kind: "static",
        hint: "Index et majeur tendus, pouce replié",
        match: h => isExtended(h, "index", "middle") && isClosed(h, "ring", "pinky") && !thumbIsOut(h)
    },
    {
        id: "un", label: "Un", kind: "static",
        hint: "Index tendu vers le haut",
        match: h => isExtended(h, "index") && isClosed(h, "middle", "ring", "pinky") && !thumbIsOut(h) && isUpright(h)
    },
    {
        id: "eau", label: "Eau", kind: "static",
        hint: "Index, majeur et annulaire tendus, au niveau du menton",
        match: h => isExtended(h, "index", "middle", "ring") && isClosed(h, "pinky") && !thumbIsOut(h) &&
            nearFace(h, "chin")
    },
    {
        id: "boire", label: "Boire", kind: "static",
        hint: "Main en forme de C, près de la bouche, comme tenant un verre",
        match: h => isCShape(h) &&
            (nearFace(h, "mouth", NEAR_FACE_LOOSE_DISTANCE, h.center) || nearFace(h, "mouth"))
    },

    // ------------------------------------------------------------------
    //  Deux mains (Maison avant Bravo : un toit est aussi "deux mains ouvertes")
    // ------------------------------------------------------------------
    {
        id: "maison", label: "Maison", kind: "two-hands",
        hint: "Deux mains plates dont les bouts des doigts se touchent, en toit",
        match: (a, b) => {
            if (!isFlatHand(a) || !isFlatHand(b)) return false;
            const palm = averagePalm(a, b);
            return distance2D(a.center, b.center) / palm > ROOF_MIN_HANDS_DISTANCE &&
                distance2D(a.points[12], b.points[12]) / palm < ROOF_MAX_TIPS_DISTANCE;
        }
    },
    {
        id: "voiture", label: "Voiture", kind: "two-hands",
        hint: "Deux poings à la même hauteur, comme tenant un volant",
        match: (a, b) => {
            if (!isFist(a) || !isFist(b)) return false;
            const palm = averagePalm(a, b);
            const dx = Math.abs(a.center.x - b.center.x) / palm;
            const dy = Math.abs(a.center.y - b.center.y) / palm;
            return dx >= WHEEL_MIN_DISTANCE && dx <= WHEEL_MAX_DISTANCE && dy <= WHEEL_MAX_HEIGHT_GAP;
        }
    },
    {
        id: "bravo", label: "Bravo", kind: "two-hands",
        hint: "Deux mains ouvertes levées",
        match: (a, b) => [a, b].every(h => isOpenHand(h) && isUpright(h))
    }
];

export const SIGNS_BY_ID = new Map(SIGNS.map(sign => [sign.id, sign]));
export const ONE_HAND_SIGNS = SIGNS.filter(sign => sign.kind !== "two-hands");
export const TWO_HAND_SIGNS = SIGNS.filter(sign => sign.kind === "two-hands");
