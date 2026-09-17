<script lang="ts">
  let { name = '', lamp = false }: { name?: string; lamp?: boolean } = $props();
  let kind = $derived(
    lamp
      ? 'lamp'
      : /kök|matrum/i.test(name)
        ? 'table'
        : /sov|ellen/i.test(name)
          ? 'bed'
          : /balkong/i.test(name)
            ? 'plant'
            : /hall|gång/i.test(name)
              ? 'door'
              : 'sofa'
  );
</script>

<svg
  viewBox="0 0 48 48"
  fill="none"
  stroke="currentColor"
  stroke-width="1.6"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
>
  {#if kind === 'lamp'}<path
      d="M15 22a9 9 0 1 1 18 0c0 5-5 7-5 12h-8c0-5-5-7-5-12Zm5 16h8m-6 4h4M24 3v3M7 12l3 2m28 0 3-2M4 26h4m32 0h4"
    />
  {:else if kind === 'table'}<path
      d="M8 22h32M13 22v17m22-17v17M9 11v11m30-11v11M18 17h12m-9-5h6v5h-6z"
    />
  {:else if kind === 'bed'}<path
      d="M7 36V18m34 18V18M7 30h34M11 24V12h26v12M11 24h26l4 6H7zM15 17h7v7m4 0v-7h7"
    />
  {:else if kind === 'plant'}<path
      d="m16 29 3 13h10l3-13H16Zm8 0V12m0 9C13 23 9 17 10 10c9 0 14 3 14 11Zm0-5C24 7 31 4 38 6c-1 8-6 12-14 10Z"
    />
  {:else if kind === 'door'}<path
      d="M10 42V6h28v36M16 42V11l17-2v33M5 42h38M27 25h1"
    />
  {:else}<path
      d="M10 25V15a5 5 0 0 1 5-5h18a5 5 0 0 1 5 5v10M9 21a4 4 0 0 0-4 4v12h38V25a4 4 0 0 0-8 0v5H13v-5a4 4 0 0 0-4-4ZM10 37v5m28-5v5M24 11v18"
    />{/if}
</svg>
