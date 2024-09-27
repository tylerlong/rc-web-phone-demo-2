import { autoRun, manage } from 'manate';
import RingCentral from '@rc-ex/core';
import { message } from 'antd';
import AuthorizeUriExtension from '@rc-ex/authorize-uri';
import type GetExtensionInfoResponse from '@rc-ex/core/lib/definitions/GetExtensionInfoResponse';
import type WebPhone from 'ringcentral-web-phone';
import CallSession from 'ringcentral-web-phone/call-session';
import { debounce } from 'lodash';
import type InboundCallSession from 'ringcentral-web-phone/call-session/inbound';

import afterLogin from './after-login';

export class Store {
  public role: 'real' | 'dummy' = 'dummy';
  public rcToken = '';
  public refreshToken = '';
  public server = 'https://platform.ringcentral.com';
  public clientId = '';
  public clientSecret = '';
  public jwtToken = '';
  public extInfo: GetExtensionInfoResponse;
  public primaryNumber = '';
  public callerIds: string[] = [];

  public webPhone: WebPhone;

  public async logout() {
    const rc = new RingCentral({
      server: this.server,
      clientId: this.clientId,
      clientSecret: this.clientSecret,
    });
    rc.token = { access_token: this.rcToken, refresh_token: this.refreshToken };
    await rc.revoke();
    this.rcToken = '';
    this.refreshToken = '';
    location.reload();
  }

  public async jwtFlow() {
    if (this.server === '' || this.clientId === '' || this.clientSecret === '' || this.jwtToken === '') {
      message.error('Please input server, client ID, client secret and JWT token');
      return;
    }
    const rc = new RingCentral({
      server: this.server,
      clientId: this.clientId,
      clientSecret: this.clientSecret,
    });
    try {
      const token = await rc.authorize({ jwt: this.jwtToken });
      this.rcToken = token.access_token!;
      this.refreshToken = token.refresh_token!;
      afterLogin();
    } catch (e) {
      message.open({ duration: 10, type: 'error', content: e.message });
    }
  }

  public async authCodeFlow() {
    if (this.server === '' || this.clientId === '' || this.clientSecret === '') {
      message.error('Please input server, client ID and client secret');
      return;
    }
    const rc = new RingCentral({
      server: this.server,
      clientId: this.clientId,
      clientSecret: this.clientSecret,
    });
    const authorizeUriExtension = new AuthorizeUriExtension();
    await rc.installExtension(authorizeUriExtension);
    const authorizeUri = authorizeUriExtension.buildUri({
      redirect_uri: window.location.origin + window.location.pathname + 'callback.html',
    });
    window.open(
      authorizeUri,
      'popupWindow',
      `width=600,height=600,left=${window.screenX + 256},top=${window.screenY + 128}`,
    )!;
    window.addEventListener('message', async (event) => {
      if (event.data.source === 'oauth-callback') {
        const token = await rc.authorize({
          code: event.data.code,
          redirect_uri: window.location.origin + window.location.pathname + 'callback.html',
        });
        this.rcToken = token.access_token!;
        this.refreshToken = token.refresh_token!;
        afterLogin();
      }
    });
  }

  // start a new conference
  public async startConference() {
    if (this.role === 'dummy') {
      worker.port.postMessage({ type: 'action', name: 'startConference' });
      return;
    }
    const rc = new RingCentral({ server: this.server });
    rc.token = { access_token: this.rcToken };
    const r = await rc.restapi().account().telephony().conference().post();
    await this.webPhone.call(r.session!.voiceCallToken!);
  }

  // invite a number to an existing conference
  public async inviteToConference(targetNumber: string) {
    if (this.role === 'dummy') {
      worker.port.postMessage({ type: 'action', name: 'inviteToConference', args: { targetNumber } });
      return;
    }
    const confSession = this.webPhone.callSessions.find((cs) => cs.isConference);
    if (!confSession) {
      return;
    }
    const callSession = await this.webPhone.call(targetNumber);
    const rc = new RingCentral({ server: this.server });
    rc.token = { access_token: this.rcToken };
    await rc.restapi().account().telephony().sessions(confSession.sessionId).parties().bringIn().post({
      sessionId: callSession.sessionId,
      partyId: callSession.partyId,
    });
  }

  // merge an existing call session to an existing conference
  public async mergeToConference(callId: string) {
    if (this.role === 'dummy') {
      worker.port.postMessage({ type: 'action', name: 'mergeToConference', args: { callId } });
      return;
    }
    const confSession = this.webPhone.callSessions.find((cs) => cs.isConference);
    if (!confSession) {
      return;
    }
    const rc = new RingCentral({ server: this.server });
    rc.token = { access_token: this.rcToken };
    const callSession = this.webPhone.callSessions.find((cs) => cs.callId === callId)!;
    await rc.restapi().account().telephony().sessions(confSession.sessionId).parties().bringIn().post({
      sessionId: callSession.sessionId,
      partyId: callSession.partyId,
    });
  }

