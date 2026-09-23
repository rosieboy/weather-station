import { env } from '$env/dynamic/private';

export interface HAState {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
  last_updated: string;
}
export class HAStream {
  states = new Map<string, HAState>();
  error: string | null = 'Ansluter till Home Assistant…';
  private socket?: WebSocket;
  private retry?: ReturnType<typeof setTimeout>;
  private heartbeat?: ReturnType<typeof setInterval>;
  private deadline?: ReturnType<typeof setTimeout>;
  private listeners = new Set<() => void>();
  private started = false;
  private delay = 1000;
  private nextId = 3;
  private requests = new Map<
    number,
    {
      resolve: (value: unknown) => void;
      reject: (error: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  command(type: string): Promise<unknown> {
    const socket = this.socket;
    if (this.error || !socket)
      return Promise.reject(new Error('Home Assistant disconnected'));
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.requests.delete(id);
        reject(new Error('Home Assistant timeout'));
      }, 5000);
      this.requests.set(id, { resolve, reject, timer });
      try {
        socket.send(JSON.stringify({ id, type }));
      } catch {
        clearTimeout(timer);
        this.requests.delete(id);
        reject(new Error('Home Assistant disconnected'));
      }
    });
  }
  private clearRequests() {
    for (const request of this.requests.values()) {
      clearTimeout(request.timer);
      request.reject(new Error('Home Assistant disconnected'));
    }
    this.requests.clear();
  }
  private tracked(id: string, state?: HAState | null) {
    return (
      this.ids.has(id) ||
      /^(light|switch|event|media_player)\./.test(id) ||
      (id.startsWith('sensor.') &&
        ['temperature', 'humidity'].includes(
          String(state?.attributes?.device_class)
        ))
    );
  }
  private awaitingPong = false;
  private buffered = new Map<string, HAState | null>();
  constructor(
    private url: string,
    private token: string,
    private ids: Set<string>,
    private factory = (url: string) => new WebSocket(url)
  ) {}
  onChange(fn: () => void) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }
  private emit() {
    for (const fn of this.listeners) fn();
  }
  start() {
    if (this.started) return;
    this.started = true;
    this.connect();
  }
  stop() {
    this.started = false;
    this.clearRequests();
    clearTimeout(this.retry);
    clearTimeout(this.deadline);
    clearInterval(this.heartbeat);
    const socket = this.socket;
    this.socket = undefined;
    if (socket) {
      socket.onerror = null;
      socket.onclose = null;
      try {
        socket.close();
      } catch {
        /* Already failed. */
      }
    }
  }
  private connect() {
    if (!this.url || !this.token) {
      this.error = 'Home Assistant är inte konfigurerad.';
      this.emit();
      return;
    }
    let socket: WebSocket;
    try {
      const url = new URL(this.url);
      url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
      url.pathname = '/api/websocket';
      url.search = '';
      url.hash = '';
      socket = this.factory(url.toString());
      this.socket = socket;
    } catch {
      this.reconnect();
      return;
    }
    // Node may synchronously emit another error when close() aborts a handshake.
    // Detach before closing and schedule recovery exactly once.
    const disconnect = () => {
      if (this.socket !== socket) return;
      this.socket = undefined;
      socket.onerror = null;
      socket.onclose = null;
      try {
        socket.close();
      } catch {
        /* Already failed. */
      }
      this.reconnect();
    };
    let initialized = false;
    this.buffered.clear();
    this.deadline = setTimeout(() => disconnect(), 10000);
    socket.onmessage = (event) => {
      if (this.socket !== socket) return;
      try {
        const msg = JSON.parse(String(event.data));
        const request = this.requests.get(msg.id);
        if (msg.type === 'result' && request) {
          clearTimeout(request.timer);
          this.requests.delete(msg.id);
          if (msg.success) request.resolve(msg.result);
          else request.reject(new Error('Home Assistant command rejected'));
          return;
        }
        if (msg.type === 'auth_required')
          socket.send(
            JSON.stringify({ type: 'auth', access_token: this.token })
          );
        else if (msg.type === 'auth_invalid') {
          this.error =
            'Home Assistant avvisade token. Kontrollera konfigurationen.';
          this.emit();
          disconnect();
        } else if (msg.type === 'auth_ok')
          socket.send(
            JSON.stringify({
              id: 1,
              type: 'subscribe_events',
              event_type: 'state_changed'
            })
          );
        else if (msg.type === 'result' && msg.id === 1) {
          if (!msg.success) {
            disconnect();
            return;
          }
          socket.send(JSON.stringify({ id: 2, type: 'get_states' }));
        } else if (msg.type === 'result' && msg.id === 2) {
          if (!msg.success || !Array.isArray(msg.result)) {
            disconnect();
            return;
          }
          this.states.clear();
          for (const state of msg.result)
            if (this.tracked(state.entity_id, state))
              this.states.set(state.entity_id, state);
          for (const [id, state] of this.buffered) {
            if (state) this.states.set(id, state);
            else this.states.delete(id);
          }
          this.buffered.clear();
          initialized = true;
          this.error = null;
          this.delay = 1000;
          this.awaitingPong = false;
          clearTimeout(this.deadline);
          this.heartbeat = setInterval(() => {
            if (this.awaitingPong) {
              disconnect();
              return;
            }
            this.awaitingPong = true;
            socket.send(JSON.stringify({ id: this.nextId++, type: 'ping' }));
          }, 20000);
          this.emit();
        } else if (msg.type === 'pong') this.awaitingPong = false;
        else if (msg.type === 'event' && msg.id === 1) {
          const d = msg.event?.data;
          if (
            !d ||
            (!this.tracked(d.entity_id, d.new_state) &&
              !this.states.has(d.entity_id))
          )
            return;
          if (!initialized) this.buffered.set(d.entity_id, d.new_state);
          else {
            if (d.new_state) this.states.set(d.entity_id, d.new_state);
            else this.states.delete(d.entity_id);
            this.emit();
          }
        }
      } catch {
        disconnect();
      }
    };
    socket.onerror = disconnect;
    socket.onclose = disconnect;
  }

  private reconnect() {
    this.clearRequests();
    clearTimeout(this.deadline);
    clearInterval(this.heartbeat);
    if (!this.started) return;
    if (!this.error?.includes('token'))
      this.error =
        'Kontakt med Home Assistant saknas. Visar senast mottagna värden; återansluter…';
    this.emit();
    this.retry = setTimeout(() => this.connect(), this.delay);
    this.delay = Math.min(this.delay * 2, 30000);
  }
}
let singleton: HAStream | undefined;
export function getHAStream() {
  if (!singleton)
    singleton = new HAStream(
      env.HOME_ASSISTANT_URL || '',
      env.HOME_ASSISTANT_TOKEN || '',
      new Set(
        [
          env.HA_OUTDOOR_TEMPERATURE,
          env.HA_OUTDOOR_HUMIDITY,
          env.HA_BALCONY_TEMPERATURE,
          env.HA_BALCONY_HUMIDITY,
          env.HA_ROOM_TEMPERATURE,
          env.HA_ROOM_HUMIDITY,
          env.HA_BEDROOM_TEMPERATURE,
          env.HA_BEDROOM_HUMIDITY,
          env.HA_WEATHER_ENTITY,
          'sun.sun',
          env.HA_MOON_ENTITY || 'sensor.moon_phase'
        ].filter((id): id is string => !!id)
      )
    );
  singleton.start();
  return singleton;
}
if (import.meta.hot) import.meta.hot.dispose(() => singleton?.stop());
