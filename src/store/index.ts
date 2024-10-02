import { autoRun, manage, $ } from 'manate';
import RingCentral from '@rc-ex/core';
import { message } from 'antd';
import AuthorizeUriExtension from '@rc-ex/authorize-uri';
import type GetExtensionInfoResponse from '@rc-ex/core/lib/definitions/GetExtensionInfoResponse';
import type WebPhone from 'ringcentral-web-phone';
import CallSession from 'ringcentral-web-phone/call-session';
import type InboundCallSession from 'ringcentral-web-phone/call-session/inbound';

import afterLogin from './after-login';

function actionWrapper(value: Function, context: ClassMethodDecoratorContext) {
  return async function (...args: any[]) {
    // dummy
    // forwards action to shared worker
    if (store.role === 'dummy') {
      worker.port.postMessage({ type: 'action', name: context.name, args });
      return;
    }

    // real
    // real will not sync state to dummy when transaction is in progress
    // this prevent sending temporary state to dummy
    $(store).begin(); // begin transaction
    const result = await value.apply(this, args);
    $(store).commit(); // commit transaction
    return result;
  };
}

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
  @actionWrapper
  public async startConference() {
    const rc = new RingCentral({ server: this.server });
    rc.token = { access_token: this.rcToken };
    const r = await rc.restapi().account().telephony().conference().post();
    await this.webPhone.call(r.session!.voiceCallToken!);
  }

  // invite a number to an existing conference
  @actionWrapper
  public async inviteToConference(targetNumber: string) {
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

  @actionWrapper
  public async call(callee: string, callerId: string) {
    await this.webPhone.call(callee, callerId);
  }

  @actionWrapper
  public async hangup(callId: string) {
    await this.webPhone.callSessions.find((cs) => cs.callId === callId)!.hangup();
  }

  @actionWrapper
  public async toVoicemail(callId: string) {
    await (this.webPhone.callSessions.find((cs) => cs.callId === callId) as InboundCallSession).toVoicemail();
  }

  @actionWrapper
  public async answer(callId: string) {
    await (this.webPhone.callSessions.find((cs) => cs.callId === callId) as InboundCallSession).answer();
  }

  @actionWrapper
  public async forward(callId: string, forwardToNumber: string) {
    await (this.webPhone.callSessions.find((cs) => cs.callId === callId) as InboundCallSession).forward(
      forwardToNumber,
    );
  }

  @actionWrapper
  public async startReply(callId: string) {
    await (this.webPhone.callSessions.find((cs) => cs.callId === callId) as InboundCallSession).startReply();
  }

  @actionWrapper
  public async reply(callId: string, replyText: string) {
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

  @actionWrapper
  public async decline(callId: string) {
    await (this.webPhone.callSessions.find((cs) => cs.callId === callId) as InboundCallSession).decline();
  }

  @actionWrapper
  public async startRecording(callId: string) {
    await this.webPhone.callSessions.find((cs) => cs.callId === callId)!.startRecording();
  }

  @actionWrapper
  public async stopRecording(callId: string) {
    await this.webPhone.callSessions.find((cs) => cs.callId === callId)!.stopRecording();
  }

  @actionWrapper
  public async hold(callId: string) {
    await this.webPhone.callSessions.find((cs) => cs.callId === callId)!.hold();
  }

  @actionWrapper
  public async unhold(callId: string) {
    await this.webPhone.callSessions.find((cs) => cs.callId === callId)!.unhold();
  }

  @actionWrapper
  public async mute(callId: string) {
    await this.webPhone.callSessions.find((cs) => cs.callId === callId)!.mute();
  }

  @actionWrapper
  public async unmute(callId: string) {
    await this.webPhone.callSessions.find((cs) => cs.callId === callId)!.unmute();
  }

  @actionWrapper
  public async park(callId: string) {
    const result = await this.webPhone.callSessions.find((cs) => cs.callId === callId)!.park();
    await store.notice('Call Park Result', JSON.stringify(result));
  }

  @actionWrapper
  public async transfer(callId: string, transferToNumber: string) {
    await this.webPhone.callSessions.find((cs) => cs.callId === callId)!.transfer(transferToNumber);
  }

  @actionWrapper
  public async flip(callId: string, flipToNumber: string) {
    await this.webPhone.callSessions.find((cs) => cs.callId === callId)!.flip(flipToNumber);
  }

  @actionWrapper
  public async sendDtmf(callId: string, dtmfString: string) {
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
      worker.port.postMessage({ type: 'action', name: 'warmTransfer', args: [callId, transferToNumber] });
      return {
        complete: async () => {
          worker.port.postMessage({ type: 'action', name: 'warmTransferComplete', args: [callId] });
        },
        cancel: async () => {
          worker.port.postMessage({ type: 'action', name: 'warmTransferCancel', args: [callId] });
        },
      };
    }
    $(store).begin(); // begin transaction
    console.log(this.webPhone.callSessions.map((cs) => cs.callId));
    const callSession = this.webPhone.callSessions.find((cs) => cs.callId === callId)!;
    const { complete, cancel } = await callSession.warmTransfer(transferToNumber);
    (callSession as any).warmTransferComplete = complete;
    (callSession as any).warmTransferCancel = cancel;
    $(store).commit(); // commit transaction
    return { complete, cancel };
  }
  @actionWrapper
  public async warmTransferComplete(callId: string) {
    (this.webPhone.callSessions.find((cs) => cs.callId === callId) as any).warmTransferComplete();
  }
  @actionWrapper
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
    store[e.data.name](...e.data.args);
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
const { start } = autoRun(store, () => {
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
});
start();

export default store;
