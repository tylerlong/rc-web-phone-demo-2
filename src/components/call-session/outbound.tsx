import { Space, Tag } from "antd";
import { auto } from "manate/react";
import React from "react";
import type OutboundCallSession from "ringcentral-web-phone/call-session/outbound";

import AnsweredSession from "./answered";

const OutboundSession = auto((props: { session: OutboundCallSession }) => {
  const { session } = props;
  return (
    <Space direction="vertical">
      <Space>
        <strong>{session.direction}</strong>
        <span>call from</span>
        {session.localNumber} <span>to</span>
        {session.isConference ? <Tag color="red">Conference</Tag> : (
          session.remoteNumber
        )}
        <Tag color="blue">{session.state}</Tag>
      </Space>
      {session.state === "answered"
        ? <AnsweredSession session={session} />
        : null}
    </Space>
  );
});

export default OutboundSession;
