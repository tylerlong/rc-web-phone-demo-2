import { notification, Typography } from 'antd';
import { auto } from 'manate/react';
import React from 'react';

import type { Store } from '../store';
import Login from './login';
import Phone from './phone';

const App = auto((props: { store: Store }) => {
  const { store } = props;
  const [api, contextHolder] = notification.useNotification();
  global.notifier = api;
  return (
    <>
      {contextHolder}
      <Typography.Title>RingCentral Web Phone 2 Demo</Typography.Title>
      {store.rcToken === '' ? <Login store={store} /> : <Phone store={store} />}
    </>
  );
});

export default App;
