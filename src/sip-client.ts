import type SipInfoResponse from '@rc-ex/core/lib/definitions/SipInfoResponse';
import EventEmitter from 'ringcentral-web-phone/event-emitter';
import type InboundMessage from 'ringcentral-web-phone/sip-message/inbound';
import type RequestMessage from 'ringcentral-web-phone/sip-message/outbound/request';
import type ResponseMessage from 'ringcentral-web-phone/sip-message/outbound/response';
import type { ISipClient } from 'ringcentral-web-phone/types';

const worker = new SharedWorker(new URL('./shared-worker.ts', import.meta.url), { type: 'module' });
worker.port.start();

// This class will communicate with the shared worker to send and receive SIP messages.
// The shared worker uses `ringcentral-web-phone/sip-client` to do SIP signaling.
class SipClient extends EventEmitter implements ISipClient {
  public sipInfo: SipInfoResponse;
  public constructor(sipInfo: SipInfoResponse) {
    super();
    this.sipInfo = sipInfo;
  }
  public async start() {
    worker.port.onmessage = (e) => {
      if (e.data.type === 'inboundMessage') {
        this.emit('inboundMessage', e.data.message);
        console.log('Receiving...\n', e.data.message);
      } else if (e.data.type === 'outboundMessage') {
        this.emit('outboundMessage', e.data.message);
        console.log('Sending...\n', e.data.message);
      }
    };
    worker.port.postMessage({ type: 'sipInfo', sipInfo: JSON.parse(JSON.stringify(this.sipInfo)) });
  }
  public async request(message: RequestMessage) {
    worker.port.postMessage({ type: 'send', message });
    return new Promise<InboundMessage>((resolve) => {
      const messageListerner = (inboundMessage: InboundMessage) => {
        if (inboundMessage.headers.CSeq !== message.headers.CSeq) {
          return;
        }
        if (inboundMessage.subject.startsWith('SIP/2.0 100 ')) {
          return; // ignore
        }
        this.off('inboundMessage', messageListerner);
        resolve(inboundMessage);
      };
      this.on('inboundMessage', messageListerner);
    });
  }
  public async reply(message: ResponseMessage) {
    worker.port.postMessage({ type: 'send', message });
  }
  public async dispose() {
    worker.port.postMessage({ type: 'dispose' });
  }
}

export default SipClient;
