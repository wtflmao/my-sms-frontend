<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import TurnstileWidget from '$lib/components/TurnstileWidget.svelte';
  import { 
    smsMessages, 
    isLoading, 
    error, 
    isTurnstileVerified, 
    isAutoRefreshPaused, 
    lastSuccessfulData 
  } from '$lib/stores/smsStore';
  import type { SMSEntry } from '../../../my-sms-forwarder/src/types'; // Adjust path if needed

  const AUTO_REFRESH_INTERVAL_MS = 5000;
  let autoRefreshTimer: any = null;
  let turnstileWidgetRef: TurnstileWidget;

  async function verifyTurnstileToken(token: string) {
    $isLoading = true;
    $error = null;
    try {
      const response = await fetch('/api/verify-captcha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({ message: 'Failed to verify Turnstile. HTTP ' + response.status }));
        throw new Error(errData.error || errData.message || 'Failed to verify Turnstile token');
      }
      $isTurnstileVerified = true;
      $isAutoRefreshPaused = false; // Reset pause state on successful verification
      await fetchMessages(); // Fetch messages immediately after verification
      startAutoRefresh();
    } catch (e: any) {
      console.error('Turnstile verification error:', e);
      $error = e.message || 'An error occurred during Turnstile verification.';
      $isTurnstileVerified = false;
    } finally {
      $isLoading = false;
    }
  }

  async function fetchMessages(isManualRefresh = false) {
    if (!$isTurnstileVerified && !isManualRefresh) return;
    if (isManualRefresh) {
        $isAutoRefreshPaused = false; // Reset pause state if manual refresh is initiated
        // Potentially re-trigger Turnstile if needed, for now assume JWT is the primary gate for /api/sms
        // If JWT is expired, the API call will fail, and auto-refresh will pause.
        // A manual refresh when paused SHOULD re-trigger Turnstile if JWT is the issue.
        // For now, manual refresh re-verifies Turnstile to get a new JWT
        if ($isAutoRefreshPaused && turnstileWidgetRef) {
            turnstileWidgetRef.reset(); // This will trigger onToken again
            return; // Verification flow will handle fetching messages
        }
    }

    $isLoading = true;
    // $error = null; // Don't clear previous error on auto-refresh, only on manual or new verification

    try {
      const response = await fetch('/api/sms');
      
      if (response.status === 204) { // Cooldown: No new data
        // smsMessages store remains unchanged, UI shows lastSuccessfulData implicitly
        console.log('Cooldown active or no new messages.');
        // No need to update lastSuccessfulData if it's a cooldown response as nothing changed
        return; 
      }

      if (!response.ok) {
        if (response.status === 401) { // Unauthorized - JWT likely expired
          $isAutoRefreshPaused = true;
          $error = 'Session expired. Please manually refresh to re-authenticate.';
          stopAutoRefresh();
        } else {
          const errData = await response.json().catch(() => ({ message: 'Failed to fetch messages. HTTP ' + response.status }));
          throw new Error(errData.error || errData.message || 'Failed to fetch messages');
        }
        return; // Stop further processing if not ok
      }

      const data = await response.json() as SMSEntry[];
      $smsMessages = data;
      $lastSuccessfulData = data; // Update last successful data
      $error = null; // Clear error on successful fetch

    } catch (e: any) {
      console.error('Error fetching messages:', e);
      if (!$isAutoRefreshPaused) { // Don't overwrite session expired message
        $error = e.message || 'An error occurred while fetching messages.';
      }
      // Decide if we should stop auto-refresh on general errors other than 401
      // For now, let it continue, but display the error.
    } finally {
      $isLoading = false;
    }
  }

  function startAutoRefresh() {
    stopAutoRefresh(); // Clear any existing timer
    if ($isTurnstileVerified && !$isAutoRefreshPaused) {
      autoRefreshTimer = setInterval(() => {
        fetchMessages();
      }, AUTO_REFRESH_INTERVAL_MS);
      console.log('Auto-refresh started.');
    }
  }

  function stopAutoRefresh() {
    if (autoRefreshTimer) {
      clearInterval(autoRefreshTimer);
      autoRefreshTimer = null;
      console.log('Auto-refresh stopped.');
    }
  }

  function handleManualRefresh() {
    console.log('Manual refresh triggered.');
    if ($isAutoRefreshPaused || !$isTurnstileVerified) { // If paused (likely JWT issue) or never verified, re-verify Turnstile
        if (turnstileWidgetRef) {
            $error = null; // Clear previous errors for new verification attempt
            turnstileWidgetRef.reset(); // This will trigger onToken -> verifyTurnstileToken -> fetchMessages
        } else {
            // This case should ideally not happen if Turnstile is always present when needed
            console.error("Turnstile widget reference not available for reset.");
            // Fallback or direct attempt to fetch, which might fail if JWT is needed and expired.
            // For now, we primarily rely on Turnstile reset.
        }
    } else {
        fetchMessages(true); // Fetch immediately, not necessarily re-verifying Turnstile if already verified and not paused
    }
  }
  
  function handleTurnstileError() {
    $error = "Turnstile challenge failed to load or encountered an error. Please try refreshing the page.";
    $isTurnstileVerified = false;
    stopAutoRefresh();
  }

  onMount(() => {
    // Initial state: if already verified (e.g. navigating back), try starting refresh
    if ($isTurnstileVerified && !$isAutoRefreshPaused) {
      fetchMessages(); // Fetch initial data if already verified
      startAutoRefresh();
    }
    // else, wait for Turnstile verification
    return () => {
      stopAutoRefresh(); // Cleanup timer on component destroy
    };
  });

  onDestroy(stopAutoRefresh);

