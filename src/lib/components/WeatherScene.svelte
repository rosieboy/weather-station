<script lang="ts">
  let {
    condition,
    daylight,
    moon
  }: { condition: string; daylight: boolean | null; moon: string | null } =
    $props();
  const id = $props.id();
  let isNight = $derived(daylight === false);
  let known = $derived(
    [
      'sunny',
      'clear-night',
      'partlycloudy',
      'cloudy',
      'rainy',
      'pouring',
      'snowy',
      'snowy-rainy',
      'hail',
      'lightning',
      'lightning-rainy',
      'fog',
      'windy',
      'windy-variant',
      'exceptional'
    ].includes(condition)
  );
  let clouds = $derived(
    [
      'partlycloudy',
      'cloudy',
      'rainy',
      'pouring',
      'snowy',
      'snowy-rainy',
      'hail',
      'lightning',
      'lightning-rainy',
      'windy-variant'
    ].includes(condition)
  );
  let rain = $derived(
    ['rainy', 'pouring', 'snowy-rainy', 'lightning-rainy'].includes(condition)
  );
  let snow = $derived(['snowy', 'snowy-rainy', 'hail'].includes(condition));
  let storm = $derived(['lightning', 'lightning-rainy'].includes(condition));
  let clear = $derived(
    ['sunny', 'clear-night', 'partlycloudy', 'windy'].includes(condition)
  );
</script>

<svg
  class="landscape weather-scene"
  class:scene-night={isNight}
  viewBox="0 0 500 320"
  fill="none"
  aria-hidden="true"
>
  <defs>
    <mask id="{id}-moon"
      ><circle
        cx="335"
        cy="87"
        r="29"
        fill="white"
      />{#if moon !== 'full_moon'}<ellipse
          cx={moon === 'new_moon'
            ? 335
            : moon?.startsWith('waning') || moon === 'last_quarter'
              ? 349
              : 321}
          cy="80"
          rx={moon === 'new_moon' ? 38 : moon?.includes('gibbous') ? 13 : 26}
          ry="32"
          fill="black"
        />{/if}</mask
    >
  </defs>
  {#if known && daylight !== null}
    {#if isNight && clear}<g fill="#cbd5cb" opacity=".55"
        >{#each [[150, 53], [224, 82], [284, 37], [402, 52], [443, 127], [184, 135]] as [x, y]}<circle
            cx={x}
            cy={y}
            r="1.5"
          />{/each}</g
      >{/if}
    {#if clear}
      {#if isNight}<circle
          cx="335"
          cy="87"
          r="29"
          fill="#d6d9be"
          mask="url(#{id}-moon)"
        />
      {:else}<circle
          cx="335"
          cy="87"
          r="51"
          fill="#e6c886"
          opacity=".05"
        /><circle cx="335" cy="87" r="37" fill="#e6c886" />{/if}
    {/if}
    {#if clouds}<g
        fill={isNight ? '#68777c' : '#9eb7ac'}
        opacity={condition === 'partlycloudy' ? 0.65 : 0.85}
      >
        <path
          d="M206 127a23 23 0 0 1 18-37 35 35 0 0 1 66-10 27 27 0 0 1 43 32 18 18 0 0 1-4 35H222a20 20 0 0 1-16-20Z"
        />
        {#if condition !== 'partlycloudy'}<path
            d="M304 155a20 20 0 0 1 17-32 30 30 0 0 1 56-5 23 23 0 0 1 42 19 17 17 0 0 1-3 33h-95a17 17 0 0 1-17-15Z"
            opacity=".55"
          />{/if}
      </g>{/if}
    {#if rain}<g
        stroke="#94b7b5"
        stroke-width="2.5"
        stroke-linecap="round"
        opacity=".7"
        >{#each [225, 256, 287, 318, 349, 380] as x}<path
            d="M{x} 178l-7 16m-5 15-5 12"
          />{/each}</g
      >{/if}
    {#if snow}<g
        stroke="#d9e0ce"
        stroke-width="2"
        stroke-linecap="round"
        opacity=".8"
        >{#each [[230, 179], [272, 211], [312, 181], [355, 216], [390, 190]] as [x, y]}<path
            d="M{x - 4} {y}h8m-4-4v8"
          />{/each}</g
      >{/if}
    {#if storm}<path
        d="m297 149-15 28h15l-9 26 32-39h-18l9-15Z"
        fill="#d3bc82"
        opacity=".8"
      />{/if}
    {#if condition === 'fog'}<g
        stroke="#a8b9ac"
        stroke-width="6"
        stroke-linecap="round"
        opacity=".35"
        ><path d="M171 106h192m-166 25h219m-246 25h173m-149 25h192" /></g
      >{/if}
    {#if condition.startsWith('windy')}<g
        stroke="#b8cabc"
        stroke-width="3"
        stroke-linecap="round"
        opacity=".5"
        ><path d="M180 155h121q22 0 15-17m-112 42h150q25 0 16 17" /></g
      >{/if}
  {/if}
  <path
    d="M0 281Q115 121 256 247T530 224V320H0Z"
    fill={isNight ? '#263c42' : '#315c4b'}
  />
  <path
    d="M-30 313Q155 192 300 278T550 247V320H-30Z"
    fill={isNight ? '#354c50' : '#49705b'}
  />
  <path
    d="M160 320Q336 246 510 299V320Z"
    fill={isNight ? '#4c6061' : '#779074'}
  />
  {#if condition === 'snowy'}<path
      d="M45 234q82-91 164-23l-31-7-22 8-28-13-25 14-22-1Z"
      fill="#c8d4c4"
      opacity=".7"
    />{/if}
</svg>
