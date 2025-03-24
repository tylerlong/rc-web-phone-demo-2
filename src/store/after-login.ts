import RingCentral from "@rc-ex/core";
import type SipInfoResponse from "@rc-ex/core/lib/definitions/SipInfoResponse";
import hyperid from "hyperid";
import localforage from "localforage";
import WebPhone from "ringcentral-web-phone";
import type { SipInfo } from "ringcentral-web-phone/types";
import waitFor from "wait-for-async";

import store from ".";

const uuid = hyperid();

// local utility function
const trimPrefix = (s: string, prefix: string): string => {
  if (s.startsWith(prefix)) {
    return s.slice(prefix.length);
  }
  return s;
};

const afterLogin = async () => {
  if (store.rcToken === "") {
    return;
  }
  const rc = new RingCentral();
  rc.token = { access_token: store.rcToken, refresh_token: store.refreshToken };

  // fetch extension and phone number info
  store.extInfo = await rc.restapi().account().extension().get();
  const numberList = await rc
    .restapi()
    .account()
    .extension()
    .phoneNumber()
    .get();
  store.primaryNumber = trimPrefix(
    numberList.records?.find((n) => n.primary)?.phoneNumber ?? "",
    "+",
  );
  if (store.primaryNumber !== "") {
    store.callerIds.push(store.primaryNumber);
  }
  store.callerIds = [
    ...store.callerIds,
    ...(numberList.records
      ?.filter((n) => !n.primary)
      .filter((n) => n.features?.includes("CallerId"))
      .map((n) => trimPrefix(n.phoneNumber!, "+")) ?? []),
  ];

  // create and initialize a web phone
  const cacheKey = `rc-${store.extInfo.id}`;
  let sipInfo = await localforage.getItem<SipInfoResponse>(
    `${cacheKey}-sipInfo`,
  );
  store.deviceId =
    (await localforage.getItem<string>(`${cacheKey}-deviceId`)) ?? "";
  if (sipInfo === null) {
    console.log("Genereate new sipInfo");
    const r = await rc
      .restapi()
      .clientInfo()
      .sipProvision()
      .post({
        sipInfo: [{ transport: "WSS" }],
      });
    sipInfo = r.sipInfo![0];
    store.deviceId = r.device!.id!;
    await localforage.setItem(`${cacheKey}-sipInfo`, sipInfo);
    await localforage.setItem(`${cacheKey}-deviceId`, store.deviceId);
  } else {
    console.log("Use cached sipInfo");
  }
  console.log("deviceId:", store.deviceId);
  const webPhone = new WebPhone({
    sipInfo: sipInfo as SipInfo,
    instanceId: uuid(), // It may not be the best way to always specify a new instanceId, please read https://github.com/ringcentral/ringcentral-web-phone?tab=readme-ov-file#instanceid
    debug: true,
    autoAnswer: true,
  });
  store.webPhone = webPhone;
  await webPhone.start();

  const recover = async () => {
    await webPhone.start();
    webPhone.callSessions.forEach((callSession) => {
      if (callSession.state === "answered") {
        callSession.reInvite();
      }
    });
  };

  // handle network outage
  window.addEventListener("online", async () => {
    await recover();
  });

  // handle network issues
  const closeListener = async (e) => {
    webPhone.sipClient.wsc.removeEventListener("close", closeListener);
    if (webPhone.disposed) {
      // webPhone.dispose() has been called, no need to reconnect
      return;
    }
    console.log("WebSocket disconnected unexpectedly", e);
    let connected = false;
    let delay = 2000; // initial delay
    while (!connected) {
      console.log(`Reconnect WebSocket in ${delay / 1000} seconds`);
      await waitFor({ interval: delay });
      try {
        await recover();
        connected = true;
      } catch (e) {
        console.log("Error connecting to WebSocket", e);
        delay *= 2; // exponential backoff
        delay = Math.min(delay, 60000); // max delay 60s
      }
    }
    // because webPhone.start() will create a new webPhone.sipClient.wsc
    webPhone.sipClient.wsc.addEventListener("close", closeListener);
  };
  webPhone.sipClient.wsc.addEventListener("close", closeListener);
};

export default afterLogin;
