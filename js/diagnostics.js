// =======================================================================
//  PANNEAU DE DIAGNOSTIC
//  Affiche ce que le programme "voit" de chaque main : état de chaque doigt, valeurs
//  brutes, distance au visage. Sert à comprendre pourquoi un signe n'est pas reconnu
//  et à régler les seuils de config.js.
// =======================================================================

const FINGERS = [
    ["thumb", "pouce"],
    ["index", "index"],
    ["middle", "majeur"],
    ["ring", "annulaire"],
    ["pinky", "auriculaire"]
];

const STATES = { extended: "tendu", curved: "courbé", folded: "plié" };
const FACE_PARTS = [["mouth", "bouche"], ["chin", "menton"], ["ear", "oreille"]];

const deg = value => `${Math.round(value)}°`;
const num = value => value.toFixed(2);

function describeHand(hand, index) {
    const { pipAngles, thumb } = hand.measures;
    const lines = [`Main ${index + 1}${hand.motion?.still ? " (immobile)" : ""}`];

    for (const [name, label] of FINGERS) {
        const detail = name === "thumb"
            ? `portée ${num(thumb.reach)} · sur les doigts ${num(thumb.overFingers)} · bout-index ${num(thumb.indexGap)} · angle ${deg(thumb.ipAngle)}`
            : `angle ${deg(pipAngles[name])}`;
        lines.push(`  ${label.padEnd(12)}${STATES[hand.fingers[name]].padEnd(8)}${detail}`);
    }

    lines.push(`  écart des doigts ${num(hand.spread)} · direction ${deg(hand.upAngle)} · pouce ${deg(hand.thumbAngle)}`);

    if (hand.face) {
        const distances = FACE_PARTS.map(([part, label]) => `${label} ${num(hand.faceDistance(part))}`);
        lines.push(`  bouts des doigts → ${distances.join(" · ")}  (en hauteurs de visage)`);
    }
    return lines;
}

export function formatDiagnostics(hands, face) {
    const lines = [face ? `Visage : détecté (${Math.round(face.size)} px de haut)` : "Visage : non détecté"];

    if (hands.length === 0) lines.push("Aucune main.");
    hands.forEach((hand, index) => lines.push("", ...describeHand(hand, index)));
    return lines.join("\n");
}
