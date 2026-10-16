// Scroll can originate from the document or a nested scroller. Layout shifts,
// restored pages, and breakpoint changes also need a fresh measurement.
export function observeViewport(update: () => void, element: HTMLElement) {
  let frame: number | undefined;
  const schedule = () => {
    if (frame !== undefined) return;
    frame = requestAnimationFrame(() => {
      frame = undefined;
      update();
    });
  };
  document.addEventListener("scroll", schedule, { passive: true, capture: true });
  window.addEventListener("resize", schedule);
  window.addEventListener("pageshow", schedule);
  window.visualViewport?.addEventListener("resize", schedule);
  const resize = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(schedule);
  resize?.observe(element);
  resize?.observe(document.body);
  schedule();
  return () => {
    if (frame !== undefined) cancelAnimationFrame(frame);
    resize?.disconnect();
    document.removeEventListener("scroll", schedule, true);
    window.removeEventListener("resize", schedule);
    window.removeEventListener("pageshow", schedule);
    window.visualViewport?.removeEventListener("resize", schedule);
  };
}
