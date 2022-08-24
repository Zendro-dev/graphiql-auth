import { SessionProvider } from 'next-auth/react';
import { CssBaseline } from '@mui/material';
import '../styles.css'

import { theme } from '../theme';
import { ThemeProvider } from '@mui/material/styles';

import {BASEPATH} from '../config/globals';

export default function App({ Component, pageProps: { session, ...pageProps } }) {

	return (
		<SessionProvider
      session={session}
      // refetch every 4min 59sec to avoid the session expiring. This interval
      // has to be smaller than the time difference for a token to count as
      // "expired" (default 5 min). See [...nextauth].ts
      refetchInterval={4 * 60 - 1}
      refetchOnWindowFocus={true}
      basePath={BASEPATH ? `${BASEPATH}/api/auth` : undefined}
    >
			<ThemeProvider theme={theme}>
				<CssBaseline/>
				<Component {...pageProps} />
			</ThemeProvider>
		</SessionProvider>
	)
}
