import {
  Button,
  Divider,
  Empty,
  Form,
  Input,
  Popover,
  Select,
  Space,
  Typography,
} from "antd";
import { autoRun } from "manate";
import { auto } from "manate/react";
import React, { useEffect } from "react";

import type { Store } from "../store";
import CallSession from "./call-session";

const Phone = auto((props: { store: Store }) => {
  const { store } = props;
  const [callee, setCallee] = React.useState<string>("");
  const [callerId, setCallerId] = React.useState<string>("");
  const [calloutPopoverVisible, setCalloutPopoverVisible] = React.useState(
    false,
  );
  const [calloutToNumber, setCalloutToNumber] = React.useState("");
  useEffect(() => {
    const { start, stop } = autoRun(() => {
      if (callerId === "" && store.callerIds.length > 0) {
        setCallerId(store.callerIds[0]);
      }
    });
    start();
    return () => stop();
  }, []);
  return (
    <>
      <Button id="logout-btn" onClick={() => store.logout()}>
        Log out
      </Button>
      <Space direction="vertical" style={{ display: "flex" }}>
        <Divider>Inbound Call</Divider>
        <Typography.Text>
          Logged in as{" "}
          <strong>
            {store.extInfo?.contact?.firstName}{" "}
            {store.extInfo?.contact?.lastName}
          </strong>
          . You may dial <strong>{store.primaryNumber}</strong>{" "}
          to reach this web phone.
        </Typography.Text>
        <Divider>Outbound Call</Divider>
        <Space>
          <Form labelCol={{ span: 8 }} wrapperCol={{ span: 16 }}>
            <Form.Item label="From">
              <Select
                value={callerId}
                onChange={(value) => setCallerId(value)}
                style={{ width: "10rem" }}
                options={store.callerIds.map((n) => ({
                  value: n,
                  label: <span>{n}</span>,
                }))}
              />
            </Form.Item>
            <Form.Item label="To">
              <Input
                placeholder="16501234567"
                style={{ width: "10rem" }}
                onChange={(e) => setCallee(e.target.value.trim())}
                value={callee}
              />
            </Form.Item>
            <Form.Item wrapperCol={{ offset: 8, span: 16 }}>
              <Button
                type="primary"
                onClick={() => store.webPhone.call(callee, callerId)}
                disabled={callee.trim().length < 3}
                block
              >
                Call
              </Button>
            </Form.Item>
          </Form>
        </Space>
        <Divider>Call Sessions</Divider>
        {store.webPhone && (
          <>
            {store.webPhone.callSessions.map((callSession) => (
              <div key={callSession.callId}>
                <CallSession callSession={callSession} />
              </div>
            ))}
            {store.webPhone.callSessions.length === 0 && (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="No sessions"
              />
            )}
            {!store.webPhone.callSessions.find((s) => s.isConference) && (
              <>
                <Divider>Conference</Divider>
                <Button onClick={() => store.startConference()}>
                  Start a conference
                </Button>
              </>
            )}
          </>
        )}
        <Divider>Call Control API</Divider>
        <p>
          This part is for demonstration only.{" "}
          <a
            href="https://developers.ringcentral.com/api-reference/Call-Control/createCallOutCallSession"
            target="_blank"
          >
            Call Control API
          </a>{" "}
          is RESTful API, which is out of scope of WebPhone SDK.
        </p>
        <Popover
          open={calloutPopoverVisible}
          onOpenChange={(visible) => setCalloutPopoverVisible(visible)}
          trigger="click"
          placement="top"
          content={
            <Space direction="vertical">
              <Input
                placeholder="16501234567"
                value={calloutToNumber}
                onChange={(e) => setCalloutToNumber(e.target.value.trim())}
              />
              <Button
                onClick={() => {
                  // todo: make call out to calloutToNumber
                  store.callout(calloutToNumber);
                  setCalloutPopoverVisible(false);
                }}
              >
                Make CallOut
              </Button>
              Ref:{" "}
              <a
                href="https://developers.ringcentral.com/api-reference/Call-Control/createCallOutCallSession"
                target="_blank"
              >
                Documentation
              </a>
            </Space>
          }
        >
          <Button>Call out</Button>
        </Popover>
      </Space>
    </>
  );
});

export default Phone;
