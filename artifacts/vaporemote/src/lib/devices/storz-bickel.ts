import type { VaporizerAdapter, DeviceState, VaporizerCommand } from "../bluetooth";
import { connectWithServiceFallback } from "./utils";

const SB_SUFFIX = "5354-4f52-5a26-4249434b454c";

// ─── Volcano Hybrid ───────────────────────────────────────────────────────────
const VOL_SERVICE       = `10100000-${SB_SUFFIX}`;
const VOL_CHAR_CUR_TEMP = `10110001-${SB_SUFFIX}`;
const VOL_CHAR_TGT_TEMP = `10110003-${SB_SUFFIX}`;
const VOL_CHAR_HEAT     = `1011000f-${SB_SUFFIX}`;
const VOL_CHAR_FAN      = `10110013-${SB_SUFFIX}`;
const VOL_CHAR_FAN_SPD  = `10110012-${SB_SUFFIX}`;
const VOL_CHAR_BATTERY  = `10110007-${SB_SUFFIX}`;

// ─── Venty (confirmed from storz-rs / reactive-volcano-app RE) ────────────────
// Service shared with Volcano but DIFFERENT characteristics (10100xxx vs 10110xxx)
const VENTY_SERVICE      = `10100000-${SB_SUFFIX}`;
const VENTY_CHAR_CUR_TEMP = `10100001-${SB_SUFFIX}`;  // Read + Notify, °C×10 uint16 LE
const VENTY_CHAR_TGT_TEMP = `10100003-${SB_SUFFIX}`;  // Read + Write, °C×10 uint16 LE
const VENTY_CHAR_HEAT     = `10100031-${SB_SUFFIX}`;  // Write: 0x01=ON, 0x00=OFF
const VENTY_CHAR_BOOST    = `10100041-${SB_SUFFIX}`;  // Read + Write, °C×10 uint16 LE (Booster offset)
const VENTY_CHAR_BATTERY  = `10110001-${SB_SUFFIX}`;  // Read + Notify, uint8 %

// ─── Crafty+ ──────────────────────────────────────────────────────────────────
const CRAFTY_SERVICE = "00000001-4c45-4b43-4942-265a524f5453";
const CRAFTY_TEMP    = "00000011-4c45-4b43-4942-265a524f5453";
const CRAFTY_TARGET  = "00000021-4c45-4b43-4942-265a524f5453";
const CRAFTY_BATTERY = "00000031-4c45-4b43-4942-265a524f5453";

// ─────────────────────────────────────────────────────────────────────────────

function encodeTemp(celsius: number): Uint8Array {
  const raw = Math.round(celsius * 10);
  const buf = new Uint8Array(2);
  new DataView(buf.buffer).setUint16(0, raw, true);
  return buf;
}

function decodeTemp(dv: DataView): number {
  return dv.getUint16(0, true) / 10;
}

// ─── Volcano Hybrid ───────────────────────────────────────────────────────────

