import { Button, Input, Popover, Space, Tag } from 'antd';
import React, { useState } from 'react';
import type InboundCallSession from 'ringcentral-web-phone/call-session/inbound';
import { auto } from 'manate/react';

import AnsweredSession from './answered';

const InboundSession = (props: { session: InboundCallSession }) => {
  const { session } = props;
  const [forwardPopoverVisible, setForwardPopoverVisible] = useState(false);
  const [forwardToNumber, setForwardToNumber] = useState('');
  const [replyPopoverVisible, setReplyPopoverVisible] = useState(false);
  const [replyText, setReplyText] = useState('On my way');
  const render = () => (
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
          <Button onClick={() => session.answer()} type="primary">
            Answer
          </Button>
          <Button onClick={() => session.toVoiceMail()}>To Voicemail</Button>
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
                    session.forward(forwardToNumber);
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
            onOpenChange={(visible) => setReplyPopoverVisible(visible)}
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
                  onClick={() => {
                    session.reply(replyText);
                    setReplyPopoverVisible(false);
                  }}
                >
                  Reply
                </Button>
              </Space>
            }
          >
            <Button>Reply</Button>
          </Popover>
          <Button onClick={() => session.decline()} danger>
            Decline
          </Button>
        </Space>
      ) : null}
      {session.state === 'answered' ? <AnsweredSession session={session} /> : null}
    </Space>
  );
  return auto(render, props);
};

export default InboundSession;
