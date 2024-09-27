import { Button, Input, Popover, Space, Tag } from 'antd';
import React, { useState } from 'react';
import type InboundCallSession from 'ringcentral-web-phone/call-session/inbound';
import { auto } from 'manate/react';

import AnsweredSession from './answered';
import store from '../../store';

const InboundSession = auto((props: { session: InboundCallSession }) => {
  const { session } = props;
  const [forwardPopoverVisible, setForwardPopoverVisible] = useState(false);
  const [forwardToNumber, setForwardToNumber] = useState('');
  const [replyPopoverVisible, setReplyPopoverVisible] = useState(false);
  const [replyText, setReplyText] = useState('On my way');
  return (
    <Space direction="vertical">
      <Space>
        <strong>{session.direction}</strong>
        <span>call from</span>
        {session.remoteNumber} to
        {session.localNumber}
        <Tag color="blue">{session.state}</Tag>
      </Space>
      {session.state === 'ringing' ? (
        <Space>
          <Button onClick={() => store.answer(session.callId)} type="primary">
            Answer
          </Button>
          <Button onClick={() => store.toVoicemail(session.callId)}>To Voicemail</Button>
          <Popover
            open={forwardPopoverVisible}
            onOpenChange={(visible) => setForwardPopoverVisible(visible)}
            trigger="click"
            placement="top"
            content={
              <Space direction="vertical">
                <Input
                  placeholder="16501234567"
                  value={forwardToNumber}
                  onChange={(e) => setForwardToNumber(e.target.value.trim())}
                />
                <Button
                  onClick={() => {
                    store.forward(session.callId, forwardToNumber);
                    setForwardPopoverVisible(false);
                  }}
                >
                  Forward
                </Button>
              </Space>
            }
          >
            <Button>Forward</Button>
          </Popover>
          <Popover
            open={replyPopoverVisible}
            onOpenChange={(visible) => {
              setReplyPopoverVisible(visible);
              if (visible) {
                store.startReply(session.callId);
              }
            }}
            trigger="click"
            placement="top"
            content={
              <Space direction="vertical">
                <Input
                  placeholder="16501234567"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value.trim())}
                />
                <Button
                  onClick={async () => {
                    setReplyPopoverVisible(false);
                    await store.reply(session.callId, replyText);
                  }}
                >
                  Reply
                </Button>
              </Space>
            }
          >
            <Button>Reply</Button>
          </Popover>
          <Button onClick={() => store.decline(session.callId)} danger>
            Decline
          </Button>
        </Space>
      ) : null}
      {session.state === 'answered' ? <AnsweredSession session={session} /> : null}
    </Space>
  );
});

export default InboundSession;
