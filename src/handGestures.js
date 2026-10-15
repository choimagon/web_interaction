const clamp = (value) => Math.max(0, Math.min(1, value));

// Use camera pixels rather than normalized coordinates so the aspect ratio
// does not change joint angles. Distances are relative to the hand size.
export function readHandGesture(landmarks, aspect = 4 / 3) {
  if (!landmarks || landmarks.length !== 21) return { gesture: 'none' };
  const points = landmarks.map(({ x, y }) => ({ x: x * aspect, y }));
  const distance = (a, b) => Math.hypot(points[a].x - points[b].x, points[a].y - points[b].y);
  function straight(base, joint, tip) {
    const a = { x: points[base].x - points[joint].x, y: points[base].y - points[joint].y };
    const b = { x: points[tip].x - points[joint].x, y: points[tip].y - points[joint].y };
    const length = Math.hypot(a.x, a.y) * Math.hypot(b.x, b.y);
    return length > 0 && (a.x * b.x + a.y * b.y) / length < -0.78;
  }
  const extended = [5, 9, 13, 17].map((base) =>
    straight(base, base + 1, base + 3) && distance(0, base + 3) > distance(0, base + 1) * 1.12);
  const thumbOpen = straight(2, 3, 4) && distance(4, 5) > distance(5, 17) * 0.45;
  if (extended.every(Boolean) && thumbOpen) return { gesture: 'palm' };
  if (extended[0] && extended.slice(1).every((finger) => !finger)) {
    // The preview is mirrored, so the pointer must be mirrored too.
    return { gesture: 'point', x: clamp(1 - landmarks[8].x), y: clamp(landmarks[8].y) };
  }
  return { gesture: 'idle' };
}

export const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15],
  [15, 16], [13, 17], [0, 17], [17, 18], [18, 19], [19, 20],
];
