/// <reference lib="webworker" />

declare let self: SharedWorkerGlobalScope;
const dummyPorts = new Set<MessagePort>();
let realPort: MessagePort | undefined;

let syncCache: any;
self.onconnect = (e) => {
  console.log('port connected');
  const port = e.ports[0];
  if (realPort) {
    dummyPorts.add(port);
    port.postMessage({ type: 'role', role: 'dummy' });
  } else {
    realPort = port;
    port.postMessage({ type: 'role', role: 'real' });
  }
  port.onmessage = (e) => {
    console.log('port message', e.data);
    if (e.data.type === 'ready') {
      if (port !== realPort && syncCache) {
        port.postMessage(syncCache);
      }
    } else if (e.data.type === 'close') {
      console.log('port closed');
      if (port === realPort) {
        realPort = undefined;
        if (dummyPorts.size > 0) {
          realPort = Array.from(dummyPorts)[0];
          dummyPorts.delete(realPort);
          realPort.postMessage({ type: 'role', role: 'real' });
        }
      } else {
        dummyPorts.delete(port);
      }
    } else if (e.data.type === 'action') {
      if (realPort) {
        console.log('forwarding action to real');
        realPort.postMessage(e.data);
      }
    } else if (e.data.type === 'sync') {
      console.log('forwarding sync to dummies');
      syncCache = e.data;
      dummyPorts.forEach((dummyPort) => dummyPort.postMessage(e.data));
    }
  };
};

// We need an export to force this file to act like a module, so TS will let us re-type `self`
export default null;
