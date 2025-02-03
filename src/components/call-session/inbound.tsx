import { Button, Input, Popover, Space, Tag } from "antd";
import { auto } from "manate/react";
import React, { useState } from "react";
import type InboundCallSession from "ringcentral-web-phone/call-session/inbound";

import AnsweredSession from "./answered";

const InboundSession = auto((props: { session: InboundCallSession }) => {
  const { session } = props;
  const [forwardPopoverVisible, setForwardPopoverVisible] = useState(false);
  const [forwardToNumber, setForwardToNumber] = useState("");
  const [replyPopoverVisible, setReplyPopoverVisible] = useState(false);
  const [replyText, setReplyText] = useState("On my way");
  return (
    <Space direction="vertical">
      <Space>
        <strong>{session.direction}</strong>
        <span>call from</span>
        {session.remoteNumber} to
        {session.localNumber}
        <Tag color="blue">{session.state}</Tag>
      </Space>
      {session.state === "ringing"
        ? (
          <Space>
            <Button onClick={() => session.answer()} type="primary">
              Answer
            </Button>
            <Button onClick={() => session.toVoicemail()}>To Voicemail</Button>
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
              onOpenChange={(visible) => {
                setReplyPopoverVisible(visible);
                if (visible) {
                  session.startReply();
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
                      const response = await session.reply(replyText);
                      if (response.body.Sts === "0") {
                        const message =
                          `${response.body.Phn} ${response.body.Nm}`;
                        let description = "";
                        switch (response.body.Resp) {
                          case "1":
                            description = "Yes";
                            break;
                          case "2":
                            description = "No";
                            break;
                          case "3":
                            description =
                              `Urgent, please call ${response.body.ExtNfo} immediately!`;
                            break;
                          default:
                            break;
                        }
                        globalThis.notifier.info({
                          message, // who replied
                          description, // what replied
                          duration: 0,
                        });
                      }
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
        )
        : null}
      {session.state === "answered"
        ? <AnsweredSession session={session} />
        : null}
    </Space>
  );
});

export default InboundSession;
