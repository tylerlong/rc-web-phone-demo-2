import { Button, Input, Popover, Select, Space } from "antd";
import { auto } from "manate/react";
import React, { useEffect, useState } from "react";
import type CallSession from "ringcentral-web-phone/call-session";

import store from "../../store";

const AnsweredSession = auto((props: { session: CallSession }) => {
  const { session } = props;
  const [transferPopoverVisible, setTransferPopoverVisible] = useState(false);
  const [transferToNumber, setTransferToNumber] = useState("");
  const [flipPopoverVisible, setFlipPopoverVisible] = useState(false);
  const [flipToNumber, setFlipToNumber] = useState("");
  const [dtmfPopoverVisible, setDtmfPopoverVisible] = useState(false);
  const [dtmfString, setDtmfString] = useState("");
  const [inviteToConfPopoverVisible, setInviteToConfPopoverVisible] = useState(
    false,
  );
  const [inviteToConfNumber, setInviteToConfNumber] = useState("");
  const [warmTransferMethods, setWarmTransferMethods] = useState<
    undefined | { complete: () => void; cancel: () => void }
  >(undefined);

  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);

  useEffect(() => {
    const fetchDevices = async () => {
      const newDevices = await navigator.mediaDevices.enumerateDevices();
      if (
        newDevices.map((d) => d.deviceId).join("|") !==
          devices.map((d) => d.deviceId).join("|")
      ) {
        setDevices(newDevices);
      }
    };
    fetchDevices();
    const handler = setInterval(fetchDevices, 10000);
    return () => clearInterval(handler);
  }, [devices]);
  return (
    <Space wrap>
      <Button onClick={() => session.hangup()} danger>
        {session.isConference ? "End Conference" : "Hang up"}
      </Button>
      {!session.isConference && (
        <Popover
          open={transferPopoverVisible}
          onOpenChange={(visible) => setTransferPopoverVisible(visible)}
          trigger="click"
          placement="top"
          content={
            <Space direction="vertical">
              <Input
                placeholder="16501234567"
                value={transferToNumber}
                onChange={(e) => setTransferToNumber(e.target.value.trim())}
              />

              {warmTransferMethods && (
                <>
                  <Button
                    onClick={() => {
                      warmTransferMethods.complete();
                      setWarmTransferMethods(undefined);
                      setTransferPopoverVisible(false);
                    }}
                  >
                    Complete
                  </Button>
                  <Button
                    onClick={() => {
                      warmTransferMethods.cancel();
                      setWarmTransferMethods(undefined);
                      setTransferPopoverVisible(false);
                    }}
                  >
                    Cancel
                  </Button>
                </>
              )}
              {!warmTransferMethods && (
                <>
                  <Button
                    onClick={() => {
                      session.transfer(transferToNumber);
                      setTransferPopoverVisible(false);
                    }}
                  >
                    Transfer
                  </Button>
                  <Button
                    onClick={async () => {
                      const { complete, cancel } = await session.warmTransfer(
                        transferToNumber,
                      );
                      setWarmTransferMethods({ complete, cancel });
                    }}
                  >
                    Warm Transer
                  </Button>
                </>
              )}
            </Space>
          }
        >
          <Button>Transfer</Button>
        </Popover>
      )}
      {!session.isConference && (
        <Popover
          open={flipPopoverVisible}
          onOpenChange={(visible) => setFlipPopoverVisible(visible)}
          trigger="click"
          placement="top"
          content={
            <Space direction="vertical">
              <Input
                placeholder="16501234567"
                value={flipToNumber}
                onChange={(e) => setFlipToNumber(e.target.value.trim())}
              />
              <Button
                onClick={() => {
                  session.flip(flipToNumber);
                  setFlipPopoverVisible(false);
                }}
              >
                Flip
              </Button>
            </Space>
          }
        >
          <Button>Flip</Button>
        </Popover>
      )}
      <Button onClick={() => session.startRecording()}>Start Recording</Button>
      <Button onClick={() => session.stopRecording()}>Stop Recording</Button>
      {!session.isConference && (
        <>
          <Button onClick={() => session.hold()}>Hold</Button>
          <Button onClick={() => session.unhold()}>Unhold</Button>
        </>
      )}
      <Button onClick={() => session.mute()}>Mute</Button>
      <Button onClick={() => session.unmute()}>Unmute</Button>
      {!session.isConference && (
        <Button
          onClick={async () => {
            const result = await session.park();
            globalThis.notifier.info({
              message: "Call Park Result",
              description: <pre>{JSON.stringify(result, null, 2)}</pre>,
              duration: 10,
            });
          }}
        >
          Park
        </Button>
      )}
      {!session.isConference && (
        <Popover
          open={dtmfPopoverVisible}
          onOpenChange={(visible) => setDtmfPopoverVisible(visible)}
          trigger="click"
          placement="top"
          content={
            <Space direction="vertical">
              <Input
                placeholder="123#"
                value={dtmfString}
                onChange={(e) => setDtmfString(e.target.value.trim())}
              />
              <Button
                onClick={() => {
                  session.sendDtmf(dtmfString);
                  setDtmfString("");
                  setDtmfPopoverVisible(false);
                }}
              >
                Send
              </Button>
            </Space>
          }
        >
          <Button>Send DTMF</Button>
        </Popover>
      )}
      {!session.isConference &&
        store.webPhone.callSessions.find((s) => s.isConference) && (
        <Button
          onClick={() => {
            store.mergeToConference(session);
          }}
        >
          Merge to Conference
        </Button>
      )}
      {session.isConference && (
        <Popover
          open={inviteToConfPopoverVisible}
          onOpenChange={(visible) => setInviteToConfPopoverVisible(visible)}
          trigger="click"
          placement="top"
          content={
            <Space direction="vertical">
              <Input
                placeholder="16506668888"
                value={inviteToConfNumber}
                onChange={(e) => setInviteToConfNumber(e.target.value.trim())}
              />
              <Button
                onClick={() => {
                  store.inviteToConference(inviteToConfNumber);
                  setInviteToConfNumber("");
                  setInviteToConfPopoverVisible(false);
                }}
              >
                Invite
              </Button>
            </Space>
          }
        >
          <Button type="primary">Invite to Conference</Button>
        </Popover>
      )}
      <Select
        options={devices
          .filter((d) => d.kind === "audioinput")
          .map((d) => ({ value: d.deviceId, label: d.label }))}
        value={session.inputDeviceId}
        onChange={(value) => {
          session.changeInputDevice(value);
        }}
        style={{ width: 256 }}
      />
      {/* firefox doesn't support audiooutput selection */}
      {devices.filter((d) => d.kind === "audiooutput").length > 0 && (
        <Select
          options={devices
            .filter((d) => d.kind === "audiooutput")
            .map((d) => ({ value: d.deviceId, label: d.label }))}
          value={session.outputDeviceId}
          onChange={(value) => {
            session.changeOutputDevice(value);
          }}
          style={{ width: 256 }}
        />
      )}
    </Space>
  );
});

export default AnsweredSession;
