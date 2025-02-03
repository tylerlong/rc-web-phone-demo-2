import RingCentral from "@rc-ex/core";
import localforage from "localforage";
import { autoRun } from "manate";

import store from ".";
import afterLogin from "./after-login";

const init = async () => {
  // load credentials from local
  store.rcToken = (await localforage.getItem("rcToken")) ?? "";
  store.refreshToken = (await localforage.getItem("refreshToken")) ?? "";
  store.server = (await localforage.getItem("server")) ??
    "https://platform.ringcentral.com";
  store.clientId = (await localforage.getItem("clientId")) ?? "";
  store.clientSecret = (await localforage.getItem("clientSecret")) ?? "";
  store.jwtToken = (await localforage.getItem("jwtToken")) ?? "";

  // auto save credentials to local
  const { start } = autoRun(() => {
    localforage.setItem("rcToken", store.rcToken);
    localforage.setItem("refreshToken", store.refreshToken);
    localforage.setItem("server", store.server);
    localforage.setItem("clientId", store.clientId);
    localforage.setItem("clientSecret", store.clientSecret);
    localforage.setItem("jwtToken", store.jwtToken);
  });
  start();

  const refreshToken = async () => {
    if (store.rcToken !== "") {
      const rc = new RingCentral({
        server: store.server,
        clientId: store.clientId,
        clientSecret: store.clientSecret,
      });
      rc.token = {
        access_token: store.rcToken,
        refresh_token: store.refreshToken,
      };
      try {
        await rc.refresh();
        store.rcToken = rc.token!.access_token!;
        store.refreshToken = rc.token!.refresh_token!;
      } catch {
        store.rcToken = "";
        store.refreshToken = "";
      }
    }
  };
  // auto refresh token every 30 minutes
  await refreshToken();
  setInterval(() => refreshToken(), 30 * 60 * 1000);

  // in case there is a valid token from local storage
  afterLogin();
};

export default init;
