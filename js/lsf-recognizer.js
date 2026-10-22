import {
    HandLandmarker,
    FaceDetector,
    FilesetResolver,
    DrawingUtils
} from "../vendor/mediapipe/vision_bundle.mjs";

import {
    WASM_PATH, MODEL_PATH, FACE_MODEL_PATH, ANALYSIS_MAX_WIDTH, MAX_HANDS, PREFERRED_DELEGATE,
    HAND_DETECTION_CONFIDENCE, HAND_PRESENCE_CONFIDENCE, HAND_TRACKING_CONFIDENCE,
    FACE_DETECTION_CONFIDENCE, FACE_DETECTION_INTERVAL
} from "./config.js";
import { largestFace } from "./face.js";
import { SignRecognizer } from "./sign-recognizer.js";

// =======================================================================
//  RECONNAISSANCE : caméra + MediaPipe + dessin
// =======================================================================

// Moyenne glissante, pour que les durées affichées restent lisibles.
const smooth = (previous, value) => previous === 0 ? value : previous * 0.9 + value * 0.1;

export class LsfRecognizer {

    /**
     * @param options.delegate  "GPU" ou "CPU" (par défaut PREFERRED_DELEGATE de config.js)
     */
    constructor(videoElement, canvasElement, { delegate = PREFERRED_DELEGATE } = {}) {
        this.requestedDelegate = delegate.toUpperCase();
        this.delegates = { hand: null, face: null };   // delegate réellement obtenu pour chaque modèle
        this.stats = { handMs: 0, faceMs: 0, fps: 0 };
        this.fpsFrames = 0;
        this.fpsSince = performance.now();

        this.video = videoElement;
        this.canvas = canvasElement;
        this.ctx = this.canvas.getContext("2d");

        this.handLandmarker = null;
        this.faceDetector = null;
        this.drawingUtils = new DrawingUtils(this.ctx);
        this.lastVideoTime = -1;
        this.webcamRunning = false;
        this.signRecognizer = new SignRecognizer();

        this.face = null;
        this.frameCount = 0;

        // Taille de l'image analysée : celle de la caméra, voir fitToVideo().
        this.frame = { width: this.canvas.width, height: this.canvas.height };

        // Le flux est recopié dans ce canvas hors ecran avant d'etre analyse.
        this.analysisCanvas = document.createElement("canvas");
        this.analysisCtx = this.analysisCanvas.getContext("2d", { willReadFrequently: false });
    }

    // Crée un modèle MediaPipe sur le GPU si demandé, et retombe sur le CPU s'il échoue.
    async createTask(create) {
        if (this.requestedDelegate === "GPU") {
            try {
                return { task: await create("GPU"), delegate: "GPU" };
            } catch (error) {
                console.warn("GPU indisponible, repli sur le CPU :", error);
            }
        }
        return { task: await create("CPU"), delegate: "CPU" };
    }

