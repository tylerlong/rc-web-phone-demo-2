import React from 'react';
import { notification, Typography } from 'antd';
import { auto } from 'manate/react';
import type { Managed } from 'manate/models';

import type { Store } from '../store';
import Login from './login';
import Phone from './phone';

const App = auto((props: { store: Managed<Store> }) => {
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
