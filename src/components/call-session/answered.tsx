import { Button, Input, Popover, Space } from 'antd';
import React, { useState } from 'react';
import type CallSession from 'ringcentral-web-phone/call-session';
import { auto } from 'manate/react';

import store from '../../store';

const AnsweredSession = auto((props: { session: CallSession }) => {
  const { session } = props;
  const [transferPopoverVisible, setTransferPopoverVisible] = useState(false);
  const [transferToNumber, setTransferToNumber] = useState('');
  const [flipPopoverVisible, setFlipPopoverVisible] = useState(false);
  const [flipToNumber, setFlipToNumber] = useState('');
  const [dtmfPopoverVisible, setDtmfPopoverVisible] = useState(false);
  const [dtmfString, setDtmfString] = useState('');
  const [inviteToConfPopoverVisible, setInviteToConfPopoverVisible] = useState(false);
  const [inviteToConfNumber, setInviteToConfNumber] = useState('');
  const [warmTransferMethods, setWarmTransferMethods] = useState<
    undefined | { complete: () => void; cancel: () => void }
  >(undefined);
  return (
    <Space>
      <Button onClick={() => store.hangup(session.callId)} danger>
        {session.isConference ? 'End Conference' : 'Hang up'}
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
                      store.transfer(session.callId, transferToNumber);
                      setTransferPopoverVisible(false);
                    }}
                  >
                    Transfer
                  </Button>
                  <Button
                    onClick={async () => {
                      const { complete, cancel } = await store.warmTransfer(session.callId, transferToNumber);
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
                  store.flip(session.callId, flipToNumber);
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
      <Button onClick={() => store.startRecording(session.callId)}>Start Recording</Button>
      <Button onClick={() => store.stopRecording(session.callId)}>Stop Recording</Button>
      {!session.isConference && (
        <>
          <Button onClick={() => store.hold(session.callId)}>Hold</Button>
          <Button onClick={() => store.unhold(session.callId)}>Unhold</Button>
        </>
      )}
      <Button onClick={() => store.mute(session.callId)}>Mute</Button>
      <Button onClick={() => store.unmute(session.callId)}>Unmute</Button>
      {!session.isConference && <Button onClick={async () => store.park(session.callId)}>Park</Button>}
      {!session.isConference && (
        <Popover
          open={dtmfPopoverVisible}
          onOpenChange={(visible) => setDtmfPopoverVisible(visible)}
          trigger="click"
          placement="top"
          content={
            <Space direction="vertical">
              <Input placeholder="123#" value={dtmfString} onChange={(e) => setDtmfString(e.target.value.trim())} />
              <Button
                onClick={() => {
                  store.sendDtmf(session.callId, dtmfString);
                  setDtmfString('');
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
      {!session.isConference && store.webPhone.callSessions.find((s) => s.isConference) && (
        <Button
          onClick={() => {
            store.mergeToConference(session.callId);
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
                  setInviteToConfNumber('');
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
    </Space>
  );
});

export default AnsweredSession;
