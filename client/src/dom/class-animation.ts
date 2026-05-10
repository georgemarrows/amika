export type ClassAnimationAfterEventOptions = {
  eventTarget?: EventTarget | null;
  eventName: string;
  element: Element;
  className: string;
  fallbackMs: number;
  durationMs: number;
};

// Future improvement: make animations token-based per element/className so stale
// event or timeout callbacks cannot remove a newer animation's class.
export function runClassAnimationAfterEvent(options: ClassAnimationAfterEventOptions): () => void {
  const {
    eventTarget,
    eventName,
    element,
    className,
    fallbackMs,
    durationMs,
  } = options;

  if (!eventTarget) {
    return restartClassAnimation(element, className, durationMs);
  }

  const target = eventTarget;
  let isDone = false;
  let cancelAnimation = () => {};
  const timeout = window.setTimeout(finish, fallbackMs);

  function finish() {
    if (isDone) {
      return;
    }

    isDone = true;
    window.clearTimeout(timeout);
    target.removeEventListener(eventName, finish);
    cancelAnimation = restartClassAnimation(element, className, durationMs);
  }

  target.addEventListener(eventName, finish, { once: true });

  return () => {
    if (!isDone) {
      isDone = true;
      window.clearTimeout(timeout);
      target.removeEventListener(eventName, finish);
    }

    cancelAnimation();
  };
}

export function restartClassAnimation(element: Element, className: string, durationMs: number): () => void {
  element.classList.remove(className);
  void (element as HTMLElement).offsetWidth;
  element.classList.add(className);

  const timeout = window.setTimeout(() => element.classList.remove(className), durationMs);

  return () => {
    window.clearTimeout(timeout);
    element.classList.remove(className);
  };
}
