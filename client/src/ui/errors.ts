/** Recoverable error surface: the app never dies on a failed API call. */

export function buildErrorHtml(message: string, retryable: boolean): string {
  const retry = retryable ? '<button id="error-retry" type="button">Try again</button>' : "";
  return `
    <div id="error-panel" class="panel error-panel" role="alert">
      <h2>Something went wrong</h2>
      <p class="error-message">${message
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")}</p>
      <p class="error-actions">${retry}<button id="error-back" type="button">Back to start</button></p>
    </div>`;
}

export interface ErrorPanel {
  root: HTMLElement;
}

export function mountErrorPanel(
  root: HTMLElement,
  message: string,
  handlers: { onRetry?: () => void; onBack?: () => void } = {},
): ErrorPanel {
  const element = document.createElement("div");
  element.innerHTML = buildErrorHtml(message, Boolean(handlers.onRetry));
  const panel = element.firstElementChild as HTMLElement;
  root.appendChild(panel);

  const retry = panel.querySelector<HTMLButtonElement>("#error-retry");
  if (retry && handlers.onRetry) {
    retry.addEventListener("click", () => handlers.onRetry?.());
  }
  const back = panel.querySelector<HTMLButtonElement>("#error-back");
  if (back && handlers.onBack) {
    back.addEventListener("click", () => handlers.onBack?.());
  }
  return { root: panel };
}

/** Human readable message for an unknown thrown value. */
export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "unexpected error";
}
