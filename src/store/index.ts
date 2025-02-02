import AuthorizeUriExtension from '@rc-ex/authorize-uri';
import RingCentral from '@rc-ex/core';
import type GetExtensionInfoResponse from '@rc-ex/core/lib/definitions/GetExtensionInfoResponse';
import { message } from 'antd';
import { manage } from 'manate';
import type WebPhone from 'ringcentral-web-phone';
import type CallSession from 'ringcentral-web-phone/call-session';

import afterLogin from './after-login';

export class Store {
  public rcToken = '';
  public refreshToken = '';
  public server = 'https://platform.ringcentral.com';
  public clientId = '';
  public clientSecret = '';
  public jwtToken = '';
  public extInfo: GetExtensionInfoResponse;
  public primaryNumber = '';
  public callerIds: string[] = [];
  public deviceId = '';

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
    if (
      this.server === '' ||
      this.clientId === '' ||
      this.clientSecret === '' ||
      this.jwtToken === ''
    ) {
      message.error(
        'Please input server, client ID, client secret and JWT token',
      );
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
    if (
      this.server === '' ||
      this.clientId === '' ||
      this.clientSecret === ''
    ) {
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
      redirect_uri:
        window.location.origin + window.location.pathname + 'callback.html',
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
          redirect_uri:
            window.location.origin + window.location.pathname + 'callback.html',
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
    const confSession = this.webPhone.callSessions.find(
      (cs) => cs.isConference,
    );
    if (!confSession) {
      return;
    }
    const callSession = await this.webPhone.call(targetNumber);
    const rc = new RingCentral({ server: this.server });
    rc.token = { access_token: this.rcToken };
    await rc
      .restapi()
      .account()
      .telephony()
      .sessions(confSession.sessionId)
      .parties()
      .bringIn()
      .post({
        sessionId: callSession.sessionId,
        partyId: callSession.partyId,
      });
  }

  // merge an existing call session to an existing conference
  public async mergeToConference(callSession: CallSession) {
    const confSession = this.webPhone.callSessions.find(
      (cs) => cs.isConference,
    );
    if (!confSession) {
      return;
    }
    const rc = new RingCentral({ server: this.server });
    rc.token = { access_token: this.rcToken };
    await rc
      .restapi()
      .account()
      .telephony()
      .sessions(confSession.sessionId)
      .parties()
      .bringIn()
      .post({
        sessionId: callSession.sessionId,
        partyId: callSession.partyId,
      });
  }

  public async callControlAnswer(session: CallSession) {
    const rc = new RingCentral({ server: this.server });
    rc.token = { access_token: this.rcToken };
    await rc
      .restapi()
      .account()
      .telephony()
      .sessions(session.sessionId)
      .parties(session.partyId)
      .answer()
      .post({
        deviceId: this.deviceId,
      });
  }
}

const store = manage(new Store());
globalThis.store = store; // for debugging
export default store;
