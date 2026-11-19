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
  aria-label="Väck dashboarden"
  onclick={(event) => {
    event.stopPropagation();
    wake();
  }}
>
  <span class="sleep-label">KLOCKAN</span>
  <span class="sleep-clock">{clock}</span>
  <span class="sleep-temperature-label">UTETEMPERATUR</span>
  <span class="sleep-temperature"
    >{temperature === null
      ? '—'
      : temperature.toLocaleString('sv-SE', {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1
        })}<span class="sleep-unit"> °C</span></span
  >
  <span class="sleep-hint">Tryck för att visa dashboarden</span>
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
    padding: clamp(20px, 4vh, 40px);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: #080e12;
    color: #f2f5f6;
    font-family: inherit;
    cursor: pointer;
    box-shadow: none;
  }
  .sleep-label,
  .sleep-temperature-label {
    font-size: clamp(14px, 2.4vh, 22px);
    font-weight: 500;
    letter-spacing: 0.15em;
  }
  .sleep-clock {
    font-size: clamp(70px, min(25vw, 29vh), 240px);
    line-height: 1.1;
    font-weight: 500;
    letter-spacing: -0.05em;
    font-variant-numeric: tabular-nums;
  }
  .sleep-temperature-label {
    margin-top: 3vh;
  }
  .sleep-temperature {
    font-size: clamp(60px, min(22vw, 23vh), 190px);
    line-height: 1.15;
    font-weight: 500;
    letter-spacing: -0.04em;
    font-variant-numeric: tabular-nums;
  }
  .sleep-unit {
    font-size: 0.48em;
    letter-spacing: 0;
  }
  .sleep-hint {
    margin-top: 4vh;
    font-size: clamp(14px, 2.2vh, 18px);
  }
  .sleep-screen:focus-visible {
    outline: 3px solid currentColor;
    outline-offset: -10px;
  }
  :global(html[data-theme='day']) .sleep-screen {
    background: #f4f6f3;
    color: #1a231f;
  }
  :global(html[data-theme='deep-ambient']) .sleep-screen {
    background: #080303;
    color: #e5a194;
  }
</style>
