// =======================================================================
//  GEOMETRIE
//  MediaPipe renvoie des coordonnées normalisées (0..1) : x et y n'ont donc pas la
//  même unité sur une image non carrée. On les convertit en pixels de l'image
//  analysée, `frame` = { width, height } (z a la même échelle que x).
// =======================================================================

export function toPixels(landmarks, frame) {
    return landmarks.map(p => ({
        x: p.x * frame.width,
        y: p.y * frame.height,
        z: (p.z || 0) * frame.width
    }));
}

export function distance(p1, p2) {
    return Math.hypot(p1.x - p2.x, p1.y - p2.y, (p1.z || 0) - (p2.z || 0));
}

export function distance2D(p1, p2) {
    return Math.hypot(p1.x - p2.x, p1.y - p2.y);
}

export function mean(points) {
    const n = points.length;
    return {
        x: points.reduce((sum, p) => sum + p.x, 0) / n,
        y: points.reduce((sum, p) => sum + p.y, 0) / n
    };
}

// Angle (en degrés) en `vertex` entre les segments vertex->a et vertex->b.
export function angleAt(vertex, a, b) {
    const ax = a.x - vertex.x, ay = a.y - vertex.y, az = (a.z || 0) - (vertex.z || 0);
    const bx = b.x - vertex.x, by = b.y - vertex.y, bz = (b.z || 0) - (vertex.z || 0);
    const norm = Math.hypot(ax, ay, az) * Math.hypot(bx, by, bz);
    if (norm === 0) return 180;
    const cos = Math.max(-1, Math.min(1, (ax * bx + ay * by + az * bz) / norm));
    return Math.acos(cos) * 180 / Math.PI;
}

// Direction de `from` vers `to` dans l'image, en degrés : 0 = vers le haut,
// 90 = vers la droite, 180 (ou -180) = vers le bas.
export function angleFromUp(from, to) {
    return Math.atan2(to.x - from.x, -(to.y - from.y)) * 180 / Math.PI;
}
