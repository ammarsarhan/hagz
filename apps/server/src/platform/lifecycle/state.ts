// Set as soon as shutdown starts, so readiness fails while in-flight work drains.
let shuttingDown = false;

export const markShuttingDown = () => {
  shuttingDown = true;
};

export const isShuttingDown = () => shuttingDown;
