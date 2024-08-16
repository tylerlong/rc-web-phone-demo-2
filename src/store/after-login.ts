import RingCentral from '@rc-ex/core';
import type SipInfoResponse from '@rc-ex/core/lib/definitions/SipInfoResponse';
import { exclude } from 'manate';
import WebPhone from 'ringcentral-web-phone';
import type InboundCallSession from 'ringcentral-web-phone/call-session/inbound';
import type OutboundCallSession from 'ringcentral-web-phone/call-session/outbound';
import localforage from 'localforage';

import store from '.';

// local utility function
const trimPrefix = (s: string, prefix: string): string => {
  if (s.startsWith(prefix)) {
    return s.slice(prefix.length);
  }
  return s;
};

const afterLogin = async () => {
  if (store.rcToken === '') {
    return;
  }
  const rc = new RingCentral();
  rc.token = { access_token: store.rcToken, refresh_token: store.refreshToken };

  // fetch extension and phone number info
  store.extInfo = await rc.restapi().account().extension().get();
  const numberList = await rc.restapi().account().extension().phoneNumber().get();
  store.primaryNumber = trimPrefix(numberList.records?.find((n) => n.primary)?.phoneNumber ?? '', '+');
  if (store.primaryNumber !== '') {
    store.callerIds.push(store.primaryNumber);
  }
  store.callerIds = [
    ...store.callerIds,
    ...(numberList.records
      ?.filter((n) => !n.primary)
      .filter((n) => n.features?.includes('CallerId'))
      .map((n) => trimPrefix(n.phoneNumber!, '+')) ?? []),
  ];

  // create and initialize a web phone
  let sipInfo = await localforage.getItem<SipInfoResponse>('rc-sip-info');
  if (sipInfo === null) {
    console.log('Genereate new sipInfo');
    const r = await rc
      .restapi()
      .clientInfo()
      .sipProvision()
      .post({
        sipInfo: [{ transport: 'WSS' }],
      });
    sipInfo = r.sipInfo![0];
    await localforage.setItem('rc-sip-info', sipInfo);
  } else {
    console.log('Use cached sipInfo');
  }
  const webPhone = new WebPhone({ sipInfo });
  store.webPhone = exclude(webPhone);
  await webPhone.enableDebugMode();
  await webPhone.register();

  // add call sessions to store
  webPhone.on('inboundCall', (inbundCallSession: InboundCallSession) => {
    store.addCallSession(inbundCallSession);
  });
  webPhone.on('outboundCall', (outboundCallSession: OutboundCallSession) => {
    store.addCallSession(outboundCallSession);
  });
};

export default afterLogin;
