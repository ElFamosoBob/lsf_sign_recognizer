import { LsfRecognizer } from "./lsf-recognizer.js";
import { SIGNS } from "./signs.js";
import { SignList } from "./sign-list.js";
import { formatDiagnostics } from "./diagnostics.js";

const videoView = document.getElementById("video-view");
const signBox = document.getElementById("lsf-sign-box");
const button = document.getElementById("btn-webcam");
const status = document.getElementById("status");
const stats = document.getElementById("stats");
const diagnostics = document.getElementById("diagnostics");
const diagnosticsOutput = document.getElementById("diagnostics-output");
const copyButton = document.getElementById("btn-copy");
const copyDelayedButton = document.getElementById("btn-copy-delayed");
const copyFeedback = document.getElementById("copy-feedback");

const COPY_DELAY_SECONDS = 3;

// index.html?delegate=cpu force le CPU, pour comparer avec le GPU.
const requestedDelegate = new URLSearchParams(location.search).get("delegate") ?? undefined;

const recognizer = new LsfRecognizer(
    document.getElementById("webcam"),
    document.getElementById("mp_canvas"),
    { delegate: requestedDelegate }
);
const signList = new SignList(document.getElementById("sign-list"), SIGNS);

function showError(message) {
    status.textContent = message;
    status.classList.add("error");
}

function showIdle(message) {
    signBox.classList.remove("detecting");
    signBox.textContent = message;
    signList.highlight([]);
}

function showResult({ signs, handCount }) {
    if (signs.length > 0) {
        signBox.classList.add("detecting");
        signBox.textContent = signs.map(sign => sign.label).join(" + ");
        signList.highlight(signs);
    } else {
        showIdle(handCount > 0 ? "Aucun signe clair." : "Aucune main détectée.");
    }
}

let lastStatsUpdate = 0;

function showStats() {
    const { handMs, faceMs, fps } = recognizer.stats;
    const { hand, face } = recognizer.delegates;
    const delegates = face && face !== hand ? `mains ${hand}, visage ${face}` : hand;
    stats.textContent = `${delegates} · ${fps.toFixed(0)} images/s · mains ${handMs.toFixed(0)} ms` +
        (faceMs > 0 ? ` · visage ${faceMs.toFixed(0)} ms` : "");
}

// Texte du panneau de diagnostic : signes reconnus, performances, puis détail de chaque main.
let lastResult = null;

// Figé tant que l'utilisateur doit copier à la main : sinon le panneau, réécrit à chaque
// image, ferait disparaître la sélection.
let reportFrozen = false;
const FREEZE_MAX_MS = 20000;

function buildReport() {
    if (!lastResult) return "Caméra éteinte";
    const signs = lastResult.signs.map(sign => sign.label).join(" + ") || "aucun";
    return [
        `Signe(s) : ${signs}`,
        `${stats.textContent} · image ${recognizer.frame.width}×${recognizer.frame.height}`,
        formatDiagnostics(lastResult.hands, lastResult.face)
    ].join("\n");
}

function loop() {
    if (!recognizer.webcamRunning) return;
    const result = recognizer.update();
    if (result) {
        lastResult = result;
        showResult(result);
        if (diagnostics.open && !reportFrozen) diagnosticsOutput.textContent = buildReport();

        const now = performance.now();
        if (now - lastStatsUpdate > 500) {
            showStats();
            lastStatsUpdate = now;
        }
    }
    requestAnimationFrame(loop);
}

// Copie le rapport dans le presse-papiers. Si le navigateur refuse, on le sélectionne
// pour que Ctrl+C suffise.
async function copyReport() {
    reportFrozen = false;
    const text = buildReport();
    diagnosticsOutput.textContent = text;
    try {
        await navigator.clipboard.writeText(text);
        copyFeedback.textContent = "Copié !";
    } catch {
        reportFrozen = true;
        setTimeout(() => { reportFrozen = false; }, FREEZE_MAX_MS);
        getSelection().selectAllChildren(diagnosticsOutput);
        copyFeedback.textContent = "Copie refusée : le texte est sélectionné et figé, faites Ctrl+C.";
    }
}

// Le Ctrl+C manuel est fait : le panneau reprend sa mise à jour.
document.addEventListener("copy", () => { reportFrozen = false; });

copyButton.addEventListener("click", copyReport);

// Laisse le temps de reprendre la pose (les mains sont déjà occupées, pas la souris).
copyDelayedButton.addEventListener("click", () => {
    copyButton.disabled = copyDelayedButton.disabled = true;
    let remaining = COPY_DELAY_SECONDS;
    copyFeedback.textContent = `Copie dans ${remaining} s…`;

    const timer = setInterval(async () => {
        remaining--;
        if (remaining > 0) {
            copyFeedback.textContent = `Copie dans ${remaining} s…`;
            return;
        }
        clearInterval(timer);
        await copyReport();
        copyButton.disabled = copyDelayedButton.disabled = false;
    }, 1000);
});

button.addEventListener("click", async () => {
    if (recognizer.webcamRunning) {
        recognizer.stopWebcam();
        showIdle("Caméra éteinte");
        stats.textContent = "";
        lastResult = null;
        diagnosticsOutput.textContent = "";
        button.textContent = "Allumer la caméra";
        return;
    }

    button.disabled = true;
    status.textContent = "";
    status.classList.remove("error");
    try {
        await recognizer.startWebcam();
        // Le cadre prend le format réel de la caméra (4:3, 16:9...) : rien n'est étiré.
        videoView.style.setProperty("--video-aspect", `${recognizer.frame.width} / ${recognizer.frame.height}`);
        button.textContent = "Éteindre la caméra";
        requestAnimationFrame(loop);
    } catch (err) {
        if (err.name === "NotAllowedError") {
            showError("Accès refusé. Autorisez la caméra dans votre navigateur.");
        } else if (err.name === "NotFoundError") {
            showError("Aucune caméra détectée.");
        } else if (err.name === "NotReadableError") {
            showError("Caméra indisponible (déjà utilisée par une autre application).");
        } else {
            showError(`Erreur caméra : ${err.message}`);
        }
    } finally {
        button.disabled = false;
    }
});

if (await recognizer.init()) {
    button.textContent = "Allumer la caméra";
    button.disabled = false;
} else {
    button.textContent = "Modèle indisponible";
    showError("Impossible de charger MediaPipe (voir la console).");
}
