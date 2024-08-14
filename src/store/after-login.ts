import RingCentral from '@rc-ex/core';
import { exclude } from 'manate';
import WebPhone from 'ringcentral-web-phone';
import type InboundCallSession from 'ringcentral-web-phone/call-session/inbound';
import type OutboundCallSession from 'ringcentral-web-phone/call-session/outbound';

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
  const r = await rc
    .restapi()
    .clientInfo()
    .sipProvision()
    .post({
      sipInfo: [{ transport: 'WSS' }],
    });
  const webPhone = new WebPhone({ sipInfo: r.sipInfo![0], instanceId: 'my-unique-phone-instance-id' });
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
