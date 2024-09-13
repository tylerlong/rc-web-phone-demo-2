import RingCentral from '@rc-ex/core';
import type SipInfoResponse from '@rc-ex/core/lib/definitions/SipInfoResponse';
import WebPhone from 'ringcentral-web-phone';
import localforage from 'localforage';
import type { SipInfo } from 'ringcentral-web-phone/types';
import hyperid from 'hyperid';

import store from '.';

const uuid = hyperid();

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
  const cacheKey = `rc-sip-info-${store.extInfo.id}`;
  let sipInfo = await localforage.getItem<SipInfoResponse>(cacheKey);
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
    await localforage.setItem(cacheKey, sipInfo);
  } else {
    console.log('Use cached sipInfo');
  }
  const webPhone = new WebPhone({ sipInfo: sipInfo as SipInfo, instanceId: uuid(), debug: true });
  store.webPhone = webPhone;
  await webPhone.start();
};

export default afterLogin;
