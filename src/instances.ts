// Detects other Edna instances (browser tabs / windows) using the same storage.
// They share notes storage but not in-memory state (note names, encryption
// state, metadata), so storage operations (encrypt, decrypt, move notes,
// switch storage) are only safe when there's one instance
// (issue 13 in docs/state-machines.md).

type Msg = { type: "ping" | "pong"; from: string; to?: string };

const kChannelName = "edna-instances";
const myId = Math.random().toString(36).slice(2);

let channel: BroadcastChannel | undefined;
let pongListeners: ((from: string) => void)[] = [];

function getChannel(): BroadcastChannel | undefined {
  if (channel || typeof BroadcastChannel === "undefined") {
    return channel;
  }
  channel = new BroadcastChannel(kChannelName);
  channel.onmessage = (ev: MessageEvent<Msg>) => {
    let msg = ev.data;
    if (!msg || msg.from === myId) {
      return;
    }
    if (msg.type === "ping") {
      channel?.postMessage({ type: "pong", from: myId, to: msg.from } satisfies Msg);
    } else if (msg.type === "pong" && msg.to === myId) {
      for (let fn of pongListeners) {
        fn(msg.from);
      }
    }
  };
  return channel;
}

// starts answering pings from other instances
export function startInstanceDetection() {
  getChannel();
}

// returns true if another instance answers within timeoutMs
export async function hasOtherInstances(timeoutMs = 300): Promise<boolean> {
  let ch = getChannel();
  if (!ch) {
    return false;
  }
  return new Promise((resolve) => {
    let done = false;
    let onPong = () => {
      finish(true);
    };
    let finish = (res: boolean) => {
      if (done) return;
      done = true;
      pongListeners = pongListeners.filter((fn) => fn !== onPong);
      resolve(res);
    };
    pongListeners.push(onPong);
    ch.postMessage({ type: "ping", from: myId } satisfies Msg);
    setTimeout(() => finish(false), timeoutMs);
  });
}
