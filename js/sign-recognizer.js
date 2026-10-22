import {
    MAX_TRACK_JUMP, TRACK_LOST_MS,
    SMOOTHING_FRAMES, SMOOTHING_MIN_VOTES, HOLD_MS
} from "./config.js";
import { distance2D } from "./geometry.js";
import { faceDistance } from "./face.js";
import { computeHandFeatures } from "./hand-features.js";
import { MotionHistory } from "./motion.js";
import { ONE_HAND_SIGNS, TWO_HAND_SIGNS } from "./signs.js";

// =======================================================================
//  RECONNAISSANCE DES SIGNES
//  Suit chaque main d'une image à l'autre (pour mesurer son mouvement),
//  cherche le signe correspondant, puis lisse le résultat pour éviter le clignotement.
// =======================================================================

export class SignRecognizer {

    constructor() {
        this.reset();
    }

    reset() {
        this.tracks = [];
        this.nextTrackId = 1;
        this.hands = [];            // mains analysées sur la dernière frame (pour le diagnostic)
    }

    /**
     * @param landmarks  liste de mains, chacune = 21 landmarks MediaPipe
     * @param timeMs     horodatage croissant de la frame
     * @param frame      { width, height } de l'image analysée
     * @param face       visage détecté (voir face.js), ou null
     * @returns les signes reconnus (objets du catalogue), sans doublon
     */
    update(landmarks, timeMs, frame, face = null) {
        const hands = landmarks.map(points => computeHandFeatures(points, frame)).filter(Boolean);
        const seen = this.assignTracks(hands, timeMs);
        this.hands = hands;

        for (const { track, hand } of seen) {
            if (face) {
                hand.face = face;
                // Par défaut, on situe les bouts des doigts : c'est ce qui "désigne" le visage.
                hand.faceDistance = (part, point = hand.tipsCenter) => faceDistance(face, part, point);
            }
            track.motion.push(timeMs, hand);
            hand.motion = track.motion.analyse();
        }

        const { candidates, suppressed } = this.findCandidates(seen);

        for (const { track } of seen) {
            if (suppressed.has(track)) {
                // Cette main fait partie d'un signe à deux mains, attribué à l'autre.
                track.votes = [];
                track.output = null;
            } else {
                this.vote(track, candidates.get(track), timeMs);
            }
        }

        const signs = [];
        for (const track of this.tracks) {
            if (track.output && timeMs > track.outputUntil) track.output = null;
            if (track.output && !signs.includes(track.output)) signs.push(track.output);
        }
        return signs;
    }

    // Associe chaque main détectée à la main suivie la plus proche.
    assignTracks(hands, timeMs) {
        this.tracks = this.tracks.filter(track => timeMs - track.lastSeen <= TRACK_LOST_MS);

        const free = [...this.tracks];
        const seen = [];
        for (const hand of hands) {
            let best = null;
            let bestDistance = MAX_TRACK_JUMP * hand.palm;
            for (const track of free) {
                const gap = distance2D(track.center, hand.center);
                if (gap < bestDistance) { best = track; bestDistance = gap; }
            }

            if (best) {
                free.splice(free.indexOf(best), 1);
            } else {
                best = { id: this.nextTrackId++, motion: new MotionHistory(), votes: [], output: null, outputUntil: 0 };
                this.tracks.push(best);
            }
            best.center = hand.center;
            best.lastSeen = timeMs;
            seen.push({ track: best, hand });
        }
        return seen;
    }

    // Un signe à deux mains prime sur les signes d'une seule main.
    findCandidates(seen) {
        const candidates = new Map();
        const suppressed = new Set();

        if (seen.length === 2) {
            const [a, b] = seen;
            const pairSign = TWO_HAND_SIGNS.find(sign => sign.match(a.hand, b.hand));
            if (pairSign) {
                candidates.set(a.track, pairSign);
                suppressed.add(b.track);
                return { candidates, suppressed };
            }
        }

        for (const { track, hand } of seen) {
            candidates.set(track, ONE_HAND_SIGNS.find(sign => sign.match(hand)) ?? null);
        }
        return { candidates, suppressed };
    }

    // Un signe n'est retenu que s'il est vu plusieurs fois parmi les dernières frames,
    // puis il reste affiché un court instant.
    vote(track, sign, timeMs) {
        track.votes.push(sign);
        if (track.votes.length > SMOOTHING_FRAMES) track.votes.shift();

        const counts = new Map();
        for (const vote of track.votes) {
            if (vote) counts.set(vote, (counts.get(vote) ?? 0) + 1);
        }

        let winner = null;
        let winnerCount = SMOOTHING_MIN_VOTES - 1;
        for (const [candidate, count] of counts) {
            if (count > winnerCount) { winner = candidate; winnerCount = count; }
        }

        if (winner) {
            track.output = winner;
            track.outputUntil = timeMs + HOLD_MS;
        }
    }
}
