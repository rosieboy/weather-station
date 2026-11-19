<script lang="ts">
  let {
    clock,
    temperature,
    wake
  }: {
    clock: string;
    temperature: number | null;
    wake: () => void;
  } = $props();
</script>

<button
  class="sleep-screen"
  data-sleep-screen
  aria-label={`Klockan ${clock}. Utetemperatur ${temperature === null ? 'saknas' : temperature.toLocaleString('sv-SE', { maximumFractionDigits: 1 }) + ' grader'}. Väck dashboarden.`}
  onclick={(event) => {
    event.stopPropagation();
    wake();
  }}
>
  <span class="sleep-clock">{clock}</span>
  <span class="sleep-temperature"
    >{temperature === null
      ? '—'
      : temperature.toLocaleString('sv-SE', {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1
        })}<span class="sleep-unit"> °C</span></span
  >
</button>

<style>
  .sleep-screen {
    position: fixed;
    inset: 0;
    z-index: 1000;
    box-sizing: border-box;
    width: 100%;
    height: 100dvh;
    border: 0;
    border-radius: 0;
    margin: 0;
    padding: 2vh 3vw;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2vh;
    background: #080e12;
    color: #f2f5f6;
    --temperature-color: #9fdec9;
    font-family: inherit;
    cursor: pointer;
    box-shadow: none;
  }
  .sleep-clock {
    font-size: min(32vw, 43vh);
    line-height: 1;
    font-weight: 750;
    letter-spacing: -0.05em;
    font-variant-numeric: tabular-nums;
  }
  .sleep-temperature {
    font-size: min(25vw, 40vh);
    color: var(--temperature-color);
    line-height: 1;
    font-weight: 750;
    letter-spacing: -0.04em;
    font-variant-numeric: tabular-nums;
  }
  .sleep-unit {
    font-size: 0.48em;
    letter-spacing: 0;
  }
  .sleep-screen:focus-visible {
    outline: 3px solid currentColor;
    outline-offset: -10px;
  }
  :global(html[data-theme='day']) .sleep-screen {
    background: #f4f6f3;
    color: #1a231f;
    --temperature-color: #165c58;
  }
  :global(html[data-theme='deep-ambient']) .sleep-screen {
    background: #080303;
    color: #e5a194;
    --temperature-color: #d9b482;
  }
</style>
