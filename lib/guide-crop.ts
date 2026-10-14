export type Rect = { left: number; top: number; width: number; height: number };

/**
 * Map the on-screen card guide onto the camera frame, so the photo we send is the card
 * (plus a small margin) rather than the whole frame. The video is drawn with
 * object-fit: contain inside `element`. Returns null if the guide misses the frame.
 */
export function guideCropRect(
  video: { width: number; height: number },
  element: Rect,
  guide: Rect,
  margin = 0.08,
): Rect | null {
  if (video.width <= 0 || video.height <= 0 || element.width <= 0 || element.height <= 0) return null;
  const scale = Math.min(element.width / video.width, element.height / video.height);
  const shownLeft = element.left + (element.width - video.width * scale) / 2;
  const shownTop = element.top + (element.height - video.height * scale) / 2;

  const padX = guide.width * margin;
  const padY = guide.height * margin;
  const x0 = Math.max(0, (guide.left - padX - shownLeft) / scale);
  const y0 = Math.max(0, (guide.top - padY - shownTop) / scale);
  const x1 = Math.min(video.width, (guide.left + guide.width + padX - shownLeft) / scale);
  const y1 = Math.min(video.height, (guide.top + guide.height + padY - shownTop) / scale);
  if (x1 - x0 < 40 || y1 - y0 < 40) return null;
  return {
    left: Math.round(x0),
    top: Math.round(y0),
    width: Math.round(x1 - x0),
    height: Math.round(y1 - y0),
  };
}