    async init() {
        let vision;
        try {
            vision = await FilesetResolver.forVisionTasks(WASM_PATH);

            const hand = await this.createTask(delegate => HandLandmarker.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath: MODEL_PATH,
                    delegate
                },
                runningMode: "VIDEO",
                numHands: MAX_HANDS,
                minHandDetectionConfidence: HAND_DETECTION_CONFIDENCE,
                minHandPresenceConfidence: HAND_PRESENCE_CONFIDENCE,
                minTrackingConfidence: HAND_TRACKING_CONFIDENCE
            }));
            this.handLandmarker = hand.task;
            this.delegates.hand = hand.delegate;
            console.log(`LsfRecognizer : MediaPipe est prêt (mains : ${hand.delegate}) !`);
        } catch (error) {
            console.error("Erreur d'initialisation MediaPipe :", error);
            return false;
        }

        // Le visage est un plus : sans lui, les signes retombent sur la seule forme de la main.
        try {
            const face = await this.createTask(delegate => FaceDetector.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath: FACE_MODEL_PATH,
                    delegate
                },
                runningMode: "VIDEO",
                minDetectionConfidence: FACE_DETECTION_CONFIDENCE
            }));
            this.faceDetector = face.task;
            this.delegates.face = face.delegate;
        } catch (error) {
            console.warn("Détection du visage indisponible :", error);
        }
        return true;
    }

    // Retourne une Promise qui ne se résout qu'une fois la caméra réellement affichée
    // (frame décodée, dimensions connues). Les erreurs de getUserMedia sont propagées
    // à l'appelant, qui décide comment les afficher.
    async startWebcam() {
        // "ideal" et non "exact" : si la camera refuse on prend ce qu'elle donne (480p, 4:3...)
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } } });
        this.video.srcObject = stream;

        await new Promise((resolve) => this.video.addEventListener("loadeddata", resolve, { once: true }));
        await this.video.play();

        this.fitToVideo();
        this.webcamRunning = true;
    }

    stopWebcam() {
        this.webcamRunning = false;
        if (this.video.srcObject) {
            this.video.srcObject.getTracks().forEach(track => track.stop());
            this.video.srcObject = null;
        }
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.signRecognizer.reset();
        this.lastVideoTime = -1;
        this.face = null;
        this.stats = { handMs: 0, faceMs: 0, fps: 0 };
    }

    // Calque l'image analysée et l'overlay sur le format réel de la caméra.
    fitToVideo() {
        const scale = Math.min(1, ANALYSIS_MAX_WIDTH / this.video.videoWidth);
        this.frame = {
            width: Math.round(this.video.videoWidth * scale),
            height: Math.round(this.video.videoHeight * scale)
        };

        for (const canvas of [this.analysisCanvas, this.canvas]) {
            canvas.width = this.frame.width;
            canvas.height = this.frame.height;
        }
        // Après le redimensionnement : changer la taille d'un canvas réinitialise son contexte.
        this.analysisCtx.imageSmoothingQuality = "high";
    }

    /**
     * Analyse la frame courante et retourne { signs, handCount } : les signes reconnus
     * (objets du catalogue de signs.js) et le nombre de mains vues.
     * Retourne null si aucune nouvelle frame n'a été analysée (vidéo pas encore avancée).
     */
    update() {
        if (!this.webcamRunning || !this.handLandmarker || this.video.videoWidth === 0) return null;
        if (this.video.currentTime === this.lastVideoTime) return null;

        this.lastVideoTime = this.video.currentTime;
        const nowInMs = Math.round(this.video.currentTime * 1000);
        const { width, height } = this.frame;

        this.analysisCtx.drawImage(this.video, 0, 0, width, height);

        const handStart = performance.now();
        const results = this.handLandmarker.detectForVideo(this.analysisCanvas, nowInMs);
        this.stats.handMs = smooth(this.stats.handMs, performance.now() - handStart);
        this.updateFace(nowInMs);
        this.countFrame();

        // Fond = la frame qui vient d'etre analysee, et non l'element <video> en direct.
        // Sinon les landmarks, qui coutent le temps d'une inference, trainent derriere
        // une image qui a deja avance.
        this.ctx.drawImage(this.analysisCanvas, 0, 0, width, height);

        this.drawFaceOverlay();
        this.drawMediapipeHandsOverlay(results);

        const hands = results.landmarks || [];
        const signs = this.signRecognizer.update(hands, nowInMs, this.frame, this.face);
        return { signs, handCount: hands.length, hands: this.signRecognizer.hands, face: this.face };
    }

    // Images analysées par seconde, recalculées chaque seconde.
    countFrame() {
        this.fpsFrames++;
        const elapsed = performance.now() - this.fpsSince;
        if (elapsed >= 1000) {
            this.stats.fps = this.fpsFrames * 1000 / elapsed;
            this.fpsFrames = 0;
            this.fpsSince = performance.now();
        }
    }

    // Le visage bouge peu : on ne le détecte qu'une frame sur FACE_DETECTION_INTERVAL.
    updateFace(nowInMs) {
        if (!this.faceDetector) return;
        if (this.frameCount++ % FACE_DETECTION_INTERVAL !== 0) return;

        const faceStart = performance.now();
        const { detections } = this.faceDetector.detectForVideo(this.analysisCanvas, nowInMs);
        this.stats.faceMs = smooth(this.stats.faceMs, performance.now() - faceStart);
        this.face = largestFace(detections, this.frame);
    }

    drawFaceOverlay() {
        if (!this.face) return;
        const { box, parts } = this.face;

        this.ctx.strokeStyle = "#4da3ff";
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(box.originX, box.originY, box.width, box.height);

        this.ctx.fillStyle = "#4da3ff";
        for (const part of [parts.forehead, parts.chin, parts.mouth, parts.rightEar, parts.leftEar]) {
            this.ctx.beginPath();
            this.ctx.arc(part.x, part.y, 4, 0, 2 * Math.PI);
            this.ctx.fill();
        }
    }

    drawMediapipeHandsOverlay(results) {
        if (results.landmarks) {
            for (const landmarks of results.landmarks) {
                this.drawingUtils.drawConnectors(landmarks, HandLandmarker.HAND_CONNECTIONS, { color: "#00FF00", lineWidth: 3 });
                this.drawingUtils.drawLandmarks(landmarks, { color: "#FF0000", lineWidth: 1 });
            }
        }
    }
}
