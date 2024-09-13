// Ref: https://joshuatz.com/posts/2021/strongly-typed-service-workers/
/// <reference lib="webworker" />

// sipClient
import SipClient from 'ringcentral-web-phone/sip-client';
import hyperid from 'hyperid';
import OutboundMessage from 'ringcentral-web-phone/sip-message/outbound';

const uuid = hyperid();

// delegate 'ringcentral-web-phone/sip-client' to do the heavy lifting
let sipClient: SipClient;

// shared worker
declare let self: SharedWorkerGlobalScope;
const ports = new Set<MessagePort>();
self.onconnect = (e) => {
  const port = e.ports[0];
  ports.add(port);

  port.onmessage = (e) => {
    switch (e.data.type) {
      case 'dispose': {
        ports.delete(port);
        if (ports.size === 0) {
          sipClient.dispose();
        }
        break;
      }
      case 'sipInfo': {
        if (sipClient) {
          return; // already inited
        }

        // init sipClient
        sipClient = new SipClient({ sipInfo: e.data.sipInfo, instanceId: uuid(), debug: true });
        sipClient.start();

        // broadcast inboundMessage and outboundMessage to all connected clients
        sipClient.on('inboundMessage', (message) => {
          ports.forEach((p) => p.postMessage({ type: 'inboundMessage', message }));
        });
        sipClient.on('outboundMessage', (message) => {
          ports.forEach((p) => p.postMessage({ type: 'outboundMessage', message }));
        });
        break;
      }
      case 'send': {
        // convert plain object to OutboundMessage instance
        const outboundMessage = new OutboundMessage();
        Object.assign(outboundMessage, e.data.message);

        // `sipClient.reply` equals to send and do not wait for response
        // we don't use `sipClient.request` here because we don't need to wait for response for every outbound message
        sipClient.reply(outboundMessage);
        break;
      }
    }
  };
};

// We need an export to force this file to act like a module, so TS will let us re-type `self`
export default null;