export function createVolcanoHybridAdapter(): VaporizerAdapter {
  let server: BluetoothRemoteGATTServer | null = null;
  let service: BluetoothRemoteGATTService | null = null;
  const subscribers: Array<(state: DeviceState) => void> = [];
  let pollingInterval: ReturnType<typeof setInterval> | null = null;

  let cached: DeviceState = {
    connected: false, temperature: null, targetTemperature: null,
    isHeating: false, batteryLevel: null, mode: "hybrid", fanOn: false, fanSpeed: 0,
  };

  async function readChar(uuid: string): Promise<DataView | null> {
    if (!service) return null;
    try { return await (await service.getCharacteristic(uuid)).readValue(); }
    catch { return null; }
  }

  async function writeChar(uuid: string, value: Uint8Array): Promise<void> {
    if (!service) return;
    try {
      const char = await service.getCharacteristic(uuid);
      try { await char.writeValueWithoutResponse(value); }
      catch { await char.writeValue(value); }
    } catch (e) { console.warn("Volcano write:", e); }
  }

  async function fetchState(): Promise<DeviceState> {
    const [tRaw, tgtRaw, heatRaw, fanRaw, fanSpdRaw, batRaw] = await Promise.all([
      readChar(VOL_CHAR_CUR_TEMP), readChar(VOL_CHAR_TGT_TEMP),
      readChar(VOL_CHAR_HEAT), readChar(VOL_CHAR_FAN),
      readChar(VOL_CHAR_FAN_SPD), readChar(VOL_CHAR_BATTERY),
    ]);
    cached = {
      ...cached,
      connected: server?.connected ?? false,
      temperature:       tRaw    ? decodeTemp(tRaw)          : cached.temperature,
      targetTemperature: tgtRaw  ? decodeTemp(tgtRaw)        : cached.targetTemperature,
      isHeating:         heatRaw ? heatRaw.getUint8(0) === 1 : cached.isHeating,
      fanOn:             fanRaw  ? fanRaw.getUint8(0) === 1  : cached.fanOn,
      fanSpeed:          fanSpdRaw ? fanSpdRaw.getUint8(0)   : cached.fanSpeed,
      batteryLevel:      batRaw  ? batRaw.getUint8(0)        : cached.batteryLevel,
      rawData: {
        temperature_raw: tRaw    ? tRaw.getUint16(0, true)    : null,
        target_temp_raw: tgtRaw  ? tgtRaw.getUint16(0, true)  : null,
        heat_raw:        heatRaw ? heatRaw.getUint8(0)         : null,
        fan_raw:         fanRaw  ? fanRaw.getUint8(0)          : null,
        fan_speed_raw:   fanSpdRaw ? fanSpdRaw.getUint8(0)    : null,
        battery_raw:     batRaw  ? batRaw.getUint8(0)          : null,
      },
    };
    return cached;
  }

  return {
    deviceType: "volcano_hybrid",
    displayName: "Volcano Hybrid",
    manufacturer: "Storz & Bickel",
    serviceUUIDs: [VOL_SERVICE],
    nameFilter: ["VOLCANO"],

    async connect(device) {
      const conn = await connectWithServiceFallback(device, VOL_SERVICE);
      server = conn.server;
      service = conn.service;
      cached = { ...cached, connected: true };
      pollingInterval = setInterval(async () => {
        const s = await fetchState();
        subscribers.forEach(cb => cb(s));
      }, 2000);
      return fetchState();
    },

    async disconnect() {
      if (pollingInterval) clearInterval(pollingInterval);
      server?.disconnect();
      cached = { ...cached, connected: false };
    },

    async getState() { return fetchState(); },

    async sendCommand(cmd: VaporizerCommand) {
      switch (cmd.type) {
        case "set_temperature":
          await writeChar(VOL_CHAR_TGT_TEMP, encodeTemp(cmd.value ?? 185));
          cached.targetTemperature = cmd.value ?? 185;
          break;
        case "toggle_heat":
          await writeChar(VOL_CHAR_HEAT, new Uint8Array([cached.isHeating ? 0 : 1]));
          cached.isHeating = !cached.isHeating;
          break;
        case "toggle_fan":
          await writeChar(VOL_CHAR_FAN, new Uint8Array([cached.fanOn ? 0 : 1]));
          cached.fanOn = !cached.fanOn;
          break;
        case "set_fan_speed":
          await writeChar(VOL_CHAR_FAN_SPD, new Uint8Array([cmd.value ?? 5]));
          cached.fanSpeed = cmd.value ?? 5;
          break;
        case "power_off":
          await writeChar(VOL_CHAR_HEAT, new Uint8Array([0]));
          await writeChar(VOL_CHAR_FAN, new Uint8Array([0]));
          cached.isHeating = false;
          cached.fanOn = false;
          break;
      }
      subscribers.forEach(cb => cb({ ...cached }));
    },

    subscribeToUpdates(cb) {
      subscribers.push(cb);
      return () => { const i = subscribers.indexOf(cb); if (i >= 0) subscribers.splice(i, 1); };
    },

    async getRawData() { return cached.rawData ?? {}; },
  };
}

// ─── Venty ────────────────────────────────────────────────────────────────────

