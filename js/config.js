// =======================================================================
//  REGLAGES
// =======================================================================

// URLs absolues construites depuis ce module : le wasm et le modèle sont
// chargés correctement quelle que soit la page qui importe ce fichier.
export const WASM_PATH = new URL("../vendor/mediapipe/wasm", import.meta.url).href;
export const MODEL_PATH = new URL("../vendor/mediapipe/models/hand_landmarker.task", import.meta.url).href;
export const FACE_MODEL_PATH = new URL("../vendor/mediapipe/models/blaze_face_short_range.tflite", import.meta.url).href;

// -----------------------------------------------------------------------
//  Image analysée
//  Elle garde le format de la caméra (4:3 en 480p, 16:9 en 720p...) : l'étirer
//  déformerait les mains. Seules les sources plus larges que ce maximum sont réduites.
// -----------------------------------------------------------------------
export const ANALYSIS_MAX_WIDTH = 960;

// -----------------------------------------------------------------------
//  MediaPipe
// -----------------------------------------------------------------------
// "GPU" (WebGL) est en général bien plus rapide que "CPU" (WebAssembly). Si le GPU est
// indisponible, on retombe tout seul sur le CPU. Pour comparer : index.html?delegate=cpu
export const PREFERRED_DELEGATE = "GPU";

export const MAX_HANDS = 2;
// Seuils de confiance (0..1, défaut MediaPipe : 0.5). Baisser la détection aide à
// repérer des mains petites ou lointaines, au prix de quelques fausses mains.
export const HAND_DETECTION_CONFIDENCE = 0.3;
export const HAND_PRESENCE_CONFIDENCE = 0.5;
export const HAND_TRACKING_CONFIDENCE = 0.5;
export const FACE_DETECTION_CONFIDENCE = 0.5;
export const FACE_DETECTION_INTERVAL = 3;       // le visage bouge peu : détecté une frame sur 3

// -----------------------------------------------------------------------
//  Etat des doigts
//  Angle (en degrés) à l'articulation PIP : 180 = doigt parfaitement droit.
// -----------------------------------------------------------------------
export const FINGER_EXTENDED_MIN_ANGLE = 150;
export const FINGER_FOLDED_MAX_ANGLE = 110;

// Pouce : angle à l'articulation IP et "portée" (distance bout du pouce -> base
// de l'index, en tailles de paume).
export const THUMB_EXTENDED_MIN_ANGLE = 140;
export const THUMB_EXTENDED_MIN_REACH = 0.55;
export const THUMB_FOLDED_MAX_REACH = 0.45;
// Pouce rabattu sur les doigts (par ex. sur l'annulaire pour faire "deux") : son bout est
// tout près de l'articulation PIP du majeur, de l'annulaire ou de l'auriculaire.
export const THUMB_OVER_FINGERS_MAX_DISTANCE = 0.35;

// -----------------------------------------------------------------------
//  Formes de main (distances en tailles de paume)
// -----------------------------------------------------------------------
// Rapport (écart des bouts index-auriculaire) / (écart des bases index-auriculaire)
export const FINGERS_TOGETHER_MAX_SPREAD = 1.25;
export const FINGERS_APART_MIN_SPREAD = 1.45;

export const PINCH_MAX_DISTANCE = 0.3;          // "OK" : pouce et index qui se touchent
export const BUNCH_MAX_MEAN_DISTANCE = 0.4;     // "Manger" : les 4 bouts de doigts sur le pouce
export const BUNCH_MAX_DISTANCE = 0.5;
export const FLAT_EAT_MAX_FACE_DISTANCE = 0.4;  // "Manger", doigts joints à plat : bouts des doigts sur la bouche
export const C_SHAPE_MIN_THUMB_GAP = 0.3;       // "Boire" : ouverture de la main en C
export const C_SHAPE_MAX_THUMB_GAP = 1.3;
export const C_SHAPE_MIN_FINGER_ANGLE = 55;     // "Boire" : doigts arrondis, mais pas un poing serré (~30-45°)
export const C_SHAPE_MAX_FINGER_ANGLE = 150;
export const UPRIGHT_MAX_ANGLE = 50;            // doigts "vers le haut" (degrés)
export const THUMB_VERTICAL_MAX_ANGLE = 50;     // pouce levé / baissé (degrés)

// "Attends" : la main doit être immobile (déplacement max, en paumes, sur la fenêtre)
export const STILL_WINDOW_MS = 500;
export const STILL_MAX_RANGE = 0.35;

// -----------------------------------------------------------------------
//  Position par rapport au visage (distances en hauteurs de visage)
// -----------------------------------------------------------------------
export const NEAR_FACE_MAX_DISTANCE = 0.7;      // bouts des doigts près du menton ou de la bouche
export const NEAR_FACE_LOOSE_DISTANCE = 0.9;    // centre de la main près de la bouche ou de l'oreille

// -----------------------------------------------------------------------
//  Deux mains
// -----------------------------------------------------------------------
export const ROOF_MIN_HANDS_DISTANCE = 1.8;     // "Maison" : poignets écartés...
export const ROOF_MAX_TIPS_DISTANCE = 0.7;      // ... bouts des doigts qui se touchent
export const WHEEL_MIN_DISTANCE = 1.5;          // "Voiture" : deux poings écartés
export const WHEEL_MAX_DISTANCE = 6;
export const WHEEL_MAX_HEIGHT_GAP = 0.8;

// -----------------------------------------------------------------------
//  Suivi et lissage
// -----------------------------------------------------------------------
export const MAX_TRACK_JUMP = 3;                // déplacement max d'une main entre 2 frames (paumes)
export const TRACK_LOST_MS = 400;
export const SMOOTHING_FRAMES = 5;              // un signe doit être vu 3 frames sur 5
export const SMOOTHING_MIN_VOTES = 3;
export const HOLD_MS = 400;                     // un signe reste affiché un court instant
