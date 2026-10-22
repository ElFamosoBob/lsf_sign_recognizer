import { STILL_WINDOW_MS, STILL_MAX_RANGE } from "./config.js";

// =======================================================================
//  IMMOBILITÉ D'UNE MAIN
//  Seul "Attends / Stop" en a besoin. Les signes en mouvement (oui, non, au revoir...)
//  ont été retirés : la détection n'était pas assez fluide pour les suivre.
// =======================================================================

const range = values => Math.max(...values) - Math.min(...values);
const average = values => values.reduce((s, v) => s + v, 0) / values.length;

export class MotionHistory {
    constructor() {
        this.samples = [];
    }

    push(timeMs, hand) {
        this.samples.push({ t: timeMs, palm: hand.palm, center: hand.center });
        while (this.samples.length > 0 && this.samples[0].t < timeMs - STILL_WINDOW_MS) {
            this.samples.shift();
        }
    }

    // still : la main a à peine bougé (en tailles de paume) pendant la fenêtre
    analyse() {
        const s = this.samples;
        if (s.length < 3) return { still: false };

        const palm = average(s.map(p => p.palm));
        return {
            still: range(s.map(p => p.center.x / palm)) < STILL_MAX_RANGE &&
                range(s.map(p => p.center.y / palm)) < STILL_MAX_RANGE
        };
    }
}