export function createVentyAdapter(): VaporizerAdapter {
  let server: BluetoothRemoteGATTServer | null = null;
  let service: BluetoothRemoteGATTService | null = null;
  const subscribers: Array<(state: DeviceState) => void> = [];
  let pollingInterval: ReturnType<typeof setInterval> | null = null;
  let notifyHandlers: Array<{ char: BluetoothRemoteGATTCharacteristic; fn: (e: Event) => void }> = [];

  let cached: DeviceState = {
    connected: false, temperature: null, targetTemperature: null,
    isHeating: false, batteryLevel: null, mode: "convection",
    boostTemperature: null, rawData: {},
  };

  async function readChar(uuid: string): Promise<DataView | null> {
    if (!service) return null;
    try { return await (await service.getCharacteristic(uuid)).readValue(); }
    catch { return null; }
  }

  async function writeChar(uuid: string, value: Uint8Array): Promise<void> {
    if (!service) { console.warn("Venty: no service"); return; }
    try {
      const char = await service.getCharacteristic(uuid);
      try { await char.writeValueWithoutResponse(value); }
      catch { await char.writeValue(value); }
    } catch (e) { console.warn("Venty write:", e); }
  }

  async function fetchState(): Promise<DeviceState> {
    const [tRaw, tgtRaw, boostRaw, batRaw] = await Promise.all([
      readChar(VENTY_CHAR_CUR_TEMP),
      readChar(VENTY_CHAR_TGT_TEMP),
      readChar(VENTY_CHAR_BOOST),
      readChar(VENTY_CHAR_BATTERY),
    ]);
    cached = {
      ...cached,
      connected: server?.connected ?? false,
      temperature:       tRaw    ? decodeTemp(tRaw)          : cached.temperature,
      targetTemperature: tgtRaw  ? decodeTemp(tgtRaw)        : cached.targetTemperature,
      boostTemperature:  boostRaw ? decodeTemp(boostRaw)     : cached.boostTemperature,
      batteryLevel:      batRaw  ? batRaw.getUint8(0)        : cached.batteryLevel,
      rawData: {
        temp_raw:   tRaw    ? tRaw.getUint16(0, true)    : cached.rawData?.temp_raw,
        target_raw: tgtRaw  ? tgtRaw.getUint16(0, true)  : cached.rawData?.target_raw,
        boost_raw:  boostRaw ? boostRaw.getUint16(0, true) : cached.rawData?.boost_raw,
        battery:    batRaw  ? batRaw.getUint8(0)          : cached.rawData?.battery,
      },
    };
    return cached;
  }

  async function trySubscribeNotify(uuid: string, onData: (dv: DataView) => void) {
    if (!service) return;
    try {
      const char = await service.getCharacteristic(uuid);
      await char.startNotifications();
      const fn = (e: Event) => {
        const val = (e.target as BluetoothRemoteGATTCharacteristic).value;
        if (val) onData(val);
      };
      char.addEventListener("characteristicvaluechanged", fn);
      notifyHandlers.push({ char, fn });
    } catch {
      // notifications not supported on this char — polling covers it
    }
  }

  return {
    deviceType: "venty",
    displayName: "Venty",
    manufacturer: "Storz & Bickel",
    serviceUUIDs: [VENTY_SERVICE],
    nameFilter: ["VY"],

    async connect(device) {
      const conn = await connectWithServiceFallback(device, VENTY_SERVICE);
      server = conn.server;
      service = conn.service;
      cached = { ...cached, connected: true };

      // Live temperature via BLE notify
      await trySubscribeNotify(VENTY_CHAR_CUR_TEMP, (dv) => {
        const temp = decodeTemp(dv);
        cached = { ...cached, temperature: temp, rawData: { ...cached.rawData, temp_raw: dv.getUint16(0, true) } };
        subscribers.forEach(cb => cb({ ...cached }));
      });

      // Battery via BLE notify
      await trySubscribeNotify(VENTY_CHAR_BATTERY, (dv) => {
        cached = { ...cached, batteryLevel: dv.getUint8(0) };
        subscribers.forEach(cb => cb({ ...cached }));
      });

      // Polling fallback every 3 s
      pollingInterval = setInterval(async () => {
        const s = await fetchState();
        subscribers.forEach(cb => cb(s));
      }, 3000);

      return fetchState();
    },

    async disconnect() {
      if (pollingInterval) clearInterval(pollingInterval);
      for (const { char, fn } of notifyHandlers) {
        char.removeEventListener("characteristicvaluechanged", fn);
        await char.stopNotifications().catch(() => {});
      }
      notifyHandlers = [];
      server?.disconnect();
      cached = { ...cached, connected: false };
    },

    async getState() { return fetchState(); },

    async sendCommand(cmd: VaporizerCommand) {
      switch (cmd.type) {
        case "set_temperature":
          await writeChar(VENTY_CHAR_TGT_TEMP, encodeTemp(cmd.value ?? 185));
          cached.targetTemperature = cmd.value ?? 185;
          break;
        case "set_boost_temperature":
          await writeChar(VENTY_CHAR_BOOST, encodeTemp(cmd.value ?? 15));
          cached.boostTemperature = cmd.value ?? 15;
          break;
        case "toggle_heat":
          await writeChar(VENTY_CHAR_HEAT, new Uint8Array([cached.isHeating ? 0x00 : 0x01]));
          cached.isHeating = !cached.isHeating;
          break;
        case "power_off":
          await writeChar(VENTY_CHAR_HEAT, new Uint8Array([0x00]));
          cached.isHeating = false;
          break;
      }
      subscribers.forEach(cb => cb({ ...cached }));
    },

    subscribeToUpdates(cb) {
      subscribers.push(cb);
      return () => { const i = subscribers.indexOf(cb); if (i >= 0) subscribers.splice(i, 1); };
    },

    async getRawData() { return cached.rawData ?? {}; },
  };
}

