import { getHAStream } from './ha-stream';
import {
  buildRooms,
  type Registry,
  type Area,
  type Device,
  type Entity
} from './home-model';
import type { HomeSnapshot } from '../home/types';
let registry: Registry | undefined;
let expires = 0;
let pending: Promise<void> | undefined;
let registryError: string | null = null;
export async function getHomeSnapshot(): Promise<HomeSnapshot> {
  const stream = getHAStream();
  if (!stream.error && Date.now() >= expires) {
    if (!pending)
      pending = (async () => {
        try {
          const [areas, devices, entities] = await Promise.all([
            stream.command('config/area_registry/list'),
            stream.command('config/device_registry/list'),
            stream.command('config/entity_registry/list')
          ]);
          if (![areas, devices, entities].every(Array.isArray))
            throw new Error('Invalid registry');
          registry = {
            areas: areas as Area[],
            devices: devices as Device[],
            entities: entities as Entity[]
          };
          registryError = null;
          expires = Date.now() + 60_000;
        } catch {
          registryError = 'Kunde inte läsa rummen från Home Assistant.';
          expires = Date.now() + 15_000;
        }
      })().finally(() => {
        pending = undefined;
      });
    await pending;
  }
  return {
    rooms: registry ? buildRooms(registry, stream.states) : [],
    error: stream.error || registryError
  };
}
