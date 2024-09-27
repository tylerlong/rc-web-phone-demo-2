import { autoRun, manage } from 'manate';
import RingCentral from '@rc-ex/core';
import { message } from 'antd';
import AuthorizeUriExtension from '@rc-ex/authorize-uri';
import type GetExtensionInfoResponse from '@rc-ex/core/lib/definitions/GetExtensionInfoResponse';
import type WebPhone from 'ringcentral-web-phone';
import CallSession from 'ringcentral-web-phone/call-session';
import { debounce } from 'lodash';

import afterLogin from './after-login';

export class Store {
  public role: 'real' | 'dummy' = 'real';
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
    const rc = new RingCentral({ server: this.server });
    rc.token = { access_token: this.rcToken };
    const r = await rc.restapi().account().telephony().conference().post();
    await this.webPhone.call(r.session!.voiceCallToken!);
  }

  // invite a number to an existing conference
  public async inviteToConference(targetNumber: string) {
    const confSession = this.webPhone.callSessions.find((cs) => cs.isConference);
    if (!confSession) {
      return;
    }
    const callSession = await this.webPhone.call(targetNumber);
    callSession.once('answered', async () => {
      const rc = new RingCentral({ server: this.server });
      rc.token = { access_token: this.rcToken };
      await rc.restapi().account().telephony().sessions(confSession.sessionId).parties().bringIn().post({
        sessionId: callSession.sessionId,
        partyId: callSession.partyId,
      });
    });
  }

  // merge an existing call session to an existing conference
  public async mergeToConference(callSession: CallSession) {
    const confSession = this.webPhone.callSessions.find((cs) => cs.isConference);
    if (!confSession) {
      return;
    }
    const rc = new RingCentral({ server: this.server });
    rc.token = { access_token: this.rcToken };
    await rc.restapi().account().telephony().sessions(confSession.sessionId).parties().bringIn().post({
      sessionId: callSession.sessionId,
      partyId: callSession.partyId,
    });
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
  // array.splice will trigger multiple times, we only need the last one
  (func: () => void) => debounce(func, 1, { leading: false, trailing: true }),
);
start();

export default store;
