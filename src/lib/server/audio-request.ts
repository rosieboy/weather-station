/** A service response acknowledges execution, not fresh speaker metadata. */
export async function sendAudioCommand(
  base: string,
  token: string,
  command: { action: string; data: Record<string, unknown> },
  request: typeof fetch = fetch
): Promise<{
  status: number;
  body: { ok?: boolean; error?: string; uncertain?: boolean };
}> {
  try {
    const response = await request(
      new URL(`/api/services/media_player/${command.action}`, base),
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(command.data),
        signal: AbortSignal.timeout(
          command.action === 'select_source' ? 35000 : 15000
        ),
        redirect: 'error'
      }
    );
    if (!response.ok)
      return {
        status: 502,
        body: {
          error:
            command.action === 'select_source'
              ? 'Home Assistant eller Sonos avvisade källbytet. Prova källan i Sonos-appen; favoriten kan behöva läggas till på nytt.'
              : 'Home Assistant eller Sonos avvisade kommandot. Kontrollera enheten och försök igen.'
        }
      };
    return { status: 200, body: { ok: true } };
  } catch {
    // Aborting our HTTP request cannot cancel a command already running in HA.
    return {
      status: 504,
      body: {
        uncertain: true,
        error:
          'Bekräftelsen dröjer. Kommandot kan fortfarande genomföras. Vänta och kontrollera högtalaren innan du försöker igen.'
      }
    };
  }
}