  public async call(callee: string, callerId: string) {
    if (this.role === 'dummy') {
      worker.port.postMessage({ type: 'action', name: 'call', args: { callee, callerId } });
      return;
    }
    await this.webPhone.call(callee, callerId);
  }

  public async hangup(callId: string) {
    if (this.role === 'dummy') {
      worker.port.postMessage({ type: 'action', name: 'hangup', args: { callId } });
      return;
    }
    await this.webPhone.callSessions.find((cs) => cs.callId === callId)!.hangup();
  }

  public async toVoicemail(callId: string) {
    if (this.role === 'dummy') {
      worker.port.postMessage({ type: 'action', name: 'toVoicemail', args: { callId } });
      return;
    }
    await (this.webPhone.callSessions.find((cs) => cs.callId === callId) as InboundCallSession).toVoicemail();
  }

  public async answer(callId: string) {
    if (this.role === 'dummy') {
      worker.port.postMessage({ type: 'action', name: 'answer', args: { callId } });
      return;
    }
    await (this.webPhone.callSessions.find((cs) => cs.callId === callId) as InboundCallSession).answer();
  }

  public async forward(callId: string, forwardToNumber: string) {
    if (this.role === 'dummy') {
      worker.port.postMessage({ type: 'action', name: 'forward', args: { callId, forwardToNumber } });
      return;
    }
    await (this.webPhone.callSessions.find((cs) => cs.callId === callId) as InboundCallSession).forward(
      forwardToNumber,
    );
  }

  public async startReply(callId: string) {
    if (this.role === 'dummy') {
      worker.port.postMessage({ type: 'action', name: 'startReply', args: { callId } });
      return;
    }
    await (this.webPhone.callSessions.find((cs) => cs.callId === callId) as InboundCallSession).startReply();
  }

  public async reply(callId: string, replyText: string) {
    if (this.role === 'dummy') {
      worker.port.postMessage({ type: 'action', name: 'reply', args: { callId, replyText } });
      return;
    }
    const callSession = this.webPhone.callSessions.find((cs) => cs.callId === callId)!;
    const response = await (callSession as InboundCallSession).reply(replyText);
    if (store.role === 'real' && response && response.body.Sts === '0') {
      const message = `${response.body.Phn} ${response.body.Nm}`;
      let description = '';
      switch (response.body.Resp) {
        case '1':
          description = 'Yes';
          break;
        case '2':
          description = 'No';
          break;
        case '3':
          description = `Urgent, please call ${response.body.ExtNfo} immediately!`;
          break;
        default:
          break;
      }
      await store.notice(message, description);
    }
  }

  public async notice(message: string, description: string) {
    global.notifier.info({
      message,
      description,
      duration: 0,
    });
    // forward notice to all dummies
    worker.port.postMessage({ type: 'notice', message, description });
  }

  public async decline(callId: string) {
    if (this.role === 'dummy') {
      worker.port.postMessage({ type: 'action', name: 'decline', args: { callId } });
      return;
    }
    await (this.webPhone.callSessions.find((cs) => cs.callId === callId) as InboundCallSession).decline();
  }

  public async startRecording(callId: string) {
    if (this.role === 'dummy') {
      worker.port.postMessage({ type: 'action', name: 'startRecording', args: { callId } });
      return;
    }
    await this.webPhone.callSessions.find((cs) => cs.callId === callId)!.startRecording();
  }

  public async stopRecording(callId: string) {
    if (this.role === 'dummy') {
      worker.port.postMessage({ type: 'action', name: 'stopRecording', args: { callId } });
      return;
    }
    await this.webPhone.callSessions.find((cs) => cs.callId === callId)!.stopRecording();
  }

  public async hold(callId: string) {
    if (this.role === 'dummy') {
      worker.port.postMessage({ type: 'action', name: 'hold', args: { callId } });
      return;
    }
    await this.webPhone.callSessions.find((cs) => cs.callId === callId)!.hold();
  }

  public async unhold(callId: string) {
    if (this.role === 'dummy') {
      worker.port.postMessage({ type: 'action', name: 'unhold', args: { callId } });
      return;
    }
    await this.webPhone.callSessions.find((cs) => cs.callId === callId)!.unhold();
  }

  public async mute(callId: string) {
    if (this.role === 'dummy') {
      worker.port.postMessage({ type: 'action', name: 'mute', args: { callId } });
      return;
    }
    await this.webPhone.callSessions.find((cs) => cs.callId === callId)!.mute();
  }

