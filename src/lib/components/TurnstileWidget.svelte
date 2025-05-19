<!-- src/lib/components/TurnstileWidget.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { PUBLIC_TURNSTILE_SITE_KEY } from '$env/static/public';

  export let onToken: (token: string) => void;
  export let onExpired: () => void = () => {};
  export let onError: () => void = () => {};

  let turnstileContainer: HTMLElement;
  let widgetId: string | null = null;

  // Add dynamic script loader to ensure Turnstile API is loaded
  function loadTurnstileScript(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined') {
        return reject(new Error('window not available'));
      }
      if ((window as any).turnstile) {
        return resolve();
      }
      const src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
      let script = document.querySelector(`script[src="${src}"]`) as HTMLScriptElement | null;
      if (!script) {
        script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.defer = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Turnstile script failed to load'));
        document.head.appendChild(script);
      } else {
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Turnstile script failed to load'));
      }
    });
  }

  // Replace onMount logic to wait for script
  onMount(() => {
    let cancelled = false;
    loadTurnstileScript()
      .then(() => {
        if (cancelled || !(window as any).turnstile) return;
        widgetId = (window as any).turnstile.render(turnstileContainer, {
          sitekey: PUBLIC_TURNSTILE_SITE_KEY,
          callback: (token: string) => {
            console.log('Turnstile token received:', token);
            onToken(token);
          },
          'expired-callback': () => {
            console.log('Turnstile token expired');
            widgetId = null;
            onExpired();
          },
          'error-callback': () => {
            console.error('Turnstile error');
            widgetId = null;
            onError();
          },
        });
      })
      .catch((err) => {
        console.error('Turnstile script failed to load or window.turnstile not available.', err);
        onError();
      });

    return () => {
      cancelled = true;
      if (widgetId && (window as any).turnstile) {
        (window as any).turnstile.remove(widgetId);
      }
    };
  });

  export function reset() {
    if (widgetId && (window as any).turnstile) {
      (window as any).turnstile.reset(widgetId);
    }
  }
</script>

<div bind:this={turnstileContainer}></div>

<style>
  /* Optional: Add any specific styling for the container if needed */
  div {
    min-height: 65px; /* Default height of the Turnstile widget */
    min-width: 300px; /* Default width of the Turnstile widget */
  }
</style> 