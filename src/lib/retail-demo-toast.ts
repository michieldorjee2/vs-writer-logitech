/**
 * retail-demo-toast — lightweight one-shot toast used to acknowledge
 * realistic e-commerce interactions (Add to bag, View order, Reserve…)
 * during the showcase demo. No real cart, no real persistence — the
 * toast surfaces "demo only" energy so visitors understand the
 * interaction is fake.
 *
 * Stateless: the toast lives in a singleton DOM node we lazily mount
 * under document.body so it can be triggered from any component without
 * needing a portal or context provider. Multiple rapid clicks queue
 * and display sequentially.
 */

const TOAST_ID = 'retail-demo-toast';
let queue: Array<{ message: string; tone: 'default' | 'success' | 'note' }> = [];
let showing = false;

function ensureNode(): HTMLDivElement | null {
  if (typeof document === 'undefined') return null;
  let node = document.getElementById(TOAST_ID) as HTMLDivElement | null;
  if (node) return node;
  node = document.createElement('div');
  node.id = TOAST_ID;
  node.className = 'retail-demo-toast';
  node.setAttribute('role', 'status');
  node.setAttribute('aria-live', 'polite');
  document.body.appendChild(node);
  return node;
}

function pump(): void {
  if (showing) return;
  const next = queue.shift();
  if (!next) return;
  const node = ensureNode();
  if (!node) return;
  showing = true;
  node.classList.remove('is-success', 'is-note');
  if (next.tone === 'success') node.classList.add('is-success');
  if (next.tone === 'note') node.classList.add('is-note');
  node.innerHTML = `
    <span class="retail-demo-toast__pill">Demo only</span>
    <span class="retail-demo-toast__msg"></span>
  `;
  const msgEl = node.querySelector('.retail-demo-toast__msg');
  if (msgEl) msgEl.textContent = next.message;
  // force reflow then add visible class
  void node.offsetWidth;
  node.classList.add('is-visible');
  window.setTimeout(() => {
    node.classList.remove('is-visible');
    window.setTimeout(() => {
      showing = false;
      pump();
    }, 350);
  }, 2400);
}

/** Show a toast acknowledging a demo action. */
export function demoToast(message: string, tone: 'default' | 'success' | 'note' = 'default'): void {
  queue.push({ message, tone });
  pump();
}