// ─── Crafty+ ──────────────────────────────────────────────────────────────────

export function createCraftyPlusAdapter(): VaporizerAdapter {
  let server: BluetoothRemoteGATTServer | null = null;
  let service: BluetoothRemoteGATTService | null = null;
  let pollingInterval: ReturnType<typeof setInterval> | null = null;
  const subscribers: Array<(s: DeviceState) => void> = [];
  let cached: DeviceState = {
    connected: false, temperature: null, targetTemperature: null,
    isHeating: false, batteryLevel: null, mode: "conduction",
  };

  async function read(uuid: string): Promise<DataView | null> {
    if (!service) return null;
    try { return await (await service.getCharacteristic(uuid)).readValue(); }
    catch { return null; }
  }

  async function fetchState(): Promise<DeviceState> {
    const [t, tgt, bat] = await Promise.all([read(CRAFTY_TEMP), read(CRAFTY_TARGET), read(CRAFTY_BATTERY)]);
    cached = {
      ...cached,
      connected: server?.connected ?? false,
      temperature:       t   ? decodeTemp(t)   : cached.temperature,
      targetTemperature: tgt ? decodeTemp(tgt) : cached.targetTemperature,
      batteryLevel:      bat ? bat.getUint8(0) : cached.batteryLevel,
      rawData: {
        temp_raw:    t   ? t.getUint16(0, true)   : null,
        target_raw:  tgt ? tgt.getUint16(0, true) : null,
        battery_raw: bat ? bat.getUint8(0)         : null,
      },
    };
    return cached;
  }

  return {
    deviceType: "crafty_plus",
    displayName: "Crafty+",
    manufacturer: "Storz & Bickel",
    serviceUUIDs: [CRAFTY_SERVICE],
    nameFilter: ["CRAFTY"],

    async connect(device) {
      const conn = await connectWithServiceFallback(device, CRAFTY_SERVICE);
      server = conn.server;
      service = conn.service;
      cached = { ...cached, connected: true };
      pollingInterval = setInterval(async () => {
        const s = await fetchState();
        subscribers.forEach(cb => cb(s));
      }, 2000);
      return fetchState();
    },

    async disconnect() {
      if (pollingInterval) clearInterval(pollingInterval);
      server?.disconnect();
      cached = { ...cached, connected: false };
    },

    async getState() { return fetchState(); },

    async sendCommand(cmd) {
      if (!service) return;
      if (cmd.type === "set_temperature") {
        const char = await service.getCharacteristic(CRAFTY_TARGET);
        try { await char.writeValueWithoutResponse(encodeTemp(cmd.value ?? 180)); }
        catch { await char.writeValue(encodeTemp(cmd.value ?? 180)); }
        cached.targetTemperature = cmd.value ?? 180;
      } else if (cmd.type === "toggle_heat") {
        cached.isHeating = !cached.isHeating;
      }
      subscribers.forEach(cb => cb({ ...cached }));
    },

    subscribeToUpdates(cb) {
      subscribers.push(cb);
      return () => { const i = subscribers.indexOf(cb); if (i >= 0) subscribers.splice(i, 1); };
    },

    async getRawData() { return cached.rawData ?? {}; },
  };
}
