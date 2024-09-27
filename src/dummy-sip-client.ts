import EventEmitter from 'ringcentral-web-phone/event-emitter';
import InboundMessage from 'ringcentral-web-phone/sip-message/inbound';
import type RequestMessage from 'ringcentral-web-phone/sip-message/outbound/request';
import type ResponseMessage from 'ringcentral-web-phone/sip-message/outbound/response';
import type { ISipClient } from 'ringcentral-web-phone/types';

// does nothing, just a dummy implementation of ISipClient
class DummySipClient extends EventEmitter implements ISipClient {
  public constructor() {
    super();
  }
  public async start() {}
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async request(message: RequestMessage) {
    return new InboundMessage();
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async reply(message: ResponseMessage) {}
  public async dispose() {}
}

export default DummySipClient;
