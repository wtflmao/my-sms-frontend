<!-- src/lib/components/TurnstileWidget.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { PUBLIC_TURNSTILE_SITE_KEY } from '$env/static/public';

  export let onToken: (token: string) => void;
  export let onExpired: () => void = () => {};
  export let onError: () => void = () => {};

  let turnstileContainer: HTMLElement;
  let widgetId: string | null = null;

  onMount(() => {
    if (typeof window !== 'undefined' && window.turnstile) {
      widgetId = window.turnstile.render(turnstileContainer, {
        sitekey: PUBLIC_TURNSTILE_SITE_KEY,
        callback: function(token: string) {
          console.log('Turnstile token received:', token);
          onToken(token);
        },
        'expired-callback': function() {
          console.log('Turnstile token expired');
          widgetId = null; // Allow re-rendering or reset
          onExpired();
        },
        'error-callback': function() {
          console.error('Turnstile error');
          widgetId = null;
          onError();
        },
        // theme: 'light', // or 'dark', or 'auto'
        // language: 'en', // or 'auto'
      });
    } else {
      console.error('Turnstile script not loaded or window.turnstile not available.');
      onError(); // Notify parent of an issue
    }

    return () => {
      if (widgetId && window.turnstile) {
        window.turnstile.remove(widgetId);
      }
    };
  });

  export function reset() {
    if (widgetId && window.turnstile) {
      window.turnstile.reset(widgetId);
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