</script>

<div class="container mx-auto p-4 max-w-2xl">
  <header class="mb-8 text-center">
    <h1 class="text-4xl font-bold text-gray-800">SMS Message Viewer</h1>
    <p class="text-gray-600">Received messages are displayed below.</p>
  </header>

  {#if !$isTurnstileVerified}
    <div class="turnstile-container bg-gray-100 p-6 rounded-lg shadow-md text-center">
      <h2 class="text-xl font-semibold mb-4 text-gray-700">Please verify you are human</h2>
      <TurnstileWidget 
        bind:this={turnstileWidgetRef} 
        onToken={verifyTurnstileToken} 
        onError={handleTurnstileError}
        onExpired={() => {
          $error = 'Verification challenge expired. Please try again.';
          $isTurnstileVerified = false; 
        }}
      />
    </div>
  {/if}

  {#if $error && $isTurnstileVerified} <!-- Show error only if Turnstile passed but something else went wrong -->
    <div class="my-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-md" role="alert">
      <strong class="font-bold">Error:</strong>
      <span class="block sm:inline">{$error}</span>
    </div>
  {:else if $error && !$isTurnstileVerified} <!-- Show Turnstile specific errors when it hasn't passed -->
     <div class="my-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-md" role="alert">
      <strong class="font-bold">Verification Error:</strong>
      <span class="block sm:inline">{$error}</span>
    </div>
  {/if}

  {#if $isTurnstileVerified}
    <div class="controls my-6 text-center">
      <button 
        on:click={handleManualRefresh} 
        class="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition duration-150 ease-in-out disabled:opacity-50"
        disabled={$isLoading && !$isAutoRefreshPaused} <!-- Disable if loading, unless it's paused (then manual refresh is important) -->
      >
        {#if $isLoading && !$isAutoRefreshPaused}Loading...{:else}Manually Refresh Messages{/if}
      </button>
      {#if $isAutoRefreshPaused}
        <p class="text-sm text-yellow-600 mt-2">Auto-refresh is paused. Click manual refresh to re-authenticate.</p>
      {/if}
    </div>

    <div class="message-list space-y-4">
      {#if $isLoading && $smsMessages.length === 0 && !$lastSuccessfulData.length}
        <p class="text-center text-gray-500">Loading messages...</p>
      {:else if ($smsMessages.length === 0 && $lastSuccessfulData.length === 0)}
        <div class="bg-white p-6 rounded-lg shadow text-center">
            <p class="text-gray-500">No messages to display at the moment.</p>
        </div>
      {:else}
        {@const displayMessages = $smsMessages.length > 0 ? $smsMessages : $lastSuccessfulData}
        {#each displayMessages as message (message.id)}
          <article class="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow duration-200">
            <header class="mb-2 border-b pb-2">
              <p class="text-xs text-gray-500">
                ID: <span class="font-mono">{message.id}</span>
              </p>
              <p class="text-xs text-gray-500">
                Received: <span class="font-medium">{new Date(message.receivedAt).toLocaleString()}</span>
              </p>
              {#if message.source && message.source !== 'unknown'}
                <p class="text-xs text-gray-500">
                  From: <span class="font-medium">{message.source}</span>
                </p>
              {/if}
            </header>
            <div class="text-gray-700 whitespace-pre-wrap">
              {@html typeof message.payload?.text === 'string' ? message.payload.text : JSON.stringify(message.payload, null, 2)}
            </div>
          </article>
        {/each}
      {/if}
    </div>
  {/if}

  <footer class="mt-12 text-center text-sm text-gray-500">
    <p>SMS Forwarder Display</p>
  </footer>
</div>

<style>
  /* Basic styling to ensure Turnstile is visible if it somehow doesn't get its own styles, can be removed if not needed */
  .turnstile-container :global(.cf-turnstile) {
    margin: 0 auto; /* Center the widget */
  }
</style>