  public async unmute(callId: string) {
    if (this.role === 'dummy') {
      worker.port.postMessage({ type: 'action', name: 'unmute', args: { callId } });
      return;
    }
    await this.webPhone.callSessions.find((cs) => cs.callId === callId)!.unmute();
  }

  public async park(callId: string) {
    if (this.role === 'dummy') {
      worker.port.postMessage({ type: 'action', name: 'park', args: { callId } });
      return;
    }
    const result = await this.webPhone.callSessions.find((cs) => cs.callId === callId)!.park();
    await store.notice('Call Park Result', JSON.stringify(result));
  }

  public async transfer(callId: string, transferToNumber: string) {
    if (this.role === 'dummy') {
      worker.port.postMessage({ type: 'action', name: 'transfer', args: { callId, transferToNumber } });
      return;
    }
    await this.webPhone.callSessions.find((cs) => cs.callId === callId)!.transfer(transferToNumber);
  }

  public async flip(callId: string, flipToNumber: string) {
    if (this.role === 'dummy') {
      worker.port.postMessage({ type: 'action', name: 'flip', args: { callId, flipToNumber } });
      return;
    }
    await this.webPhone.callSessions.find((cs) => cs.callId === callId)!.flip(flipToNumber);
  }

  public async sendDtmf(callId: string, dtmfString: string) {
    if (this.role === 'dummy') {
      worker.port.postMessage({ type: 'action', name: 'sendDtmf', args: { callId, dtmfString } });
      return;
    }
    this.webPhone.callSessions.find((cs) => cs.callId === callId)!.sendDtmf(dtmfString);
  }

  public async warmTransfer(
    callId: string,
    transferToNumber: string,
  ): Promise<{
    complete: () => Promise<void>;
    cancel: () => Promise<void>;
  }> {
    if (this.role === 'dummy') {
      worker.port.postMessage({ type: 'action', name: 'warmTransfer', args: { callId, transferToNumber } });
      return {
        complete: async () => {
          worker.port.postMessage({ type: 'action', name: 'warmTransferComplete', args: { callId } });
        },
        cancel: async () => {
          worker.port.postMessage({ type: 'action', name: 'warmTransferCancel', args: { callId } });
        },
      };
    }
    const callSession = this.webPhone.callSessions.find((cs) => cs.callId === callId)!;
    const { complete, cancel } = await callSession.warmTransfer(transferToNumber);
    (callSession as any).warmTransferComplete = complete;
    (callSession as any).warmTransferCancel = cancel;
    return { complete, cancel };
  }
  public async warmTransferComplete(callId: string) {
    (this.webPhone.callSessions.find((cs) => cs.callId === callId) as any).warmTransferComplete();
  }
  public async warmTransferCancel(callId: string) {
    (this.webPhone.callSessions.find((cs) => cs.callId === callId) as any).warmTransferCancel();
  }
}

const store = manage(new Store());

export const worker = new SharedWorker(new URL('../shared-worker.ts', import.meta.url), { type: 'module' });
worker.port.start();
window.onbeforeunload = () => worker.port.postMessage({ type: 'close' });
worker.port.onmessage = (e) => {
  console.log('message from shared worker', e.data);
  if (e.data.type === 'role') {
    store.role = e.data.role;
  } else if (store.role === 'real' && e.data.type === 'action') {
    store[e.data.name](...Object.values(e.data.args ?? {}));
  } else if (store.role === 'dummy' && e.data.type === 'sync') {
    console.log('dummy got sync', e.data.jsonStr);
    store.webPhone.callSessions = JSON.parse(e.data.jsonStr).map((cs) => {
      const callSession = new CallSession(store.webPhone);
      Object.assign(callSession, cs);
      return callSession;
    });
  } else if (store.role === 'dummy' && e.data.type === 'notice') {
    global.notifier.info({
      message: e.data.message,
      description: e.data.description,
      duration: 0,
    });
  } else if (store.role === 'dummy' && e.data.type === 'tokens') {
    store.rcToken = e.data.rcToken;
    store.refreshToken = e.data.refreshToken;
  }
};
const { start } = autoRun(
  store,
  () => {
    if (store.role !== 'real') {
      return;
    }
    if (!store.webPhone) {
      return;
    }
    const jsonStr = JSON.stringify(store.webPhone.callSessions, (key, value) => {
      if (key === 'webPhone') {
        return undefined;
      }
      return value;
    });
    console.log('post call sessions to shared worker', jsonStr);
    worker.port.postMessage({ type: 'sync', jsonStr });
  },
  // why debounce? `array.splice` will trigger multiple times, we only need the last one
  (func: () => void) => debounce(func, 1, { leading: false, trailing: true }),
);
start();

export default store;
